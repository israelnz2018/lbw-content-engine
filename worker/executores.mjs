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
import { gravarPeca, atualizarCampanha, lerCampanha, lerConfig, lerPeca } from './firestore.mjs';

const execFileAsync = promisify(execFile);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RENDERIZADORES = {
  carrossel: path.join(raiz, 'squads/lbw-carousel-production/automation/render-carousel.mjs'),
  linkedin: path.join(raiz, 'squads/lbw-linkedin-production/automation/render-linkedin.mjs'),
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

/**
 * Aplica o dicionário técnico do consultor ao texto.
 * É o que substitui a correção de termos que hoje está cravada no gerador de legendas.
 */
export function aplicarDicionario(texto, termos = []) {
  let saida = String(texto ?? '');
  for (const { errado, correto } of termos) {
    if (!errado || !correto) continue;
    // Palavra inteira, sem diferenciar maiúscula de minúscula.
    const escapado = errado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    saida = saida.replace(new RegExp(`\\b${escapado}\\b`, 'gi'), correto);
  }
  return saida;
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

  const config = await lerConfig(consultorId);
  const termos = config?.termos || [];
  const temp = pastaTemporaria('campanha');

  try {
    await atualizarCampanha(campanhaId, { status: 'processando' });

    const renderConfig = { ...(tarefa.render || {}), outputRoot: temp };

    // O dicionário técnico corrige os textos antes de virarem imagem.
    if (Array.isArray(renderConfig.slides)) {
      renderConfig.slides = renderConfig.slides.map((s) => ({
        ...s,
        title: aplicarDicionario(s.title, termos),
        body: aplicarDicionario(s.body, termos),
      }));
    }

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

  const config = await lerConfig(consultorId);
  const termos = config?.termos || [];
  const temp = pastaTemporaria('peca');

  try {
    await gravarPeca({ ...peca, status: 'gerando' });

    const renderConfig = { ...(tarefa.render || {}), outputRoot: temp };
    if (Array.isArray(renderConfig.slides)) {
      renderConfig.slides = renderConfig.slides.map((s) => ({
        ...s,
        title: aplicarDicionario(s.title, termos),
        body: aplicarDicionario(s.body, termos),
      }));
    }

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

export const EXECUTORES = {
  'gerar-campanha': gerarCampanha,
  'regerar-peca': regerarPeca,
};
