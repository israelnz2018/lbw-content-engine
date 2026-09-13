/**
 * O que cada tipo de tarefa faz.
 *
 * O worker não interpreta os squads sozinho: ele chama os renderizadores
 * determinísticos, que são os mesmos usados na máquina do Israel. O que muda é
 * só o destino — em vez de gravar em ENTREGAS/, grava numa pasta temporária e
 * sobe para o Storage.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { enviarPasta } from './storage.mjs';
import { gravarPeca, atualizarCampanha, lerCampanha, lerPeca } from './firestore.mjs';

const execFileAsync = promisify(execFile);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RENDERIZADORES = {
  carrossel: path.join(raiz, 'squads/lbw-carousel-production/automation/render-carousel.mjs'),
  linkedin: path.join(raiz, 'squads/lbw-linkedin-production/automation/render-linkedin.mjs'),
  reel: path.join(raiz, 'squads/lbw-reel-production/automation/render-reel.mjs'),
  legenda: path.join(raiz, 'squads/lbw-reel-production/automation/gerar-legenda-karaoke.mjs'),
};

/**
 * Qual arquivo representa a peça na prévia.
 * Preferimos imagem ou vídeo; texto só serve se não houver outra coisa.
 */
function escolherPrincipal(caminhos = []) {
  const visual = caminhos.find((c) => /\.(png|jpe?g|mp4)$/i.test(c));
  const documento = caminhos.find((c) => /\.pdf$/i.test(c));
  return visual || documento || caminhos[0] || null;
}

/** Pasta temporária desta execução. Sempre apagada no fim, dê certo ou não. */
function pastaTemporaria(prefixo) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `lbw-${prefixo}-`));
}

async function rodarRenderizador(script, configPath) {
  const { stdout } = await execFileAsync('node', [script, configPath], {
    maxBuffer: 32 * 1024 * 1024,
    timeout: 15 * 60 * 1000, // 15 min: vídeo longo demora
  });
  try {
    return JSON.parse(stdout.slice(stdout.indexOf('{')));
  } catch {
    return { saidaBruta: stdout.slice(0, 2000) };
  }
}

/* ------------------------------------------------------------------ */

/**
 * Gera as peças de uma campanha.
 *
 * A configuração do render vem pronta na tarefa (campo `render`), montada por quem
 * criou a campanha. O worker não decide conteúdo — ele executa.
 */
export async function gerarCampanha(tarefa) {
  const { consultorId, campanhaId } = tarefa;
  const campanha = await lerCampanha(campanhaId);
  if (!campanha) throw new Error(`Campanha ${campanhaId} não existe.`);

  const temp = pastaTemporaria('campanha');

  try {
    await atualizarCampanha(campanhaId, { status: 'processando' });

    const renderConfig = { ...(tarefa.render || {}), outputRoot: temp };

    const configPath = path.join(temp, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(renderConfig, null, 2), 'utf8');

    const resultado = await rodarRenderizador(RENDERIZADORES.carrossel, configPath);

    // Sobe o que foi gerado, uma pasta por tipo de peça.
    const pecas = [];
    for (const tipo of ['FEED', 'REELS', 'LINKEDIN']) {
      const pasta = path.join(temp, tipo);
      if (!fs.existsSync(pasta)) continue;

      // Dentro de cada tipo há uma pasta por campanha.
      for (const sub of fs.readdirSync(pasta)) {
        const caminhos = await enviarPasta(path.join(pasta, sub), {
          consultorId, campanhaId, tipo: tipo.toLowerCase(),
        });
        if (!caminhos.length) continue;

        const pecaId = `${campanhaId}__${tipo.toLowerCase()}`;
        const peca = {
          id: pecaId,
          consultorId,
          campanhaId,
          tipo: tipo === 'FEED' ? 'carrossel-feed' : tipo === 'REELS' ? 'carrossel-video' : 'linkedin-pdf',
          status: 'revisar',
          versao: 1,
          // A capa da previa tem que ser a peca, nunca a legenda: em ordem alfabetica
          // "legenda.md" vem antes de "slide-01.png" e virava a miniatura.
          arquivoUrl: escolherPrincipal(caminhos),
          arquivos: caminhos,
          criadoEm: new Date().toISOString(),
        };
        await gravarPeca(peca);
        pecas.push(peca);
      }
    }

    await atualizarCampanha(campanhaId, { status: 'revisar' });
    return { pecas: pecas.length, resultado };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/**
 * Refaz uma peça só, a partir do pedido de melhoria do consultor.
 * A versão anterior continua no Storage — nada é sobrescrito.
 */
export async function regerarPeca(tarefa) {
  const { consultorId, campanhaId, pecaId, instrucao } = tarefa;
  const peca = await lerPeca(pecaId);
  if (!peca) throw new Error(`Peça ${pecaId} não existe.`);

  const temp = pastaTemporaria('peca');

  try {
    await gravarPeca({ ...peca, status: 'gerando' });

    const renderConfig = { ...(tarefa.render || {}), outputRoot: temp };

    const configPath = path.join(temp, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(renderConfig, null, 2), 'utf8');

    const script = peca.tipo === 'linkedin-pdf' && renderConfig.layout
      ? RENDERIZADORES.linkedin
      : RENDERIZADORES.carrossel;
    await rodarRenderizador(script, configPath);

    const novaVersao = (peca.versao || 1) + 1;
    const caminhos = [];
    for (const tipo of ['FEED', 'REELS', 'LINKEDIN']) {
      const pasta = path.join(temp, tipo);
      if (!fs.existsSync(pasta)) continue;
      for (const sub of fs.readdirSync(pasta)) {
        caminhos.push(...await enviarPasta(path.join(pasta, sub), {
          consultorId, campanhaId, tipo: `${tipo.toLowerCase()}-v${novaVersao}`,
        }));
      }
    }

    await gravarPeca({
      ...peca,
      status: 'revisar',
      versao: novaVersao,
      arquivoUrl: escolherPrincipal(caminhos) || peca.arquivoUrl,
      arquivos: caminhos.length ? caminhos : peca.arquivos,
      pedidoMelhoria: instrucao || peca.pedidoMelhoria,
    });

    return { versao: novaVersao, arquivos: caminhos.length };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/**
 * Gera o Reel falado: o consultor aparecendo, cortado da aula, com legenda karaokê.
 *
 * O worker não decide nada aqui — a tarefa chega com tudo resolvido: o endereço do
 * vídeo, o recorte, os títulos e as palavras com tempo. Quem resolve é a plataforma,
 * que é quem tem a chave do servidor de vídeo. O worker executa os dois scripts.
 *
 * A fonte é uma URL, não um arquivo: o ffmpeg busca por range HTTP e baixa só o
 * trecho: cortar 36s de uma aula de uma hora custa 1,3 MB em vez de 140 MB.
 */
export async function gerarReel(tarefa) {
  const { consultorId, campanhaId } = tarefa;
  const render = tarefa.render || {};
  if (!render.sourceVideo) throw new Error('A tarefa não trouxe o endereço do vídeo.');
  if (!Array.isArray(render.palavras) || !render.palavras.length) {
    throw new Error('A tarefa não trouxe as palavras com tempo, e sem elas não há legenda.');
  }

  const temp = pastaTemporaria('reel');
  try {
    await atualizarCampanha(campanhaId, { status: 'processando' }).catch(() => {});

    // 1. A legenda karaokê, a partir das palavras com tempo.
    const entradaLegenda = path.join(temp, 'palavras.json');
    const legendaAss = path.join(temp, 'legenda.ass');
    fs.writeFileSync(entradaLegenda, JSON.stringify({
      clipStartMs: render.clipStartMs,
      clipEndMs: render.clipEndMs,
      palavras: render.palavras,
    }), 'utf8');
    await execFileAsync('node', [RENDERIZADORES.legenda, entradaLegenda, legendaAss], {
      maxBuffer: 8 * 1024 * 1024,
      timeout: 60 * 1000,
    });

    // 2. O Reel.
    const saidaDir = path.join(temp, 'saida');
    const configPath = path.join(temp, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      ...render,
      captionsAss: legendaAss,
      outputPath: path.join(saidaDir, 'reel.mp4'),
      workDir: path.join(temp, 'trabalho'),
    }, null, 2), 'utf8');

    const resultado = await rodarRenderizador(RENDERIZADORES.reel, configPath);

    // 3. Sobe o que saiu. A capa vai junto: o publicador exige o arquivo, e é ela
    // que vira a miniatura no Instagram.
    const caminhos = await enviarPasta(saidaDir, { consultorId, campanhaId, tipo: 'reel' });
    if (!caminhos.length) throw new Error('O Reel não produziu arquivo nenhum.');

    const pecaId = `${campanhaId}__reel`;
    await gravarPeca({
      id: pecaId,
      consultorId,
      campanhaId,
      tipo: 'reel',
      status: 'revisar',
      versao: 1,
      arquivoUrl: caminhos.find((c) => c.endsWith('.mp4')) || escolherPrincipal(caminhos),
      capaUrl: caminhos.find((c) => /capa\.jpe?g$/i.test(c)) || null,
      arquivos: caminhos,
      criadoEm: new Date().toISOString(),
    });

    await atualizarCampanha(campanhaId, { status: 'revisar' }).catch(() => {});
    return { pecas: 1, segundos: resultado?.durationSeconds, arquivos: caminhos.length };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

export const EXECUTORES = {
  'gerar-campanha': gerarCampanha,
  'regerar-peca': regerarPeca,
  'gerar-reel': gerarReel,
};
