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
import { db, bucket } from './firestore.mjs';

const execFileAsync = promisify(execFile);

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
