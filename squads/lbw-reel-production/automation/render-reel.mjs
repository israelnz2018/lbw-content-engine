/**
 * Renderiza o Reel falado: o consultor aparecendo, cortado da aula, com legenda karaokê.
 *
 * Porte em Node do render-reel.ps1, que só roda em Windows. O worker vive num
 * container Linux, e PowerShell lá seria um terceiro runtime na corrente só pra
 * executar três chamadas de ffmpeg. O .ps1 continua existindo e funcionando na
 * máquina do Israel — este arquivo não o substitui, roda ao lado.
 *
 * O QUE FOI COPIADO LITERALMENTE, e não deve ser "melhorado" sem medir:
 *   - o grafo de filtros do ffmpeg, incluindo o setpts (ver comentário abaixo)
 *   - os números do layout
 *   - a normalização de áudio (loudnorm)
 *   - as travas de segurança do corte
 *
 * O QUE MUDOU, por obrigação:
 *   - a fonte: Arial do Windows -> Liberation Sans Bold, que é metricamente
 *     compatível e é a que o container tem (fonts-liberation no Dockerfile)
 *   - a fonte do vídeo pode ser uma URL: o ffmpeg busca só o trecho por range
 *     HTTP, então cortar 36s de uma aula de 1h baixa 1,3 MB em vez de 140 MB
 *
 * Uso: node render-reel.mjs config.json
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const raizProjeto = path.resolve(scriptDir, '..', '..', '..');

const configPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!configPath || !fs.existsSync(configPath)) throw new Error('Informe um arquivo JSON de configuração existente.');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

/* ── Fonte de texto ────────────────────────────────────────── */

// A Liberation Sans Bold tem as mesmas métricas da Arial Bold: o texto ocupa o
// mesmo espaço, então o layout não se desloca. No Windows, cai na Arial mesmo.
const FONTES_POSSIVEIS = [
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  'C:/Windows/Fonts/arialbd.ttf',
];
const fonte = FONTES_POSSIVEIS.find((f) => fs.existsSync(f));
if (!fonte) throw new Error(`Nenhuma fonte em negrito encontrada. Procurei em:\n  ${FONTES_POSSIVEIS.join('\n  ')}`);

/** Escapa um caminho para uso DENTRO de um filtro do ffmpeg. */
function caminhoParaFiltro(p) {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

/** "00:07:39.500" ou 459.5 -> milissegundos. */
function paraMilissegundos(valor) {
  if (typeof valor === 'number') return Math.round(valor * 1000);
  const partes = String(valor).split(':').map(Number);
  if (partes.some((n) => !Number.isFinite(n))) throw new Error(`Tempo inválido: ${valor}`);
  const [h, m, s] = partes.length === 3 ? partes : [0, ...partes];
  return Math.round((h * 3600 + m * 60 + s) * 1000);
}

function paraTempoFfmpeg(ms) {
  const total = ms / 1000;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

/* ── Travas do corte ───────────────────────────────────────── */

const inicioMs = paraMilissegundos(config.clipStart);
const fimMs = paraMilissegundos(config.clipEnd);
if (fimMs <= inicioMs) throw new Error('O fim do corte deve ser posterior ao início.');

// As mesmas conferências do .ps1: elas existem porque corte que começa no meio de
// uma palavra, ou que corta a última sílaba, estraga o Reel de um jeito que só se
// percebe assistindo — e aí já foi publicado.
const folgaMinimaMs = Number(config.minimumTailMs ?? 100);
const diferencaMaximaMs = Number(config.maximumStartDifferenceMs ?? 100);
if (config.firstWordStart !== undefined) {
  const primeiraMs = paraMilissegundos(config.firstWordStart);
  if (Math.abs(primeiraMs - inicioMs) > diferencaMaximaMs) {
    throw new Error(`Início inseguro: o corte está a ${Math.abs(primeiraMs - inicioMs)} ms da primeira palavra (o limite é ${diferencaMaximaMs}).`);
  }
}
if (config.lastWordEnd !== undefined) {
  const ultimaMs = paraMilissegundos(config.lastWordEnd);
  if (fimMs < ultimaMs + folgaMinimaMs) {
    throw new Error(`Fim inseguro: faltam ${folgaMinimaMs} ms de folga depois da última palavra.`);
  }
}
if (config.nextWordStart !== undefined && config.nextWordStart !== null) {
  const proximaMs = paraMilissegundos(config.nextWordStart);
  if (fimMs >= proximaMs) throw new Error('Fim inseguro: o corte alcança a primeira palavra da frase seguinte.');
}

const duracaoSegundos = Number(((fimMs - inicioMs) / 1000).toFixed(3));

/* ── Velocidade ────────────────────────────────────────────── */

// Acelerar a fala um pouco é técnica de Reels, não capricho: 1,1x tira o arrasto
// das pausas sem soar robótico, e o Instagram premia quem segura a atenção.
//
// Quem acelera o vídeo é o setpts; quem acelera o áudio é o atempo, que muda o
// RITMO sem mexer no TOM — a voz continua sendo a mesma voz. A legenda karaokê
// encolhe junto, e isso se resolve antes, na geração do .ass, porque o filtro
// subtitles roda depois do setpts e já enxerga o tempo comprimido.
//
// O intervalo: acima de 1,5x a fala deixa de se entender; abaixo de 0,8x arrasta.
// Fora disso é erro de configuração, e erro de configuração grita em vez de
// produzir um Reel impublicável em silêncio.
const velocidade = Number(config.speed ?? 1);
if (!Number.isFinite(velocidade) || velocidade < 0.8 || velocidade > 1.5) {
  throw new Error(`Velocidade fora do intervalo aceito (0,8x a 1,5x): ${config.speed}`);
}
// A duração do que SAI, que é diferente da duração do trecho quando há aceleração.
const duracaoSaidaSegundos = Number((duracaoSegundos / velocidade).toFixed(3));

/* ── Entradas e saídas ─────────────────────────────────────── */

function resolverEntrada(valor, rotulo) {
  if (!valor) throw new Error(`${rotulo} não informado.`);
  // URL passa direto: o ffmpeg busca por range HTTP e baixa só o trecho pedido.
  if (/^https?:\/\//i.test(valor)) return valor;
  const absoluto = path.isAbsolute(valor) ? valor : path.resolve(path.dirname(configPath), valor);
  if (!fs.existsSync(absoluto)) throw new Error(`${rotulo} não encontrado: ${absoluto}`);
  return absoluto;
}

const fonteVideo = resolverEntrada(config.sourceVideo, 'Vídeo-fonte');
const logo = resolverEntrada(
  config.logoPath || path.join(raizProjeto, 'assets/marca/logo-lbw-branca.png'),
  'Logo oficial',
);
const legendaAss = resolverEntrada(config.captionsAss, 'Legenda ASS');

const saida = path.resolve(config.outputPath);
fs.mkdirSync(path.dirname(saida), { recursive: true });
const trabalho = config.workDir ? path.resolve(config.workDir) : fs.mkdtempSync(path.join(os.tmpdir(), 'lbw-reel-'));
fs.mkdirSync(trabalho, { recursive: true });

/* ── Textos do cabeçalho ───────────────────────────────────── */

// Vão em arquivo, e não inline, porque acento e aspas dentro de drawtext exigem
// uma escapada que muda conforme o sistema. Com textfile, o ffmpeg lê UTF-8 direto.
const arquivoTitulo1 = path.join(trabalho, 'title-line-1.txt');
const arquivoTitulo2 = path.join(trabalho, 'title-line-2.txt');
const arquivoMarca = path.join(trabalho, 'brand.txt');
fs.writeFileSync(arquivoTitulo1, String(config.titleLine1 ?? ''), 'utf8');
fs.writeFileSync(arquivoTitulo2, String(config.titleLine2 ?? ''), 'utf8');
fs.writeFileSync(arquivoMarca, String(config.brandText ?? ''), 'utf8');

/* ── O grafo de filtros ────────────────────────────────────── */

const L = config.layout;
if (!L) throw new Error('Informe o bloco "layout" na configuração.');

const f = caminhoParaFiltro(fonte);
// A 1x a expressão fica LITERALMENTE a de antes, sem divisão nenhuma: o caminho
// normal continua sendo o caminho que já foi medido.
const setpts = velocidade === 1 ? 'setpts=PTS-STARTPTS' : `setpts=(PTS-STARTPTS)/${velocidade}`;
const filtro = [
  // NAO REMOVER o setpts=PTS-STARTPTS das duas ramificacoes abaixo.
  // O filtro color gera o fundo a partir do tempo zero, mas a fonte entra com -ss antes
  // do -i e so entrega o primeiro quadro alguns milissegundos depois. Sem o setpts, o
  // overlay fica sem nada para sobrepor nesse intervalo e o primeiro quadro sai pelado:
  // aparecem so o drawbox cinza e a barra azul sobre o fundo, sem slide e sem professor.
  // Como o Reel roda em laco no Instagram, esse quadro pisca a cada volta.
  // Sintoma no arquivo: o quadro em t=0 fica ~4x menor que os seguintes (197 KB contra 830 KB).
  `[0:v]${setpts},scale=${L.slideWidth}:${L.slideHeight}:flags=lanczos[top]`,
  `[0:v]${setpts},crop=${L.faceCropWidth}:${L.faceCropHeight}:${L.faceCropX}:${L.faceCropY},scale=${L.faceOutputWidth}:${L.faceOutputHeight}:flags=lanczos[face]`,
  `color=c=0xF3F7FC:s=1080x1920:r=30[canvas]`,
  `[canvas][top]overlay=${L.slideX}:${L.slideY}[tmp1]`,
  `[tmp1]drawbox=x=${L.coverX}:y=${L.coverY}:w=${L.coverWidth}:h=${L.coverHeight}:color=${L.coverColor}:t=fill,drawbox=x=${L.slideX}:y=${L.slideBarY}:w=${L.slideWidth}:h=${L.slideBarHeight}:color=0x202D70:t=fill[tmpclean]`,
  `[tmpclean][face]overlay=${L.faceX}:${L.faceY}[tmp2]`,
  `[tmp2]drawbox=x=0:y=0:w=1080:h=105:color=0x062B61:t=fill[head]`,
  `[1:v]scale=60:60[logo]`,
  `[head][logo]overlay=40:20[branded]`,
  `[branded]drawtext=fontfile='${f}':textfile='${caminhoParaFiltro(arquivoMarca)}':fontcolor=white:fontsize=33:x=120:y=36:expansion=none,`
  + `drawtext=fontfile='${f}':textfile='${caminhoParaFiltro(arquivoTitulo1)}':fontcolor=0x0757FF:fontsize=70:x=(w-text_w)/2:y=135:expansion=none,`
  + `drawtext=fontfile='${f}':textfile='${caminhoParaFiltro(arquivoTitulo2)}':fontcolor=0x062B61:fontsize=70:x=(w-text_w)/2:y=215:expansion=none,`
  + `subtitles='${caminhoParaFiltro(legendaAss)}'[outv]`,
].join(';\n');

/* ── Render ────────────────────────────────────────────────── */

const temporario = path.join(trabalho, 'render-validacao.mp4');
// -ss ANTES do -i: é o que faz o ffmpeg pular direto pro trecho em vez de decodificar
// desde o começo. Com fonte em URL, vira requisição parcial e baixa só o pedaço.
const cabecalhos = config.sourceHeaders
  ? Object.entries(config.sourceHeaders).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n'
  : null;

const argumentos = [
  '-y', '-hide_banner', '-loglevel', 'error',
  ...(cabecalhos ? ['-headers', cabecalhos] : []),
  '-ss', paraTempoFfmpeg(inicioMs), '-t', String(duracaoSegundos), '-i', fonteVideo,
  '-loop', '1', '-i', logo,
  '-filter_complex', filtro,
  '-map', '[outv]', '-map', '0:a:0?',
  '-t', String(duracaoSaidaSegundos),
  // atempo ANTES do loudnorm: normalizar o volume depois de mudar o ritmo mede o
  // áudio que de fato vai sair.
  '-af', velocidade === 1
    ? 'loudnorm=I=-16:TP=-1.5:LRA=11'
    : `atempo=${velocidade},loudnorm=I=-16:TP=-1.5:LRA=11`,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
  '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'aac', '-ar', '48000', '-b:a', '128k',
  '-movflags', '+faststart',
  temporario,
];

try {
  execFileSync('ffmpeg', argumentos, { stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  throw new Error(`A renderização falhou: ${String(e.stderr || e.message).slice(0, 600)}`);
}
if (!fs.existsSync(temporario)) throw new Error('A renderização não produziu arquivo.');

/* ── Validação técnica ─────────────────────────────────────── */

// Conferir aqui é barato; descobrir depois que o Reel saiu mudo, ou fora de 9:16,
// custa uma publicação.
const sonda = JSON.parse(execFileSync('ffprobe', [
  '-v', 'error',
  '-show_entries', 'format=duration:stream=codec_type,width,height',
  '-of', 'json', temporario,
], { encoding: 'utf8' }));

const fluxoVideo = sonda.streams.find((s) => s.codec_type === 'video');
const fluxoAudio = sonda.streams.find((s) => s.codec_type === 'audio');
if (!fluxoVideo || fluxoVideo.width !== 1080 || fluxoVideo.height !== 1920) {
  throw new Error(`A saída não está em 1080x1920 (veio ${fluxoVideo?.width}x${fluxoVideo?.height}).`);
}
if (!fluxoAudio) throw new Error('A saída foi gerada sem áudio.');

/* ── Capa ──────────────────────────────────────────────────── */

// A capa sai de um quadro do PRIMEIRO TERÇO. O Instagram usa a capa como miniatura,
// e um quadro do fim costuma pegar a tela de encerramento ou o professor de olho
// fechado — foi o que aconteceu com o Reel 07.
let capa = null;
const segundoDaCapa = Number(config.portraitTimeSeconds ?? Math.min(3, duracaoSaidaSegundos / 3));
if (segundoDaCapa > duracaoSaidaSegundos / 3) {
  throw new Error(`A capa deve sair do primeiro terço do Reel (até ${(duracaoSaidaSegundos / 3).toFixed(1)}s), e foi pedida em ${segundoDaCapa}s.`);
}
capa = path.join(path.dirname(saida), 'capa.jpg');

if (config.cover) {
  // A CAPA E UMA ARTE PROPRIA, NAO UM QUADRO DO VIDEO.
  //
  // E o que manda o padrao das capas (pipeline/data/cover-standard.md, primeira
  // regra: "Nunca usar um quadro completo do video como capa"). Eu vinha violando
  // isso: arrancava o quadro inteiro do Reel ja montado, com o slide, o circulo do
  // rosto e a legenda karaoke dentro. No feed do Instagram isso vira uma miniatura
  // confusa, com texto pequeno demais para ler.
  //
  // Do video sai SO O RETRATO. O resto — marca, curso, episodio, gancho, cores do
  // curso — e desenhado pelo render-reel-cover.mjs, que ja existia e so nao estava
  // ligado a plataforma.
  const retrato = path.join(trabalho, 'retrato.png');

  // O tempo da capa e contado no video QUE SAI; a fonte corre na velocidade
  // original. Sem multiplicar pela velocidade, um Reel a 1,25x pegaria o retrato
  // num instante anterior ao pretendido.
  const segundoNaFonte = inicioMs / 1000 + segundoDaCapa * velocidade;
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    ...(cabecalhos ? ['-headers', cabecalhos] : []),
    '-ss', paraTempoFfmpeg(segundoNaFonte * 1000), '-i', fonteVideo,
    '-frames:v', '1',
    '-vf', `crop=${L.faceCropWidth}:${L.faceCropHeight}:${L.faceCropX}:${L.faceCropY},scale=900:950:flags=lanczos`,
    '-update', '1', retrato,
  ], { stdio: 'pipe' });
  if (!fs.existsSync(retrato)) throw new Error('Nao consegui extrair o retrato para a capa.');

  const configCapa = path.join(trabalho, 'config-capa.json');
  fs.writeFileSync(configCapa, JSON.stringify({ cover: config.cover, logoPath: logo }, null, 2), 'utf8');
  try {
    execFileSync('node', [
      path.join(scriptDir, 'render-reel-cover.mjs'),
      '--config', configCapa, '--portrait', retrato, '--output', capa,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`A capa falhou: ${String(e.stderr || e.message).slice(0, 400)}`);
  }
} else {
  // Sem bloco cover na configuracao, continua o comportamento antigo: um quadro do
  // proprio Reel. Fica so como rede — nao e o que o padrao manda.
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', String(segundoDaCapa), '-i', temporario,
    '-frames:v', '1', '-q:v', '2', '-update', '1', capa,
  ], { stdio: 'pipe' });
}

/* ── Entrega ───────────────────────────────────────────────── */

fs.copyFileSync(temporario, saida);
if (!config.workDir) fs.rmSync(trabalho, { recursive: true, force: true });

console.log(JSON.stringify({
  outputPath: saida,
  coverPath: capa,
  durationSeconds: Number(sonda.format.duration),
  speed: velocidade,
  width: fluxoVideo.width,
  height: fluxoVideo.height,
  fonte,
}, null, 2));
