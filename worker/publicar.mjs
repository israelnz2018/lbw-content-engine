/**
 * Publicação nas redes, feita pelo worker.
 *
 * Até aqui quem publicava era o Israel pedindo para o Claude rodar
 * skills/instagram-publisher na máquina dele. Funcionava, mas exigia alguém
 * presente. Este módulo é o mesmo trabalho movido para dentro da plataforma,
 * para a peça agendada ir ao ar na hora marcada sem ninguém por perto.
 *
 * FASE 1: só o consultor 'israel'. Cada consultor precisa do próprio token, e
 * hoje só existe um par de tokens (no Railway). Ver CONSULTORES_COM_PUBLICACAO.
 */
import { bucket, lerPeca, lerCampanha, lerCriativo } from './firestore.mjs';

const IG_BASE = 'https://graph.facebook.com/v21.0';
const LI_BASE = 'https://api.linkedin.com/rest';

/** Versão da API do LinkedIn. De 202601 para trás ele responde 426 (obsoleta). */
const LI_VERSAO = process.env.LINKEDIN_VERSION || '202606';

/** Limites das redes. Passar do limite é erro na API, então cortamos antes. */
const LIMITE_LEGENDA = { instagram: 2200, linkedin: 3000 };

/** Instagram aceita de 2 a 10 imagens por carrossel. */
const CARROSSEL_MIN = 2;
const CARROSSEL_MAX = 10;

/* ===================== Decisões puras (testáveis) ===================== */

/**
 * Em que rede cada tipo de peça é publicado.
 * Espelha o campo `destino` de TIPOS_PECA em src/types/marketing.ts.
 */
export const REDE_DA_PECA = {
  'reel': 'instagram',
  'carrossel-feed': 'instagram',
  'carrossel-video': 'instagram',
  'linkedin-pdf': 'linkedin',
  'linkedin-imagem': 'linkedin',
  'linkedin-texto': 'linkedin',
};

export function redeDaPeca(tipo) {
  return REDE_DA_PECA[tipo] || null;
}

/**
 * O Facebook não é uma rede própria aqui: é um BÔNUS do Instagram.
 *
 * Decisão do Israel — o post da Página do Facebook sai automaticamente junto
 * com o Instagram, mesmo arquivo e legenda, sem aprovação nem agendamento à
 * parte. Por isso só cruza quem já vai para o Instagram; peça de LinkedIn não
 * tem o que cruzar.
 */
export function deveCruzarParaFacebook(tipo) {
  return redeDaPeca(tipo) === 'instagram';
}

/**
 * O YouTube também é bônus — mas só de quem já é VÍDEO.
 *
 * O carrossel de feed (fotos) não tem o que cruzar; o Reel e o carrossel em
 * vídeo, sim, como YouTube Shorts (os dois já nascem em 9:16).
 */
export function deveCruzarParaYoutube(tipo) {
  return tipo === 'reel' || tipo === 'carrossel-video';
}

/**
 * Quem pode publicar automaticamente.
 *
 * Trava de fase 1: o token é de uma conta só. Sem esta trava, a peça de um
 * consultor novo iria para o Instagram do Israel — o pior erro possível aqui.
 */
export function consultoresLiberados() {
  const bruto = process.env.CONSULTORES_COM_PUBLICACAO ?? 'israel';
  return new Set(bruto.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
}

export function consultorLiberado(consultorId) {
  return consultoresLiberados().has(String(consultorId || '').toLowerCase());
}

/** Corta a legenda no limite da rede, sem partir palavra no meio. */
export function limitarLegenda(texto, limite) {
  const limpo = String(texto ?? '').trim();
  if (limpo.length <= limite) return limpo;
  const cortado = limpo.slice(0, limite);
  const ultimoEspaco = cortado.lastIndexOf(' ');
  return (ultimoEspaco > limite * 0.8 ? cortado.slice(0, ultimoEspaco) : cortado).trimEnd();
}

/** Os arquivos da peça, sempre como lista, sem repetir o principal. */
export function arquivosDaPeca(peca) {
  const todos = [...(peca?.arquivos || [])];
  if (peca?.arquivoUrl && !todos.includes(peca.arquivoUrl)) todos.unshift(peca.arquivoUrl);
  return todos;
}

/**
 * As páginas do carrossel, na ordem.
 *
 * Filtra por `slide-NN` de propósito: a pasta da peça também guarda capa e
 * legenda, e mandar a capa como página repetiria o primeiro slide no post.
 */
export function slidesDoCarrossel(peca) {
  return arquivosDaPeca(peca)
    .filter((c) => /slide-\d+\.(png|jpe?g)$/i.test(c))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

function acharArquivo(peca, regex) {
  return arquivosDaPeca(peca).find((c) => regex.test(c)) || null;
}

export function videoDaPeca(peca) {
  return acharArquivo(peca, /\.mp4$/i);
}

export function capaDaPeca(peca) {
  return acharArquivo(peca, /capa\.(jpe?g|png)$/i)
    || acharArquivo(peca, /instagram-cover\.(jpe?g|png)$/i);
}

export function pdfDaPeca(peca) {
  return acharArquivo(peca, /\.pdf$/i);
}

export function imagemDaPeca(peca) {
  return acharArquivo(peca, /\.(png|jpe?g)$/i);
}

/**
 * Qual texto acompanha a peça em cada rede.
 *
 * São textos diferentes de propósito: o artigo do LinkedIn é longo e explicativo,
 * a legenda do Instagram é curta e termina em pergunta. Quem escreve os dois é a
 * IA, junto com as páginas, e eles ficam no CRIATIVO — não na peça.
 */
export function escolherTexto(rede, textos = {}) {
  return rede === 'linkedin'
    ? (textos.artigoLinkedin || textos.legendaInstagram || '')
    : (textos.legendaInstagram || textos.artigoLinkedin || '');
}

/**
 * Tudo que precisa estar no lugar antes de falar com a rede.
 *
 * Erra ANTES de publicar, com mensagem em português: um erro da Graph API cru
 * ("(#100) Invalid parameter") não diz ao consultor o que fazer.
 *
 * `legenda` vem de fora porque buscá-la exige duas leituras no banco (a peça
 * aponta a campanha, que aponta o criativo, que guarda os textos) — e esta
 * função precisa continuar sendo pura para os testes.
 */
export function conferirPeca(peca, legendaResolvida) {
  if (!peca) throw new Error('Peça não encontrada.');

  const rede = redeDaPeca(peca.tipo);
  if (!rede) throw new Error(`Tipo de peça sem rede definida: ${peca.tipo}`);

  const texto = String(legendaResolvida ?? peca.legenda ?? '').trim();

  if (!consultorLiberado(peca.consultorId)) {
    throw new Error(
      `A publicação automática ainda é só do consultor israel (fase 1). `
      + `Esta peça é de "${peca.consultorId}" — abra o arquivo e publique à mão.`,
    );
  }

  if (peca.status !== 'aprovado') {
    throw new Error('Só peça aprovada vai ao ar. Aprove a peça antes de publicar.');
  }

  if (!texto) {
    throw new Error(
      rede === 'linkedin'
        ? 'Esta peça está sem o texto do LinkedIn. Gere ou escreva o texto antes de publicar.'
        : 'Esta peça está sem legenda. Gere ou escreva a legenda antes de publicar.',
    );
  }

  if (rede === 'instagram') {
    if (peca.tipo === 'carrossel-feed') {
      const slides = slidesDoCarrossel(peca);
      if (slides.length < CARROSSEL_MIN) {
        throw new Error(`O carrossel do Instagram precisa de pelo menos ${CARROSSEL_MIN} páginas (achei ${slides.length}).`);
      }
      if (slides.length > CARROSSEL_MAX) {
        throw new Error(`O carrossel do Instagram aceita no máximo ${CARROSSEL_MAX} páginas (achei ${slides.length}).`);
      }
    } else {
      if (!videoDaPeca(peca)) throw new Error('Não achei o vídeo (.mp4) desta peça.');
      // Capa obrigatória só no Reel falado: ali o primeiro quadro é o Israel de
      // boca aberta, ou uma transição preta, e o Instagram escolheria isso. No
      // carrossel em vídeo o primeiro quadro JÁ É o slide de capa, então não há
      // o que exigir — e exigir travava a peça sem motivo.
      if (peca.tipo === 'reel' && !capaDaPeca(peca)) {
        throw new Error(
          'O Reel está sem capa aprovada. Sem capa o Instagram escolhe um quadro '
          + 'qualquer do vídeo — muitas vezes uma transição preta.',
        );
      }
    }
  }

  if (rede === 'linkedin') {
    const arquivo = peca.tipo === 'linkedin-pdf' ? pdfDaPeca(peca) : imagemDaPeca(peca);
    if (!arquivo) throw new Error(`Não achei o arquivo da peça (${peca.tipo}).`);
  }

  return { rede, legenda: limitarLegenda(texto, LIMITE_LEGENDA[rede]) };
}

/**
 * Busca no banco o texto que acompanha a peça.
 *
 * Caminho: peça → campanha → criativo → textos. O texto fica no criativo porque
 * um criativo gera as cinco peças, e todas falam do mesmo assunto — repetir o
 * texto em cada peça deixaria as cinco livres para divergir.
 */
export async function legendaDaPeca(peca) {
  if (peca?.legenda?.trim()) return peca.legenda.trim();

  const rede = redeDaPeca(peca?.tipo);
  const campanha = peca?.campanhaId ? await lerCampanha(peca.campanhaId) : null;
  const criativo = campanha?.criativoId ? await lerCriativo(campanha.criativoId) : null;
  if (peca?.tipo === 'linkedin-texto' && criativo?.textos?.textoLinkedin?.trim()) {
    return criativo.textos.textoLinkedin.trim();
  }
  return escolherTexto(rede, criativo?.textos || {});
}

/* ===================== Acesso aos arquivos ===================== */

/**
 * Link temporário que a rede consegue baixar.
 *
 * O Instagram não recebe o arquivo: ele busca a URL que a gente informa. Por isso
 * precisa ser endereço público — e assinado, para não deixar a pasta da peça
 * aberta na internet. Seis horas cobrem a fila mais lenta de vídeo.
 */
export async function enderecoPublico(caminho) {
  const [url] = await bucket().file(caminho).getSignedUrl({
    action: 'read',
    expires: Date.now() + 6 * 60 * 60 * 1000,
  });
  return url;
}

async function baixarBytes(caminho) {
  const [buffer] = await bucket().file(caminho).download();
  return buffer;
}

/* ===================== Instagram ===================== */

function credenciaisInstagram() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const usuario = process.env.INSTAGRAM_USER_ID;
  if (!token || !usuario) {
    throw new Error('Faltam INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_USER_ID no servidor.');
  }
  return { token, usuario };
}

async function postarGraph(caminho, params) {
  const res = await fetch(`${IG_BASE}/${caminho}?${new URLSearchParams(params)}`, { method: 'POST' });
  const texto = await res.text();
  if (!res.ok) throw new Error(`Instagram recusou (${res.status}): ${texto.slice(0, 400)}`);
  return JSON.parse(texto);
}

/**
 * Espera o Instagram terminar de processar o container.
 *
 * Vídeo demora: ele baixa, transcodifica e só então aceita publicar. Publicar
 * antes de FINISHED devolve erro genérico que parece problema de permissão.
 */
async function esperarContainer(id, token, limiteMs) {
  const prazo = Date.now() + limiteMs;
  let ultimo = '';
  while (Date.now() < prazo) {
    const res = await fetch(`${IG_BASE}/${id}?${new URLSearchParams({ fields: 'status_code,status', access_token: token })}`);
    const dados = await res.json();
    ultimo = dados.status_code || '';
    if (ultimo === 'FINISHED') return;
    if (ultimo === 'ERROR') {
      throw new Error(`O Instagram não conseguiu processar o arquivo: ${dados.status || 'sem detalhe'}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`O Instagram passou do tempo processando (último estado: ${ultimo || 'desconhecido'}).`);
}

async function permalinkInstagram(postId, token) {
  try {
    const res = await fetch(`${IG_BASE}/${postId}?${new URLSearchParams({ fields: 'permalink', access_token: token })}`);
    if (!res.ok) return null;
    return (await res.json()).permalink ?? null;
  } catch {
    return null; // sem link não é motivo para dizer que a publicação falhou
  }
}

async function publicarCarrosselInstagram(peca, legenda, { token, usuario }) {
  const slides = slidesDoCarrossel(peca);
  const enderecos = await Promise.all(slides.map(enderecoPublico));

  const filhos = [];
  for (const url of enderecos) {
    const { id } = await postarGraph(`${usuario}/media`, {
      image_url: url, is_carousel_item: 'true', access_token: token,
    });
    filhos.push(id);
  }
  for (const id of filhos) await esperarContainer(id, token, 60_000);

  const { id: carrossel } = await postarGraph(`${usuario}/media`, {
    media_type: 'CAROUSEL', children: filhos.join(','), caption: legenda, access_token: token,
  });
  await esperarContainer(carrossel, token, 120_000);
  return carrossel;
}

async function publicarReelInstagram(peca, legenda, { token, usuario }) {
  const arquivoCapa = capaDaPeca(peca);
  const [video, capa] = await Promise.all([
    enderecoPublico(videoDaPeca(peca)),
    arquivoCapa ? enderecoPublico(arquivoCapa) : null,
  ]);
  const { id } = await postarGraph(`${usuario}/media`, {
    media_type: 'REELS',
    video_url: video,
    // Sem capa o Instagram usa o primeiro quadro, que no carrossel em vídeo é
    // justamente o slide de capa. Mandar cover_url vazio seria erro de parâmetro.
    ...(capa ? { cover_url: capa } : {}),
    caption: legenda,
    share_to_feed: 'true',
    access_token: token,
  });
  // Cinco minutos: o Instagram baixa e transcodifica o vídeo do zero.
  await esperarContainer(id, token, 5 * 60_000);
  return id;
}

export async function publicarNoInstagram(peca, legenda) {
  const credenciais = credenciaisInstagram();
  const container = peca.tipo === 'carrossel-feed'
    ? await publicarCarrosselInstagram(peca, legenda, credenciais)
    : await publicarReelInstagram(peca, legenda, credenciais);

  const { id: postId } = await postarGraph(`${credenciais.usuario}/media_publish`, {
    creation_id: container, access_token: credenciais.token,
  });
  const link = await permalinkInstagram(postId, credenciais.token);
  return { rede: 'instagram', postId, link };
}

/* ===================== Facebook (bônus do Instagram) ===================== */

/**
 * Credenciais da Página. Ao contrário do Instagram e do LinkedIn, a ausência
 * delas NÃO é erro — o cruzamento é opcional, e a peça vai para o Instagram
 * normalmente sem ele.
 */
function credenciaisFacebook() {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const paginaId = process.env.FACEBOOK_PAGE_ID;
  return token && paginaId ? { token, paginaId } : null;
}

async function permalinkFacebook(id, token) {
  try {
    const res = await fetch(`${IG_BASE}/${id}?${new URLSearchParams({ fields: 'permalink_url', access_token: token })}`);
    if (!res.ok) return null;
    return (await res.json()).permalink_url ?? null;
  } catch {
    return null;
  }
}

/**
 * O carrossel do feed vira um álbum de várias fotos num post só.
 *
 * O Graph API pede duas chamadas: cada foto sobe "despublicada" (não aparece
 * sozinha no mural) e devolve um id; o post do feed referencia todos esses ids
 * em `attached_media`. É o mesmo padrão de post multi-foto que qualquer
 * usuário cria pelo app do Facebook.
 */
async function publicarFotosFacebook(peca, legenda, { token, paginaId }) {
  const slides = slidesDoCarrossel(peca);
  const enderecos = await Promise.all(slides.map(enderecoPublico));

  const anexos = [];
  for (const url of enderecos) {
    const { id } = await postarGraph(`${paginaId}/photos`, { url, published: 'false', access_token: token });
    anexos.push({ media_fbid: id });
  }

  return postarGraph(`${paginaId}/feed`, {
    message: legenda,
    attached_media: JSON.stringify(anexos),
    access_token: token,
  });
}

/** Reel e carrossel em vídeo viram vídeo comum na Página. */
async function publicarVideoFacebook(peca, legenda, { token, paginaId }) {
  const video = await enderecoPublico(videoDaPeca(peca));
  return postarGraph(`${paginaId}/videos`, {
    file_url: video, description: legenda, access_token: token,
  });
}

/**
 * O cruzamento em si. Só é chamada depois que o Instagram já publicou — nunca
 * antes, e o resultado nunca desfaz o Instagram se der errado.
 */
async function publicarNoFacebook(peca, legenda, credenciais) {
  const { id } = peca.tipo === 'carrossel-feed'
    ? await publicarFotosFacebook(peca, legenda, credenciais)
    : await publicarVideoFacebook(peca, legenda, credenciais);
  const link = await permalinkFacebook(id, credenciais.token);
  return { postId: id, link };
}

/**
 * Tenta o cruzamento sem nunca lançar erro para quem chamou.
 *
 * Devolve null quando as credenciais não estão configuradas (silêncio: é
 * recurso opcional, não falta de alguma coisa). Devolve {status:'falhou'}
 * quando tentou e não conseguiu — o Instagram já foi ao ar, e isto é só um
 * registro para o consultor ver e, se quiser, postar à mão.
 */
export async function cruzarParaFacebookSeConfigurado(peca, legenda) {
  if (!deveCruzarParaFacebook(peca.tipo)) return null;
  const credenciais = credenciaisFacebook();
  if (!credenciais) return null;

  try {
    const { postId, link } = await publicarNoFacebook(peca, legenda, credenciais);
    return { status: 'publicada', postId, link, publicadoEm: new Date().toISOString(), erro: null };
  } catch (e) {
    return { status: 'falhou', erro: String(e?.message || e).slice(0, 500) };
  }
}

/* ===================== YouTube (bônus do Instagram) ===================== */

const YT_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3/videos';

/**
 * O YouTube usa OAuth, não uma chave fixa como o Instagram: o token de acesso
 * vence em 1 hora, e quem não vence é o REFRESH_TOKEN, obtido uma vez só (o
 * consultor autoriza no navegador dele) e guardado no servidor. Sem as três
 * variáveis, o cruzamento fica só desligado — nunca é erro.
 */
function credenciaisYoutube() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  return clientId && clientSecret && refreshToken ? { clientId, clientSecret, refreshToken } : null;
}

/** Troca o refresh token por um token de acesso de verdade. Um por publicação. */
async function tokenDeAcessoYoutube({ clientId, clientSecret, refreshToken }) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token',
    }),
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`Google recusou renovar o acesso ao YouTube (${res.status}): ${texto.slice(0, 400)}`);
  return JSON.parse(texto).access_token;
}

/**
 * Envio em duas etapas — é como a API do YouTube funciona, e não uma escolha
 * nossa: primeiro reserva o envio com os metadados (título, descrição), o
 * Google devolve um endereço só para os bytes, e só então o vídeo sobe.
 */
async function publicarNoYoutube(peca, legenda, credenciais) {
  const token = await tokenDeAcessoYoutube(credenciais);
  const caminho = videoDaPeca(peca);
  if (!caminho) throw new Error('Peça sem vídeo — não há o que enviar ao YouTube.');
  const bytes = await baixarBytes(caminho);

  // #Shorts na descrição é o sinal que o próprio YouTube usa, junto com o
  // formato vertical, para classificar como Short — não existe um campo à parte.
  const titulo = limitarLegenda(peca.titulo || legenda, 90) || 'Reel';
  const metadados = {
    snippet: { title: titulo, description: `${legenda}\n\n#Shorts`, categoryId: '27' }, // 27 = Education
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
  };

  const iniciar = await fetch(`${YT_UPLOAD_BASE}?uploadType=resumable&part=snippet,status`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(bytes.length),
    },
    body: JSON.stringify(metadados),
  });
  if (!iniciar.ok) throw new Error(`YouTube recusou iniciar o envio (${iniciar.status}): ${(await iniciar.text()).slice(0, 400)}`);
  const uploadUrl = iniciar.headers.get('location');
  if (!uploadUrl) throw new Error('O YouTube não devolveu o endereço de envio do vídeo.');

  const envio = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(bytes.length) },
    body: bytes,
  });
  const corpo = await envio.text();
  if (!envio.ok) throw new Error(`YouTube recusou o vídeo (${envio.status}): ${corpo.slice(0, 400)}`);
  const { id } = JSON.parse(corpo);
  return { postId: id, link: `https://youtube.com/shorts/${id}` };
}

/** Mesma forma do cruzamento do Facebook: silencioso sem credencial, nunca desfaz o Instagram. */
export async function cruzarParaYoutubeSeConfigurado(peca, legenda) {
  if (!deveCruzarParaYoutube(peca.tipo)) return null;
  const credenciais = credenciaisYoutube();
  if (!credenciais) return null;

  try {
    const { postId, link } = await publicarNoYoutube(peca, legenda, credenciais);
    return { status: 'publicada', postId, link, publicadoEm: new Date().toISOString(), erro: null };
  } catch (e) {
    return { status: 'falhou', erro: String(e?.message || e).slice(0, 500) };
  }
}

/* ===================== LinkedIn ===================== */

function credenciaisLinkedin() {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const pessoa = process.env.LINKEDIN_PERSON_ID;
  if (!token || !pessoa) {
    throw new Error('Faltam LINKEDIN_ACCESS_TOKEN e LINKEDIN_PERSON_ID no servidor.');
  }
  return { token, autor: `urn:li:person:${pessoa}` };
}

function cabecalhosLinkedin(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'LinkedIn-Version': LI_VERSAO,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };
}

/**
 * Reserva o espaço do arquivo no LinkedIn.
 *
 * Diferente do Instagram, aqui a gente ENVIA os bytes: o LinkedIn devolve uma
 * URL de upload e o identificador definitivo, que depois entra no post.
 */
async function iniciarUploadLinkedin(recurso, { token, autor }) {
  const res = await fetch(`${LI_BASE}/${recurso}?action=initializeUpload`, {
    method: 'POST',
    headers: cabecalhosLinkedin(token),
    body: JSON.stringify({ initializeUploadRequest: { owner: autor } }),
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`LinkedIn recusou o envio do arquivo (${res.status}): ${texto.slice(0, 400)}`);
  const valor = JSON.parse(texto).value || {};
  const urn = valor.image || valor.document || valor.video;
  if (!valor.uploadUrl || !urn) throw new Error('O LinkedIn não devolveu o endereço de envio do arquivo.');
  return { uploadUrl: valor.uploadUrl, urn };
}

async function enviarBytesLinkedin(uploadUrl, bytes, token) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Falha ao enviar o arquivo para o LinkedIn (${res.status}): ${(await res.text()).slice(0, 300)}`);
}

export async function publicarNoLinkedin(peca, legenda) {
  const credenciais = credenciaisLinkedin();
  const ehPdf = peca.tipo === 'linkedin-pdf';
  const caminho = ehPdf ? pdfDaPeca(peca) : imagemDaPeca(peca);

  const { uploadUrl, urn } = await iniciarUploadLinkedin(ehPdf ? 'documents' : 'images', credenciais);
  await enviarBytesLinkedin(uploadUrl, await baixarBytes(caminho), credenciais.token);

  // O título só existe no documento: é o nome que aparece na capa do PDF no feed.
  const midia = ehPdf ? { id: urn, title: limitarLegenda(peca.titulo || legenda, 100) } : { id: urn };

  const res = await fetch(`${LI_BASE}/posts`, {
    method: 'POST',
    headers: cabecalhosLinkedin(credenciais.token),
    body: JSON.stringify({
      author: credenciais.autor,
      commentary: legenda,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: midia },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn recusou a publicação (${res.status}): ${(await res.text()).slice(0, 400)}`);

  // O id do post vem no cabeçalho, não no corpo — o corpo volta vazio.
  const postId = res.headers.get('x-restli-id') || '';
  return {
    rede: 'linkedin',
    postId,
    link: postId ? `https://www.linkedin.com/feed/update/${postId}` : null,
  };
}

/* ===================== Porta de entrada ===================== */

/**
 * Publica uma peça já aprovada e devolve onde ela foi parar.
 *
 * Não grava nada no Firestore: quem chama decide o que registrar. Isso mantém
 * esta função testável sem banco e deixa o registro do post num lugar só.
 */
export async function publicarPeca(pecaOuId) {
  const peca = typeof pecaOuId === 'string' ? await lerPeca(pecaOuId) : pecaOuId;
  const { rede, legenda } = conferirPeca(peca, await legendaDaPeca(peca));

  const resultado = rede === 'instagram'
    ? await publicarNoInstagram(peca, legenda)
    : await publicarNoLinkedin(peca, legenda);

  // Facebook e YouTube só são tentados DEPOIS do Instagram estar no ar, e
  // nenhum dos dois pode desfazê-lo: se falharem aqui, o resultado principal
  // já aconteceu.
  const facebook = await cruzarParaFacebookSeConfigurado(peca, legenda);
  if (facebook) resultado.facebook = facebook;

  const youtube = await cruzarParaYoutubeSeConfigurado(peca, legenda);
  if (youtube) resultado.youtube = youtube;

  return resultado;
}
