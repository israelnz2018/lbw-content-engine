/**
 * Laboratório — passo 2 do experimento de B-roll: a imagem aprovada vira um
 * vídeo curto com movimento de câmera (zoom ou deslize lento).
 *
 * Isolado de propósito: só lê e grava marketing_laboratorio e
 * marketing/{consultorId}/laboratorio/. A tarefa não leva campanhaId nem
 * pecaId, então uma falha aqui nunca marca campanha ou peça com erro.
 * Se o teste não der certo, apagar este arquivo e a linha em EXECUTORES.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { db, bucket } from './firestore.mjs';

const execFileAsync = promisify(execFile);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RENDER_REEL = path.join(raiz, 'squads/lbw-reel-production/automation/render-reel.mjs');
const RENDER_LEGENDA = path.join(raiz, 'squads/lbw-reel-production/automation/gerar-legenda-karaoke.mjs');

const COLECAO_LAB = 'marketing_laboratorio';
const SEGUNDOS = 5;
const QPS = 30;
const QUADROS = SEGUNDOS * QPS;
const ULTIMO = QUADROS - 1;
const ZOOM = 0.15;

// Expressões do zoompan. A imagem é ampliada 4x antes: sem isso o zoompan
// arredonda a posição para pixel inteiro e o movimento sai tremido.
export const MOVIMENTOS = {
  aproximar: { z: `1+${ZOOM}*on/${ULTIMO}`, x: 'iw/2-(iw/zoom/2)', y: 'ih/2-(ih/zoom/2)' },
  afastar: { z: `${1 + ZOOM}-${ZOOM}*on/${ULTIMO}`, x: 'iw/2-(iw/zoom/2)', y: 'ih/2-(ih/zoom/2)' },
  subir: { z: `${1 + ZOOM}`, x: 'iw/2-(iw/zoom/2)', y: `(ih-ih/zoom)*(1-on/${ULTIMO})` },
  descer: { z: `${1 + ZOOM}`, x: 'iw/2-(iw/zoom/2)', y: `(ih-ih/zoom)*on/${ULTIMO}` },
};

export function filtroDoMovimento(movimento) {
  const m = MOVIMENTOS[movimento] || MOVIMENTOS.aproximar;
  return `[0]scale=-2:7680:flags=lanczos,zoompan=z='${m.z}':x='${m.x}':y='${m.y}'`
    + `:d=${QUADROS}:s=1080x1920:fps=${QPS},format=yuv420p`;
}

export async function gerarBrollLaboratorio(tarefa) {
  const { criativoId, momentoId } = tarefa;
  const movimento = MOVIMENTOS[tarefa.movimento] ? tarefa.movimento : 'aproximar';
  const ref = db().collection(COLECAO_LAB).doc(String(criativoId || ''));
  const campo = `momentos.${momentoId}`;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-broll-'));

  try {
    const lab = (await ref.get()).data();
    const momento = lab?.momentos?.[momentoId];
    if (!momento?.imagem) throw new Error('Este momento ainda não tem imagem.');

    const imagem = path.join(temp, 'imagem.png');
    const saida = path.join(temp, 'broll.mp4');
    await bucket().file(momento.imagem).download({ destination: imagem });
    await execFileAsync('ffmpeg', [
      '-loglevel', 'error', '-y', '-i', imagem,
      '-filter_complex', filtroDoMovimento(movimento),
      '-frames:v', String(QUADROS), '-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
      '-movflags', '+faststart', saida,
    ], { timeout: 5 * 60 * 1000 });

    const destino = `marketing/${lab.consultorId}/laboratorio/${criativoId}/${momentoId}-broll-${Date.now()}.mp4`;
    await bucket().upload(saida, {
      destination: destino,
      metadata: { contentType: 'video/mp4', cacheControl: 'private, max-age=86400' },
    });
    await ref.update({
      [`${campo}.broll`]: destino,
      [`${campo}.brollMovimento`]: movimento,
      [`${campo}.brollStatus`]: 'pronto',
      [`${campo}.brollErro`]: null,
      atualizadoEm: new Date().toISOString(),
    });
    return { criativoId, momentoId, movimento };
  } catch (e) {
    // Sem nova tentativa: o erro vai para a tela, e o consultor clica de novo.
    await ref.update({
      [`${campo}.brollStatus`]: 'erro',
      [`${campo}.brollErro`]: String(e?.message || e).slice(0, 300),
    }).catch(() => {});
    return { criativoId, momentoId, falhou: true };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/* ── Passo 3: o Reel de teste com os B-rolls aprovados ─────────────── */

// Quanto tempo cada B-roll fica na tela e onde ele NÃO pode entrar.
const BROLL_MIN = 2.5;
const BROLL_MAX = 4;
const SEM_BROLL_NO_COMECO = 1.5; // o gancho é do rosto
const RESPIRO_ENTRE_BROLLS = 0.5;

/**
 * Onde cada B-roll entra, em segundos do Reel que SAI.
 *
 * O momento guarda o tempo da frase no vídeo da aula. O Reel começa em
 * clipStartMs e pode estar acelerado: segundo no Reel = (segundo na aula −
 * início do corte) ÷ velocidade. A duração acompanha a frase, dentro de 2,5–4 s,
 * e nunca encosta no B-roll seguinte nem passa do fim.
 */
export function posicionarBrolls(momentos, { clipStartMs, clipEndMs, velocidade = 1 }) {
  const duracaoReel = (clipEndMs - clipStartMs) / 1000 / velocidade;
  const ordenados = [...momentos]
    .map((m) => ({
      ...m,
      noReel: (m.inicio * 1000 - clipStartMs) / 1000 / velocidade,
      daFrase: (m.fim - m.inicio) / velocidade,
    }))
    .sort((a, b) => a.noReel - b.noReel);
  const saida = [];
  for (let i = 0; i < ordenados.length; i++) {
    const m = ordenados[i];
    const inicio = Math.max(m.noReel, SEM_BROLL_NO_COMECO);
    const proximo = ordenados[i + 1] ? Math.max(ordenados[i + 1].noReel, SEM_BROLL_NO_COMECO) : duracaoReel;
    const limite = Math.min(proximo - RESPIRO_ENTRE_BROLLS, duracaoReel - 0.2) - inicio;
    const duracao = Math.min(Math.max(m.daFrase, BROLL_MIN), BROLL_MAX, limite);
    if (duracao < 1.5) continue; // não cabe sem virar um piscar
    saida.push({ ...m, inicioNoReel: Number(inicio.toFixed(3)), duracao: Number(duracao.toFixed(3)) });
  }
  return saida;
}

/** A última configuração com que o Reel deste criativo foi gerado. */
async function configDoReel(criativoId) {
  const tarefas = await db().collection('marketing_tarefas')
    .where('tipo', '==', 'gerar-reel').where('status', '==', 'concluida').get();
  const ultima = tarefas.docs.map((d) => d.data())
    .filter((t) => String(t.campanhaId || '').startsWith(`${criativoId}__`) && t.render?.sourceVideo)
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))[0];
  return ultima?.render || null;
}

export async function montarReelLaboratorio(tarefa) {
  const { criativoId } = tarefa;
  const ref = db().collection(COLECAO_LAB).doc(String(criativoId || ''));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-reel-'));
  try {
    const lab = (await ref.get()).data();
    const aprovados = Object.values(lab?.momentos || {}).filter((m) => m?.brollAprovado && m?.broll);
    if (!aprovados.length) throw new Error('Nenhum B-roll aprovado.');
    const render = await configDoReel(criativoId);
    if (!render) throw new Error('Este criativo ainda não tem Reel gerado em "Minhas peças".');

    const velocidade = Number(render.speed ?? 1);
    const posicionados = posicionarBrolls(aprovados, {
      clipStartMs: render.clipStartMs, clipEndMs: render.clipEndMs, velocidade,
    });
    if (!posicionados.length) throw new Error('Nenhum B-roll cabe no tempo do Reel.');

    const brolls = [];
    for (const [n, m] of posicionados.entries()) {
      const local = path.join(temp, `broll-${n}.mp4`);
      await bucket().file(m.broll).download({ destination: local });
      brolls.push({ path: local, inicio: m.inicioNoReel, duracao: m.duracao });
    }

    // Mesma legenda e mesmo renderizador do Reel de verdade; só entram os B-rolls.
    const entradaLegenda = path.join(temp, 'palavras.json');
    const legendaAss = path.join(temp, 'legenda.ass');
    fs.writeFileSync(entradaLegenda, JSON.stringify({
      clipStartMs: render.clipStartMs, clipEndMs: render.clipEndMs, velocidade, palavras: render.palavras,
    }), 'utf8');
    await execFileAsync('node', [RENDER_LEGENDA, entradaLegenda, legendaAss], { maxBuffer: 8 * 1024 * 1024, timeout: 60 * 1000 });

    const saida = path.join(temp, 'saida', 'reel.mp4');
    const configPath = path.join(temp, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      ...render, cover: null, captionsAss: legendaAss, brolls,
      outputPath: saida, workDir: path.join(temp, 'trabalho'),
    }), 'utf8');
    await execFileAsync('node', [RENDER_REEL, configPath], { maxBuffer: 32 * 1024 * 1024, timeout: 15 * 60 * 1000 });
    if (!fs.existsSync(saida)) throw new Error('O Reel de teste não foi gerado.');

    const destino = `marketing/${lab.consultorId}/laboratorio/${criativoId}/reel-com-broll-${Date.now()}.mp4`;
    await bucket().upload(saida, {
      destination: destino,
      metadata: { contentType: 'video/mp4', cacheControl: 'private, max-age=86400' },
    });
    await ref.update({
      montagem: {
        status: 'pronto',
        video: destino,
        brolls: posicionados.map((m) => ({ frase: m.frase, inicio: m.inicioNoReel, duracao: m.duracao })),
        erro: null,
        feitoEm: new Date().toISOString(),
      },
    });
    return { criativoId, brolls: posicionados.length };
  } catch (e) {
    await ref.update({
      'montagem.status': 'erro',
      'montagem.erro': String(e?.message || e).slice(0, 400),
    }).catch(() => {});
    return { criativoId, falhou: true };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
