/**
 * A biblioteca de imagens dos criativos.
 *
 * Coleção marketing_imagens, arquivos no Storage. Cada imagem é uma ficha:
 *
 *   tipo      'pessoa' (recortada, vai ao lado do texto) ou 'cena' (foto de fundo)
 *   origem    'elenco' (as 12 da casa), 'gerada' (pela IA) ou 'enviada' (pelo consultor)
 *   status    'processando' → 'candidata' → 'aprovada' | 'descartada', ou 'erro'
 *   publica   entra na biblioteca de todos. Personagem gerado é público; foto do
 *             consultor é só dele.
 *   arquivo   caminho no Storage da imagem PRONTA (a pessoa já sem fundo)
 *   original  caminho do que chegou, antes do recorte
 *   previa    a página do carrossel já montada com esta imagem, para aprovar
 *
 * Imagem nunca entra no documento — só o caminho. O mesmo princípio do resto do
 * módulo de marketing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FieldValue } from 'firebase-admin/firestore';
import { db, bucket, COLECOES } from './firestore.mjs';

/** Quanto tempo o endereço temporário de uma imagem vale. Uma produção leva minutos. */
const VALIDADE_MS = 2 * 60 * 60 * 1000;

/** O prefixo das fichas das 12 pessoas da casa. */
export const PREFIXO_ELENCO = 'elenco-';

export async function lerImagem(id) {
  if (!id) return null;
  const snap = await db().collection(COLECOES.imagens).doc(String(id)).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function atualizarImagem(id, campos) {
  await db().collection(COLECOES.imagens).doc(String(id)).set(
    { ...campos, atualizadoEm: new Date().toISOString() },
    { merge: true },
  );
}

/**
 * Um endereço que o renderizador consegue baixar sem credencial.
 *
 * O renderizador não fala com o Firebase — e não deve: roda igual na máquina,
 * sem conta de serviço. Recebe um link assinado que vence sozinho.
 */
export async function enderecoTemporario(caminho) {
  const [url] = await bucket().file(caminho).getSignedUrl({
    action: 'read',
    expires: Date.now() + VALIDADE_MS,
  });
  return url;
}

/** Quem pode usar a imagem: a da biblioteca comum, ou a do próprio consultor. */
export function podeUsar(imagem, consultorId) {
  if (!imagem) return false;
  if (imagem.status !== 'aprovada' && imagem.status !== 'candidata') return false;
  return Boolean(imagem.publica) || imagem.consultorId === consultorId;
}

/**
 * Põe a imagem no lugar certo da página.
 *
 * Pessoa vai em `pessoa`, que o layout desenha ao lado do texto. Cena vai em
 * `fundo`, e só a página de foto tem onde mostrá-la — uma cena posta como pessoa
 * sairia recortada ao meio, com fundo e tudo, na coluna da direita.
 */
export function aplicarNaPagina(slide, url, tipo) {
  const pagina = { ...slide };
  delete pagina.imagemId;
  if (tipo === 'cena') {
    pagina.type = 'foto';
    pagina.fundo = url;
    delete pagina.pessoa;
  } else {
    pagina.pessoa = url;
    delete pagina.fundo;
    // Foto de fundo, comparação e camadas não têm a coluna da pessoa. Escolher uma
    // pessoa nelas é pedir a página padrão, que tem.
    if (!['capa', 'padrao', 'dado', 'cta'].includes(String(pagina.type))) pagina.type = 'padrao';
  }
  return pagina;
}

/**
 * Troca o `imagemId` de cada página pelo endereço da imagem.
 *
 * SÓ o que o consultor escolheu. O automático — capa e última página, quando
 * ninguém escolheu — continua saindo do elenco da pasta, exatamente como antes da
 * biblioteca existir: puxar o rodízio da biblioteca mudaria a pessoa de carrosséis
 * que já estão aprovados no primeiro Refazer. (O renderizador aceita
 * `pessoasAutomaticas`, mas o worker não manda, de propósito.)
 *
 * Devolve também `usos`: de endereço para id. O renderizador conta quem apareceu em
 * cada página pelo endereço, e é por ele que o uso volta para a ficha certa.
 */
export async function resolverImagensDoRender(render, consultorId) {
  const usos = new Map();
  const slides = [];

  for (const original of render.slides || []) {
    if (!original.imagemId) { slides.push(original); continue; }
    const id = String(original.imagemId);
    const imagem = await lerImagem(id);

    if (imagem?.arquivo && podeUsar(imagem, consultorId)) {
      const url = await enderecoTemporario(imagem.arquivo);
      usos.set(url, id);
      slides.push(aplicarNaPagina(original, url, imagem.tipo));
      continue;
    }

    // As pessoas da casa continuam dentro do worker. Se a ficha ainda não foi
    // criada no banco, a página não fica sem ninguém por isso.
    const pagina = { ...original };
    delete pagina.imagemId;
    if (id.startsWith(PREFIXO_ELENCO)) pagina.pessoa = id.slice(PREFIXO_ELENCO.length);
    else console.warn(`aviso: imagem ${id} indisponível para ${consultorId}; a página sai sem ela`);
    slides.push(pagina);
  }

  return { render: { ...render, slides }, usos };
}

/** Quais imagens da biblioteca apareceram em cada página, pelo resultado do renderizador. */
export function imagensPorPagina(pessoas, usos) {
  return (Array.isArray(pessoas) ? pessoas : []).map((ref) => usos.get(ref) || null);
}

/** Soma um uso em cada imagem que apareceu. Serve para a biblioteca mostrar as mais usadas. */
export async function registrarUso(ids) {
  const unicos = [...new Set((ids || []).filter(Boolean))];
  await Promise.all(unicos.map((id) => db().collection(COLECOES.imagens).doc(id).set(
    { vezesUsada: FieldValue.increment(1), usadaEm: new Date().toISOString() },
    { merge: true },
  )));
}

/* ------------------------------------------------------------------ */

/**
 * Tira o fundo de uma pessoa e corta a sobra transparente.
 *
 * O corte da sobra importa mais do que parece: o layout encosta a pessoa no canto
 * de baixo da página. Uma foto enviada com muito espaço em volta sairia com a
 * pessoa pequena e flutuando no meio da coluna.
 */
async function recortarPessoa(entrada, saida) {
  const sharp = await carregarSharp();
  // Foto de celular tem 12 megapixels; mandar inteira gastava memória e devolvia um
  // PNG de 20 MB. Mas não pode reduzir demais: a pessoa ocupa perto de 900 px da
  // página, e depois de cortar a sobra ela tem de continuar desse tamanho.
  const reduzida = `${entrada}.reduzida.png`;
  if (sharp) {
    await sharp(entrada).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .png().toFile(reduzida);
  } else {
    fs.copyFileSync(entrada, reduzida);
  }

  // O pacote procura os modelos em ./node_modules A PARTIR DE ONDE O PROCESSO RODA.
  // O worker roda de /app/worker e o pacote está em /app/node_modules, então ele
  // não achava nada. O endereço vem de onde o pacote realmente está.
  const pacote = import.meta.resolve('@imgly/background-removal-node');
  const { removeBackground } = await import(pacote);
  const blob = await removeBackground(pathToFileURL(reduzida).href, {
    publicPath: new URL('./', pacote).href,
  });
  const semFundo = Buffer.from(await blob.arrayBuffer());

  if (sharp) await sharp(semFundo).trim().png().toFile(saida);
  else fs.writeFileSync(saida, semFundo);
}

/** Cena não perde o fundo — só fica num tamanho que a página usa. */
async function ajustarCena(entrada, saida) {
  const sharp = await carregarSharp();
  if (!sharp) { fs.copyFileSync(entrada, saida); return; }
  await sharp(entrada).rotate().resize({ width: 1600, height: 2000, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 }).toFile(saida);
}

/** O arquivo pronto para a página, conforme o tipo. Exportado para o teste local. */
export async function deixarPronta(tipo, entrada, saida) {
  if (tipo === 'cena') await ajustarCena(entrada, saida);
  else await recortarPessoa(entrada, saida);
}

async function carregarSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    return null;
  }
}

/**
 * Deixa uma imagem que chegou — gerada ou enviada — pronta para usar e com a
 * página de prévia montada.
 *
 * Um caminho só para as duas origens. A diferença entre imagem da IA e foto do
 * consultor acaba no momento em que o arquivo chega ao Storage.
 */
export async function prepararImagem(tarefa, { temp, renderizarPagina }) {
  const { imagemId } = tarefa;
  const imagem = await lerImagem(imagemId);
  if (!imagem) throw new Error(`Imagem ${imagemId} não existe.`);
  if (!imagem.original) throw new Error('A imagem não tem o arquivo original.');

  try {
    await atualizarImagem(imagemId, { status: 'processando', erro: null });

    const extensao = path.extname(imagem.original) || '.png';
    const original = path.join(temp, `original${extensao}`);
    await bucket().file(imagem.original).download({ destination: original });

    // Nome novo a cada preparo: sobrescrever o mesmo caminho deixaria o navegador
    // mostrando a versão do cache.
    const versao = Date.now();
    const ehPessoa = imagem.tipo !== 'cena';
    const pronta = path.join(temp, ehPessoa ? `imagem-${versao}.png` : `imagem-${versao}.jpg`);
    await deixarPronta(imagem.tipo, original, pronta);

    const pasta = path.posix.dirname(imagem.original);
    const arquivo = `${pasta}/${path.basename(pronta)}`;
    await bucket().upload(pronta, {
      destination: arquivo,
      metadata: { contentType: ehPessoa ? 'image/png' : 'image/jpeg', cacheControl: 'private, max-age=86400' },
    });

    // A página montada, quando a imagem nasceu para uma página.
    let previa = null;
    const pedido = tarefa.previa;
    if (pedido?.render?.slides?.length && Number.isInteger(pedido.pagina)) {
      const url = await enderecoTemporario(arquivo);
      const slides = pedido.render.slides.map((s, i) => (i === pedido.pagina ? aplicarNaPagina(s, url, imagem.tipo) : s));
      const png = await renderizarPagina({ ...pedido.render, slides }, pedido.pagina);
      if (png) {
        previa = `${pasta}/previa-${versao}.png`;
        await bucket().upload(png, {
          destination: previa,
          metadata: { contentType: 'image/png', cacheControl: 'private, max-age=86400' },
        });
      }
    }

    await atualizarImagem(imagemId, {
      status: imagem.status === 'aprovada' ? 'aprovada' : 'candidata',
      arquivo,
      previa,
      erro: null,
    });
    return { imagem: imagemId, arquivo, previa };
  } catch (e) {
    // Na última tentativa a ficha tem de dizer que falhou. Sem isto ela ficaria
    // "processando" para sempre, e a tela esperaria uma imagem que não vem.
    const ultima = (tarefa.tentativas || 0) >= 3;
    await atualizarImagem(imagemId, {
      ...(ultima ? { status: 'erro' } : {}),
      erro: String(e?.message || e).slice(0, 300),
    }).catch(() => {});
    throw e;
  }
}
