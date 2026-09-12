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

/** Distância de edição entre duas strings (Levenshtein, programação dinâmica). */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      atual[j] = a[i - 1] === b[j - 1]
        ? anterior[j - 1]
        : 1 + Math.min(anterior[j - 1], anterior[j], atual[j - 1]);
    }
    anterior = atual;
  }
  return anterior[b.length];
}

function normalizarTermo(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N} ]+/gu, '').trim();
}

/**
 * Aplica o dicionário técnico do consultor ao texto.
 *
 * O consultor cadastra só a grafia CORRETA dos termos que importam pra ele
 * (ex.: "Lean Six Sigma", "DMAIC", "Kaizen") — não precisa adivinhar toda variação
 * de erro possível. Aqui o texto é varrido em janelas de 1 a N+1 palavras e
 * comparado por distância de edição contra cada termo; o trecho mais parecido dentro
 * do limiar vira a grafia cadastrada. Cobre erro de digitação e a maioria dos erros
 * de transcrição automática (troca de letra, palavra grudada ou faltando).
 *
 * Isso NÃO é correção fonética: um erro totalmente diferente na forma escrita
 * ("limanu factor" por "Lean Manufacturing") pode passar batido. Por isso a
 * revisão na etapa 5 continua sendo o filtro final, não este dicionário.
 */
export function aplicarDicionario(texto, termos = []) {
  const original = String(texto ?? '');
  const candidatos = termos.map((t) => String(t ?? '').trim()).filter(Boolean)
    // Termo mais longo primeiro: "Lean Six Sigma" precisa ser tentado antes de
    // "Six Sigma", senão a metade da frase já estaria "usada" quando a frase
    // inteira for testada.
    .sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length);
  if (!original.trim() || !candidatos.length) return original;

  // Alterna palavra/separador: índice par é palavra, ímpar é o espaço entre elas.
  const partes = original.split(/(\s+)/);
  const indicesPalavra = partes.map((_, i) => i).filter((i) => i % 2 === 0 && partes[i]);
  const usado = new Set();

  for (const termo of candidatos) {
    const termoNorm = normalizarTermo(termo);
    if (!termoNorm) continue;
    const nPalavras = termo.split(/\s+/).length;
    // Termo de 1 palavra só casa com janela de 1: liberar ±1 aqui gera falso
    // positivo (uma palavra comum colada em qualquer vizinha vira "parecida" com tudo).
    const tamanhos = nPalavras === 1 ? [1] : [nPalavras - 1, nPalavras, nPalavras + 1].filter((t) => t >= 1);
    // Termo curto exige semelhança maior: numa string de 4 letras, 1 letra
    // diferente já é 25% de distância — um limiar frouxo aceitaria qualquer coisa.
    const limiar = termoNorm.length < 6 ? 0.2 : 0.34;

    for (const tam of tamanhos) {
      for (let ini = 0; ini + tam <= indicesPalavra.length; ini++) {
        const janela = indicesPalavra.slice(ini, ini + tam);
        if (janela.some((i) => usado.has(i))) continue;

        const trecho = janela.map((i) => partes[i]).join(' ');
        const trechoNorm = normalizarTermo(trecho);
        const base = Math.max(termoNorm.length, trechoNorm.length, 1);
        const distancia = trechoNorm === termoNorm ? 0 : levenshtein(trechoNorm, termoNorm);

        if (distancia / base <= limiar) {
          if (trecho !== termo) {
            // Pontuação colada na ponta da janela ("sigma," "dmaic).") pertence à
            // frase, não ao termo — sem isso ela some junto com a palavra trocada.
            const primeira = partes[janela[0]];
            const ultima = partes[janela[janela.length - 1]];
            const prefixo = (primeira.match(/^[^\p{L}\p{N}]+/u) || [''])[0];
            const sufixo = (ultima.match(/[^\p{L}\p{N}]+$/u) || [''])[0];
            // Escreve o termo certo (com a pontuação da ponta) na primeira posição
            // e apaga o resto da janela (palavras e separadores internos).
            partes[janela[0]] = prefixo + termo + sufixo;
            for (let i = janela[0] + 1; i <= janela[janela.length - 1]; i++) partes[i] = '';
          }
          janela.forEach((i) => usado.add(i));
          // Sem "break": o mesmo termo pode aparecer mais de uma vez no texto.
        }
      }
    }
  }

  return partes.join('');
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
