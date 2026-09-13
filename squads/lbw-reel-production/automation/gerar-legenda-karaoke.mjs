/**
 * Monta a legenda karaokê (.ass) do Reel falado a partir das palavras com tempo.
 *
 * Porte em Node do New-KaraokeCaptions.ps1. O efeito é o que os Reels do Israel já
 * têm: a linha aparece inteira em branco e cada palavra acende em amarelo no
 * instante em que é falada. Quem faz isso é a tag {\kNN} do formato ASS, onde NN é
 * a duração da palavra em centésimos de segundo.
 *
 * As regras de agrupamento vieram do .ps1 sem mudança, porque foram calibradas
 * olhando o Reel pronto:
 *   - no máximo 7 palavras ou 42 caracteres por bloco
 *   - um silêncio de mais de 850 ms quebra o bloco (é pausa de fala)
 *   - a quebra de linha cai no meio do bloco, contando caracteres
 *
 * Uso:
 *   node gerar-legenda-karaoke.mjs entrada.json saida.ass
 *
 * A entrada é { clipStartMs, clipEndMs, palavras: [{ t, i, f }] }, onde `i` e `f`
 * são o início e o fim da palavra em milissegundos ABSOLUTOS do vídeo original.
 */
import fs from 'node:fs';
import path from 'node:path';

const MAX_PALAVRAS = 7;
const MAX_CARACTERES = 42;
// Acima disso é pausa de fala, e não continuação: a legenda tem que quebrar junto
// com o raciocínio, senão duas frases diferentes aparecem coladas na tela.
const SILENCIO_QUE_QUEBRA_MS = 850;

const entradaPath = process.argv[2];
const saidaPath = process.argv[3];
if (!entradaPath || !saidaPath) throw new Error('Uso: node gerar-legenda-karaoke.mjs entrada.json saida.ass');

const entrada = JSON.parse(fs.readFileSync(path.resolve(entradaPath), 'utf8'));

// Quando o Reel é acelerado, a legenda tem que encolher junto ou ela dessincroniza
// do primeiro segundo em diante.
//
// O AGRUPAMENTO continua sendo feito no tempo ORIGINAL de propósito: quem decide
// onde a linha quebra é a fala (a pausa de 850 ms, o tamanho do bloco), e a fala
// não muda porque o vídeo toca mais rápido. Só os tempos ESCRITOS no .ass são
// divididos pelo fator.
const velocidade = Number(entrada.velocidade ?? 1);
if (!Number.isFinite(velocidade) || velocidade <= 0) {
  throw new Error(`Velocidade inválida: ${entrada.velocidade}`);
}

const inicioMs = Number(entrada.clipStartMs);
const fimMs = Number(entrada.clipEndMs);
if (!Number.isFinite(inicioMs) || !Number.isFinite(fimMs) || fimMs <= inicioMs) {
  throw new Error('clipStartMs e clipEndMs inválidos.');
}

/** Só as palavras dentro do corte, na ordem. */
const palavras = (entrada.palavras || [])
  .map((p) => ({ texto: String(p.t ?? '').trim(), inicio: Number(p.i), fim: Number(p.f) }))
  .filter((p) => p.texto && Number.isFinite(p.inicio) && p.inicio >= inicioMs && p.inicio < fimMs)
  .sort((a, b) => a.inicio - b.inicio);

if (!palavras.length) throw new Error('Nenhuma palavra temporizada dentro do corte.');

/* ── Agrupamento em blocos ─────────────────────────────────── */

const blocos = [];
let atual = [];
let caracteres = 0;

for (const palavra of palavras) {
  const silencio = atual.length ? palavra.inicio - atual[atual.length - 1].inicio : 0;
  const projetado = caracteres + (atual.length ? 1 : 0) + palavra.texto.length;
  if (atual.length && (atual.length >= MAX_PALAVRAS || projetado > MAX_CARACTERES || silencio > SILENCIO_QUE_QUEBRA_MS)) {
    blocos.push(atual);
    atual = [];
    caracteres = 0;
  }
  atual.push(palavra);
  caracteres += (caracteres ? 1 : 0) + palavra.texto.length;
}
if (atual.length) blocos.push(atual);

/* ── Montagem do .ass ──────────────────────────────────────── */

/** Milissegundos relativos ao corte -> H:MM:SS.CC, o formato do ASS. */
function tempoAss(ms) {
  const seguro = Math.max(0, ms);
  const cs = Math.round(seguro / 10);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

const linhas = [
  '[Script Info]',
  'ScriptType: v4.00+',
  'PlayResX: 1080',
  'PlayResY: 1920',
  'ScaledBorderAndShadow: yes',
  '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  // PrimaryColour &H0000D7FF = o amarelo que acende; Secondary = o branco de espera.
  'Style: LBW,Arial,49,&H0000D7FF,&H00FFFFFF,&H00612B06,&H00000000,-1,0,0,0,100,100,0,0,1,3,2,2,55,55,250,1',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
];

for (let b = 0; b < blocos.length; b++) {
  const bloco = blocos[b];
  const inicioBlocoAbs = bloco[0].inicio;
  const inicioProximoAbs = b + 1 < blocos.length ? blocos[b + 1][0].inicio : fimMs;
  // Termina 20 ms antes do próximo bloco, pra as linhas não se sobreporem na tela,
  // e dura no mínimo 300 ms, pra um bloco curto não piscar.
  const fimBlocoAbs = Math.min(fimMs, Math.max(inicioBlocoAbs + 300, inicioProximoAbs - 20));

  const comprimento = bloco.map((p) => p.texto).join(' ').length;
  const metade = Math.ceil(comprimento / 2);
  let usado = 0;
  let quebrou = false;
  let texto = '';

  for (let i = 0; i < bloco.length; i++) {
    const palavra = bloco[i];
    const proximoInicio = i + 1 < bloco.length ? bloco[i + 1].inicio : fimBlocoAbs;
    // A duração de cada palavra é até o começo da PRÓXIMA, não até o próprio fim:
    // é assim que o karaokê fica contínuo, sem buraco entre uma palavra e outra.
    const centesimos = Math.max(1, Math.round((proximoInicio - palavra.inicio) / velocidade / 10));
    if (i > 0) {
      if (!quebrou && usado >= metade) { texto += '\\N'; quebrou = true; }
      else texto += ' ';
    }
    texto += `{\\k${centesimos}}${palavra.texto.toLocaleUpperCase('pt-BR')}`;
    usado += palavra.texto.length + 1;
  }

  linhas.push(`Dialogue: 0,${tempoAss((inicioBlocoAbs - inicioMs) / velocidade)},${tempoAss((fimBlocoAbs - inicioMs) / velocidade)},LBW,,0,0,0,,${texto}`);
}

fs.mkdirSync(path.dirname(path.resolve(saidaPath)), { recursive: true });
fs.writeFileSync(path.resolve(saidaPath), linhas.join('\n') + '\n', 'utf8');

console.log(JSON.stringify({
  arquivo: path.resolve(saidaPath),
  palavras: palavras.length,
  blocos: blocos.length,
  velocidade,
  primeiraPalavra: palavras[0].texto,
  primeiraPalavraMs: palavras[0].inicio,
  ultimaPalavra: palavras[palavras.length - 1].texto,
  ultimaPalavraFimMs: palavras[palavras.length - 1].fim,
}, null, 2));
