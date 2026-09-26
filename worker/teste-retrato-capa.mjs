/**
 * O retrato da capa: proporcao, nitidez e posicao.
 *
 * O Israel relatou duas coisas na mesma imagem: "minha imagem dificilmente fica
 * no local correto" e "a qualidade da imagem tambem esta muito ruim". Eram tres
 * defeitos somados, todos mediveis:
 *
 *  1. DEFORMACAO — o recorte do rosto (290x260 em 1280x720, quase quadrado) era
 *     forcado a 900x950 com `scale`, que nao preserva proporcao: 15% de aperto
 *     na horizontal.
 *  2. BORRAO — esse mesmo `scale` ampliava 2,07x um recorte de 435x390 px, e o
 *     CSS ainda aplicava transform:scale(1.35) por cima: 2,79x no total.
 *  3. POSICAO INSTAVEL — object-position:center 34% escolhia um ponto do rosto
 *     e o transform:scale, que amplia a partir do centro do ELEMENTO, empurrava
 *     tudo de novo. Dois ajustes brigando: cada video caia num lugar.
 *
 * Estes testes provam a correcao pela aritmetica, sem depender de gerar imagem.
 */
import assert from 'node:assert/strict';
import { recorteDoRetratoDaCapa, MOLDURA_CAPA } from './executores.mjs';

let passaram = 0;
const conferir = (nome, condicao, detalhe = '') => {
  if (condicao) { passaram++; console.log(`ok   ${nome}`); }
  else { console.log(`FALHOU ${nome}${detalhe ? ` — ${detalhe}` : ''}`); process.exitCode = 1; }
};

const PROPORCAO_ALVO = MOLDURA_CAPA.largura / MOLDURA_CAPA.altura;
const recorteReal = { width: 290, height: 260, x: 500, y: 200 };

/* ── 1. Proporcao: o defeito principal ───────────────────────── */
const fullHd = { width: 1920, height: 1080 };
const r = recorteDoRetratoDaCapa(recorteReal, fullHd);
const proporcao = r.width / r.height;
const desvio = Math.abs(proporcao - PROPORCAO_ALVO) / PROPORCAO_ALVO;

conferir('o recorte sai na proporcao da moldura (sem espremer o rosto)',
  desvio < 0.01, `proporcao ${proporcao.toFixed(4)} vs alvo ${PROPORCAO_ALVO.toFixed(4)}`);

conferir('ANTES o mesmo recorte seria espremido em ~15%',
  Math.abs((PROPORCAO_ALVO / (435 / 390)) - 1) > 0.13);

/* ── 2. Nitidez: crescer em vez de esticar ───────────────────── */
const base = { width: 435, height: 390 };
conferir('o recorte CRESCE para caber na proporcao, nunca encolhe o rosto',
  r.width >= base.width && r.height >= base.height,
  `${r.width}x${r.height} vs base ${base.width}x${base.height}`);

// dSF=1 e MEDIDO, nao chutado: em dSF=2 a area interna exigiria 1748x1848 px,
// e um Full HD so tem 436px de rosto — a ampliacao subiria de 2,00x para 4,01x.
// Resolucao de saida nao cria detalhe que a camera nao capturou.
conferir('a saida sai no tamanho exato da moldura, sem desperdicio nos dois sentidos',
  r.saidaLargura === MOLDURA_CAPA.largura && r.saidaAltura === MOLDURA_CAPA.altura);

// O ganho real que o Israel vai ver: menos ampliacao que antes.
const amplAntes = 2.79;  // 2,07x no ffmpeg x 1,35x no CSS
const amplAgora = MOLDURA_CAPA.largura / r.width;
conferir('a ampliacao do rosto CAI em relacao ao que era antes',
  amplAgora < amplAntes, `agora ${amplAgora.toFixed(2)}x vs antes ${amplAntes}x`);
console.log(`     (ampliacao em Full HD: ${amplAntes}x -> ${amplAgora.toFixed(2)}x)`);

/* ── 3. Centro preservado: a posicao estavel ─────────────────── */
const centroBaseX = (recorteReal.x * 1.5) + (recorteReal.width * 1.5) / 2;
const centroNovoX = r.x + r.width / 2;
conferir('o centro do rosto nao se desloca ao alargar o recorte',
  Math.abs(centroNovoX - centroBaseX) <= 2,
  `centro ${centroNovoX} vs ${centroBaseX}`);

/* ── 4. A borda do quadro: nunca estoura, nunca deforma ──────── */
const rostoNaBorda = recorteDoRetratoDaCapa(
  { width: 290, height: 260, x: 1180, y: 600 }, fullHd,
);
conferir('rosto no canto: o recorte fica dentro do quadro',
  rostoNaBorda.x >= 0 && rostoNaBorda.y >= 0
  && rostoNaBorda.x + rostoNaBorda.width <= fullHd.width
  && rostoNaBorda.y + rostoNaBorda.height <= fullHd.height,
  JSON.stringify(rostoNaBorda));

const propBorda = rostoNaBorda.width / rostoNaBorda.height;
conferir('rosto no canto: a proporcao CONTINUA certa (encolhe os dois lados juntos)',
  Math.abs(propBorda - PROPORCAO_ALVO) / PROPORCAO_ALVO < 0.02,
  `proporcao ${propBorda.toFixed(4)}`);

/* ── 5. Fontes de varias resolucoes ──────────────────────────── */
for (const fonte of [
  { width: 1280, height: 720 }, { width: 1920, height: 1080 },
  { width: 2560, height: 1440 }, { width: 3840, height: 2160 },
]) {
  const saida = recorteDoRetratoDaCapa(recorteReal, fonte);
  const p = saida.width / saida.height;
  conferir(`fonte ${fonte.width}x${fonte.height}: proporcao certa e dentro do quadro`,
    Math.abs(p - PROPORCAO_ALVO) / PROPORCAO_ALVO < 0.02
    && saida.x >= 0 && saida.y >= 0
    && saida.x + saida.width <= fonte.width
    && saida.y + saida.height <= fonte.height,
    `${saida.width}x${saida.height} proporcao ${p.toFixed(4)}`);
}

/* ── 6. Numeros pares: exigencia do ffmpeg ───────────────────── */
conferir('largura e altura pares (o ffmpeg recusa impares em varios codecs)',
  r.width % 2 === 0 && r.height % 2 === 0 && r.x % 2 === 0 && r.y % 2 === 0);

/* ── 7. Ganho real de pixels, medido ─────────────────────────── */
const pixelsAntes = 435 * 390;
const pixelsAgora = r.width * r.height;
conferir('usa MAIS pixels reais do video do que antes',
  pixelsAgora > pixelsAntes,
  `${pixelsAgora} vs ${pixelsAntes}`);
console.log(`     (${(pixelsAgora / pixelsAntes).toFixed(2)}x mais pixels reais aproveitados)`);

console.log(`\n${process.exitCode ? 'FALHOU' : `TODOS OS ${passaram} TESTES PASSARAM`}`);
