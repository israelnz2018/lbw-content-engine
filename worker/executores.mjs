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
import { gravarPeca, atualizarCampanha, lerCampanha, lerCriativo, lerPeca } from './firestore.mjs';
import {
  resolverImagensDoRender, imagensPorPagina, registrarUso, prepararImagem as prepararImagemDaBiblioteca,
} from './imagens.mjs';
import { publicarPeca, redeDaPeca } from './publicar.mjs';
import { jaSaiu } from './agenda.mjs';

const execFileAsync = promisify(execFile);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RENDERIZADORES = {
  carrossel: path.join(raiz, 'squads/lbw-carousel-production/automation/render-carousel.mjs'),
  linkedin: path.join(raiz, 'squads/lbw-linkedin-production/automation/render-linkedin.mjs'),
  reel: path.join(raiz, 'squads/lbw-reel-production/automation/render-reel.mjs'),
  legenda: path.join(raiz, 'squads/lbw-reel-production/automation/gerar-legenda-karaoke.mjs'),
  capa: path.join(raiz, 'squads/lbw-reel-production/automation/render-reel-cover.mjs'),
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

async function renderizarTextoLinkedin({ campanha, criativoId, texto, temp, tipoStorage, versao = 1 }) {
  const frase = String(texto || '').trim();
  if (!frase) return null;
  const configPath = path.join(temp, `config-texto-linkedin-${versao}.json`);
  const slug = `${campanha.id || campanha.titulo || criativoId}-texto-linkedin`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '').slice(0, 70);
  const date = new Date().toISOString().slice(0, 10);
  const quoteScale = Math.min(1, Math.max(0.58, 62 / Math.max(1, frase.split(/\s+/).length)));
  fs.writeFileSync(configPath, JSON.stringify({
    date,
    slug,
    formato: 'quadrado',
    layout: 'citacao',
    frase,
    quoteScale,
    post: frase,
    outputRoot: temp,
  }, null, 2), 'utf8');
  await rodarRenderizador(RENDERIZADORES.linkedin, configPath);
  const raizSaida = path.join(temp, 'LINKEDIN');
  const pastaTexto = path.join(raizSaida, `${date}__${slug}`);
  const pastas = fs.existsSync(pastaTexto) ? [pastaTexto] : [];
  if (!pastas.length) throw new Error('O renderizador do Texto do LinkedIn nÃ£o entregou a imagem.');
  const caminhos = await enviarPasta(pastaTexto, {
    consultorId: campanha.consultorId,
    campanhaId: campanha.id,
    tipo: tipoStorage,
  });
  const imagem = caminhos.find((c) => /\.png$/i.test(c)) || caminhos.find((c) => /\.(jpe?g)$/i.test(c));
  if (!imagem) throw new Error('O Texto do LinkedIn nÃ£o produziu uma imagem.');
  return { caminhos, imagem, frase };
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

    // As imagens escolhidas na biblioteca chegam como id; o renderizador recebe o
    // endereço delas.
    const { render, usos } = await resolverImagensDoRender(tarefa.render || {}, consultorId);
    const renderConfig = { ...render, outputRoot: temp };

    const configPath = path.join(temp, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(renderConfig, null, 2), 'utf8');

    const resultado = await rodarRenderizador(RENDERIZADORES.carrossel, configPath);
    const porPagina = imagensPorPagina(resultado?.pessoas, usos);
    await registrarUso(porPagina).catch((e) => console.warn(`aviso: uso das imagens não registrado (${e.message})`));

    // CADA PRODUÇÃO VAI PARA UMA PASTA NOVA.
    //
    // Antes as páginas eram gravadas sempre no mesmo caminho — .../feed/slide-05.png.
    // O endereço do Storage não muda quando o arquivo é sobrescrito, então o
    // navegador continuava mostrando a versão em cache: o consultor tirava a pessoa
    // de uma página, mandava refazer, a produção rodava certo e a tela exibia a
    // imagem de antes. De fora, "o botão não fez nada" — o mesmo engano que já
    // tinha custado caro na capa do Reel.
    //
    // O carimbo de tempo no caminho resolve sem depender de cabeçalho de cache nem
    // de o consultor saber dar refresh forçado.
    const versaoDaProducao = Date.now();
    const pecas = [];
    let paginasFeed = [];
    for (const tipo of ['FEED', 'REELS', 'LINKEDIN']) {
      const pasta = path.join(temp, tipo);
      if (!fs.existsSync(pasta)) continue;

      // Dentro de cada tipo há uma pasta por campanha.
      for (const sub of fs.readdirSync(pasta)) {
        const caminhos = await enviarPasta(path.join(pasta, sub), {
          consultorId, campanhaId, tipo: `${tipo.toLowerCase()}/v${versaoDaProducao}`,
        });
        if (!caminhos.length) continue;

        if (tipo === 'FEED') {
          paginasFeed = caminhos
            .filter((c) => /slide-\d+\.png$/i.test(c))
            .sort((a, b) => a.localeCompare(b));
        }

        // O LinkedIn publica o PDF, mas a tela precisa dos PNGs para mostrar e
        // editar cada página. Na produção inicial eles são os mesmos do feed.
        const arquivosDaPeca = tipo === 'LINKEDIN'
          ? [...caminhos, ...paginasFeed]
          : caminhos;
        const arquivoPrincipal = tipo === 'LINKEDIN'
          ? caminhos.find((c) => /\.pdf$/i.test(c)) || escolherPrincipal(caminhos)
          : escolherPrincipal(caminhos);

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
          arquivoUrl: arquivoPrincipal,
          arquivos: arquivosDaPeca,
          // Guardamos o roteiro original, com os ids da biblioteca. `render`
          // contém URLs temporárias usadas apenas durante esta execução.
          roteiro: tarefa.render?.slides || [],
          imagensPorPagina: porPagina,
          criadoEm: new Date().toISOString(),
        };
        await gravarPeca(peca);
        pecas.push(peca);

        // A IMAGEM ÚNICA DO LINKEDIN é a capa do carrossel, mas é uma peça: tem
        // aprovação própria e lugar na Publicação, como as outras. A cada produção
        // ela volta para revisão com a capa nova, igual ao carrossel de onde sai.
        if (tipo === 'FEED') {
          const capa = caminhos.filter((c) => /slide-\d+\.png$/i.test(c)).sort()[0];
          if (capa) {
            const imagemUnica = {
              id: `${campanhaId}__linkedin-imagem`,
              consultorId,
              campanhaId,
              tipo: 'linkedin-imagem',
              status: 'revisar',
              versao: 1,
              arquivoUrl: capa,
              arquivos: [capa],
              criadoEm: new Date().toISOString(),
            };
            await gravarPeca(imagemUnica);
            pecas.push(imagemUnica);
          }
        }
      }
    }

    // O texto do LinkedIn nasce da mesma copy aprovada e entra na mesma produção.
    // Assim ele não depende de uma ação posterior em "Minhas peças".
    const criativo = tarefa.criativoId ? await lerCriativo(tarefa.criativoId) : null;
    const textoLinkedin = String(criativo?.textos?.textoLinkedin || '').trim();
    if (textoLinkedin) {
      const textoRenderizado = await renderizarTextoLinkedin({
        campanha,
        criativoId: tarefa.criativoId,
        texto: textoLinkedin,
        temp,
        tipoStorage: `linkedin-texto/v${versaoDaProducao}`,
      });
      const textoPeca = {
        id: `${campanhaId}__linkedin-texto`,
        consultorId,
        campanhaId,
        tipo: 'linkedin-texto',
        status: 'revisar',
        versao: 1,
        arquivoUrl: textoRenderizado.imagem,
        arquivos: textoRenderizado.caminhos,
        texto: textoRenderizado.frase,
        legenda: textoRenderizado.frase,
        criadoEm: new Date().toISOString(),
      };
      await gravarPeca(textoPeca);
      pecas.push(textoPeca);
    }

    // Quem da biblioteca apareceu em cada página vai para a campanha — só quando
    // alguma imagem da biblioteca foi usada. Carrossel sem escolha grava o mesmo de
    // sempre.
    await atualizarCampanha(campanhaId, {
      status: 'revisar',
      ...(porPagina.some(Boolean) ? { imagensPorPagina: porPagina } : {}),
    });
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
  const campanha = await lerCampanha(campanhaId);
  const peca = await lerPeca(pecaId);
  if (!peca) throw new Error(`Peça ${pecaId} não existe.`);

  const temp = pastaTemporaria('peca');

  try {
    await gravarPeca({ ...peca, status: 'gerando' });

    const ehTextoLinkedin = peca.tipo === 'linkedin-texto';
    const { render, usos } = ehTextoLinkedin
      ? { render: tarefa.render || {}, usos: [] }
      : await resolverImagensDoRender(tarefa.render || {}, consultorId);
    const renderConfig = { ...render, outputRoot: temp };

    let resultado = null;
    let porPagina = [];
    if (!ehTextoLinkedin) {
      const configPath = path.join(temp, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(renderConfig, null, 2), 'utf8');
      const script = peca.tipo === 'linkedin-pdf' && renderConfig.layout
        ? RENDERIZADORES.linkedin
        : RENDERIZADORES.carrossel;
      resultado = await rodarRenderizador(script, configPath);
      porPagina = imagensPorPagina(resultado?.pessoas, usos);
    }
    await registrarUso(porPagina).catch((e) => console.warn(`aviso: uso das imagens não registrado (${e.message})`));

    const novaVersao = (peca.versao || 1) + 1;
    async function subirTipo(tipo) {
      const caminhos = [];
      const pasta = path.join(temp, tipo);
      if (!fs.existsSync(pasta)) return caminhos;
      for (const sub of fs.readdirSync(pasta)) {
        caminhos.push(...await enviarPasta(path.join(pasta, sub), {
          consultorId, campanhaId, tipo: `${tipo.toLowerCase()}-v${novaVersao}`,
        }));
      }
      return caminhos;
    }

    let caminhos = [];
    let arquivoPrincipal = null;
    if (peca.tipo === 'linkedin-texto') {
      const criativo = tarefa.criativoId
        ? await lerCriativo(tarefa.criativoId)
        : await lerCriativo(campanha?.criativoId);
      const texto = String(tarefa.render?.frase || criativo?.textos?.textoLinkedin || peca.texto || '').trim();
      const renderizado = await renderizarTextoLinkedin({
        campanha: { ...(campanha || {}), id: campanhaId, consultorId },
        criativoId: tarefa.criativoId,
        texto,
        temp,
        tipoStorage: `linkedin-texto-v${novaVersao}`,
        versao: novaVersao,
      });
      if (!renderizado) throw new Error('O Texto do LinkedIn está sem conteúdo para renderizar.');
      caminhos = renderizado.caminhos;
      arquivoPrincipal = renderizado.imagem;
      peca.texto = renderizado.frase;
      peca.legenda = renderizado.frase;
    } else if (peca.tipo === 'carrossel-feed') {
      caminhos = await subirTipo('FEED');
      arquivoPrincipal = escolherPrincipal(caminhos);
    } else if (peca.tipo === 'linkedin-pdf') {
      const documentos = await subirTipo('LINKEDIN');
      const paginas = await subirTipo('FEED');
      caminhos = [...documentos, ...paginas];
      arquivoPrincipal = documentos.find((c) => /\.pdf$/i.test(c)) || escolherPrincipal(documentos);
    } else if (peca.tipo === 'carrossel-video') {
      caminhos = await subirTipo('REELS');
      arquivoPrincipal = caminhos.find((c) => /\.mp4$/i.test(c)) || escolherPrincipal(caminhos);
    } else {
      throw new Error(`A peça ${peca.tipo} não pode ser refeita pelo renderizador de carrossel.`);
    }

    if (!caminhos.length) throw new Error(`O renderizador não entregou arquivos para ${peca.tipo}.`);

    await gravarPeca({
      ...peca,
      status: 'revisar',
      versao: novaVersao,
      arquivoUrl: arquivoPrincipal || peca.arquivoUrl,
      arquivos: caminhos,
      roteiro: tarefa.render?.slides || peca.roteiro || [],
      imagensPorPagina: porPagina,
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
    // A velocidade vai junto: se o Reel é acelerado e a legenda não sabe disso,
    // ela dessincroniza da fala do primeiro segundo em diante.
    fs.writeFileSync(entradaLegenda, JSON.stringify({
      clipStartMs: render.clipStartMs,
      clipEndMs: render.clipEndMs,
      velocidade: render.speed ?? 1,
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
    // O REEL E A CAPA SÃO PEÇAS INDEPENDENTES.
    //
    // Refazer o Reel desenhava a capa de novo e gravava por cima — o consultor
    // aprovava a capa, mudava a velocidade do vídeo e perdia a capa aprovada. Agora
    // a capa que já existe fica, com a aprovação dela. A capa que o Reel desenha só
    // é usada quando ainda não há nenhuma; para mudar a capa existe o Refazer dela.
    const anterior = await lerPeca(pecaId);
    const capaNova = caminhos.find((c) => /capa\.jpe?g$/i.test(c)) || null;
    const capaUrl = anterior?.capaUrl || capaNova;
    await gravarPeca({
      id: pecaId,
      consultorId,
      campanhaId,
      tipo: 'reel',
      status: 'revisar',
      versao: 1,
      arquivoUrl: caminhos.find((c) => c.endsWith('.mp4')) || escolherPrincipal(caminhos),
      capaUrl,
      capaStatus: anterior?.capaUrl ? (anterior.capaStatus || 'revisar') : 'revisar',
      arquivos: [...new Set([...caminhos, ...(capaUrl ? [capaUrl] : [])])],
      criadoEm: new Date().toISOString(),
    });

    await atualizarCampanha(campanhaId, { status: 'revisar' }).catch(() => {});
    return { pecas: 1, segundos: resultado?.durationSeconds, arquivos: caminhos.length };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/**
 * Refaz SÓ a capa do Reel.
 *
 * Trocar uma palavra do gancho não pode custar um Reel inteiro: o corte do vídeo
 * leva perto de um minuto e baixa o trecho de novo. Aqui sai do vídeo apenas UM
 * QUADRO — por requisição parcial, alguns kilobytes — e o resto é desenho em HTML.
 *
 * A capa sobe com um nome novo a cada versão. Sobrescrever `capa.jpg` deixaria o
 * navegador mostrando a imagem velha do cache, e o consultor concluiria que o botão
 * não funcionou — que é exatamente o tipo de dúvida que este projeto já teve demais.
 */
export async function gerarCapa(tarefa) {
  const { consultorId, campanhaId } = tarefa;
  const render = tarefa.render || {};
  if (!render.sourceVideo) throw new Error('A tarefa não trouxe o endereço do vídeo.');
  if (!render.cover) throw new Error('A tarefa não trouxe o desenho da capa.');

  const temp = pastaTemporaria('capa');
  try {
    // A capa tem o PRÓPRIO estado de trabalho. Marcar a campanha do Reel como
    // "processando" travava o Reel inteiro na tela enquanto só a capa era refeita.
    await atualizarCampanha(campanhaId, { capaStatus: 'processando', capaErro: null }).catch(() => {});

    // 1. O retrato, tirado do vídeo.
    const retrato = path.join(temp, 'retrato.png');
    const r = render.recorte || {};
    const cabecalhos = render.sourceHeaders
      ? `${Object.entries(render.sourceHeaders).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n`
      : null;
    await execFileAsync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      ...(cabecalhos ? ['-headers', cabecalhos] : []),
      '-ss', String(render.retratoEm), '-i', render.sourceVideo,
      '-frames:v', '1',
      '-vf', `crop=${r.width}:${r.height}:${r.x}:${r.y},scale=900:950:flags=lanczos`,
      '-update', '1', retrato,
    ], { timeout: 3 * 60 * 1000 });
    if (!fs.existsSync(retrato)) throw new Error('Não consegui extrair o retrato do vídeo.');

    // 2. A arte.
    const saidaDir = path.join(temp, 'saida');
    fs.mkdirSync(saidaDir, { recursive: true });
    const versao = Date.now();
    const arquivoCapa = path.join(saidaDir, `capa-${versao}.jpg`);
    const configCapa = path.join(temp, 'config-capa.json');
    fs.writeFileSync(configCapa, JSON.stringify({
      cover: render.cover,
      logoPath: path.join(raiz, 'assets/marca/logo-lbw-branca.png'),
    }, null, 2), 'utf8');

    await execFileAsync('node', [
      RENDERIZADORES.capa,
      '--config', configCapa, '--portrait', retrato, '--output', arquivoCapa,
    ], { maxBuffer: 8 * 1024 * 1024, timeout: 3 * 60 * 1000 });
    if (!fs.existsSync(arquivoCapa)) throw new Error('A capa não foi gerada.');

    // 3. Sobe e aponta a peça para ela.
    const caminhos = await enviarPasta(saidaDir, { consultorId, campanhaId, tipo: 'reel' });
    const nova = caminhos.find((c) => /capa-\d+\.jpe?g$/i.test(c));
    if (!nova) throw new Error('A capa não subiu.');

    const pecaId = `${campanhaId}__reel`;
    const peca = await lerPeca(pecaId);
    if (peca) {
      await gravarPeca({
        ...peca,
        capaUrl: nova,
        // Capa nova volta para revisão; o Reel continua como estava.
        capaStatus: 'revisar',
        arquivos: [...new Set([...(peca.arquivos || []), nova])],
        atualizadoEm: new Date().toISOString(),
      });
    }

    await atualizarCampanha(campanhaId, { capaStatus: 'pronta', capaErro: null }).catch(() => {});
    return { capa: nova };
  } catch (e) {
    // Na última tentativa a tela precisa saber que falhou, e não ficar girando.
    if ((tarefa.tentativas || 0) >= 3) {
      await atualizarCampanha(campanhaId, {
        capaStatus: 'erro',
        capaErro: String(e?.message || e).slice(0, 300),
      }).catch(() => {});
    }
    throw e;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/**
 * Uma página só do carrossel, para a prévia de uma imagem candidata.
 *
 * Sem PDF e sem vídeo: é para o consultor julgar a imagem NA página, e isso custa
 * dois segundos em vez do minuto da produção inteira.
 */
async function renderizarPagina(render, pagina, temp) {
  const saida = path.join(temp, `previa-${pagina}`);
  const configPath = path.join(temp, `previa-${pagina}.json`);
  fs.writeFileSync(configPath, JSON.stringify({
    ...render,
    somentePagina: pagina,
    video: { enabled: false },
    outputRoot: saida,
  }, null, 2), 'utf8');
  const resultado = await rodarRenderizador(RENDERIZADORES.carrossel, configPath);
  const png = resultado?.pngPaths?.[0];
  return png && fs.existsSync(png) ? png : null;
}

/**
 * Deixa pronta uma imagem da biblioteca: gerada pela IA ou enviada pelo consultor.
 *
 * Pessoa perde o fundo; cena só é ajustada. Quando a imagem nasceu para uma página,
 * a página sai montada com ela — é o que o consultor aprova.
 */
export async function prepararImagem(tarefa) {
  const temp = pastaTemporaria('imagem');
  try {
    return await prepararImagemDaBiblioteca(tarefa, {
      temp,
      renderizarPagina: (render, pagina) => renderizarPagina(render, pagina, temp),
    });
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/**
 * Publica a peça na rede dela.
 *
 * Duas decisões que valem explicação:
 *
 * 1. NÃO propaga o erro. Todas as outras tarefas relançam, e a fila tenta três
 *    vezes. Aqui isso é perigoso: se a falha aconteceu DEPOIS do post entrar no
 *    ar (ao buscar o link, por exemplo), a segunda tentativa publicaria de novo.
 *    Então a falha é registrada na peça e a tarefa termina. Quem manda tentar de
 *    novo é o consultor, olhando o motivo.
 *
 * 2. Marca `publicando` antes de começar. É o que impede o relógio de enfileirar
 *    a mesma peça outra vez enquanto o Instagram ainda processa o vídeo — o que
 *    pode levar minutos.
 */
export async function publicar(tarefa) {
  const peca = await lerPeca(tarefa.pecaId);
  if (!peca) throw new Error(`Peça ${tarefa.pecaId} não existe.`);

  if (jaSaiu(peca)) {
    return { pecaId: peca.id, ignorada: 'já publicada' };
  }

  await gravarPeca({
    id: peca.id,
    publicacao: { ...(peca.publicacao || {}), status: 'publicando', erro: null, tentadoEm: new Date().toISOString() },
  });

  try {
    const { rede, postId, link, facebook } = await publicarPeca(peca);
    await gravarPeca({
      id: peca.id,
      status: 'publicado',
      publicacao: {
        rede,
        status: 'publicada',
        postId,
        link: link || null,
        publicadoEm: new Date().toISOString(),
        erro: null,
        // Só grava a chave quando houve tentativa — undefined derrubaria a
        // gravação inteira, e a maioria das peças (LinkedIn) nem cruza.
        ...(facebook ? { facebook } : {}),
      },
    });
    return { pecaId: peca.id, rede, postId, link, facebook: facebook?.status };
  } catch (e) {
    const motivo = String(e?.message || e).slice(0, 500);
    await gravarPeca({
      id: peca.id,
      publicacao: {
        ...(peca.publicacao || {}),
        rede: redeDaPeca(peca.tipo),
        status: 'falhou',
        erro: motivo,
        falhouEm: new Date().toISOString(),
      },
    });
    return { pecaId: peca.id, falhou: motivo };
  }
}

export const EXECUTORES = {
  'gerar-campanha': gerarCampanha,
  'regerar-peca': regerarPeca,
  'gerar-reel': gerarReel,
  'gerar-capa': gerarCapa,
  'preparar-imagem': prepararImagem,
  'publicar': publicar,
};
