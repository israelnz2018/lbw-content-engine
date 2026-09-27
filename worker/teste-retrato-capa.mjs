/**
 * O retrato da capa: círculo exato da câmera, melhor fonte, quadro mais parado.
 *
 * O Israel, depois de várias rodadas: "de uma vez por todas... não aceito que
 * minha imagem não ocupe 100 por cento do espaço... a qualidade precisa
 * melhorar... padronize... deixe um círculo perfeito". Ver worker/retrato.mjs.
 *
 *   node teste-retrato-capa.mjs
 */
import {
  CIRCULO_DA_CAMERA, MARGEM_DO_CIRCULO, quadradoDaCamera,
  nitidezDoQuadro, movimentoEntre, escolherQuadro, segundosDe, fonteOriginal,
} from './retrato.mjs';

let falhas = 0;
const conferir = (nome, ok, detalhe = '') => {
  if (!ok) falhas++;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome}${ok || !detalhe ? '' : `\n        ${detalhe}`}`);
};

/* ── O círculo nunca pega slide ──────────────────────────────── */
// Medidas reais, pixel a pixel, de dois vídeos (640x360 e 1280x720), e
// conferidas visualmente em mais quatro vídeos Full HD.
for (const [w, h] of [[640, 360], [1280, 720], [1920, 1080]]) {
  const q = quadradoDaCamera({ width: w, height: h });
  const cxReal = CIRCULO_DA_CAMERA.cx * w;
  const cyReal = CIRCULO_DA_CAMERA.cy * h;
  const rReal = CIRCULO_DA_CAMERA.r * w;
  const cx = q.x + q.width / 2;
  const cy = q.y + q.height / 2;
  const r = q.width / 2;
  // O círculo usado cabe inteiro dentro da bolha da câmera: nenhum pixel de slide.
  const folga = rReal - (Math.hypot(cx - cxReal, cy - cyReal) + r);
  conferir(`${w}x${h}: o círculo usado cabe inteiro na bolha da câmera`, folga >= 0, `folga ${folga.toFixed(1)}px`);
  conferir(`${w}x${h}: não encosta na faixa azul do rodapé do slide`, cy + r < 0.925 * h, `base ${cy + r} de ${h}`);
  conferir(`${w}x${h}: não passa da borda direita`, cx + r <= w);
  conferir(`${w}x${h}: quadrado dentro do quadro e com lados pares (ffmpeg)`,
    q.x >= 0 && q.y >= 0 && q.x + q.width <= w && q.y + q.height <= h
    && q.width % 2 === 0 && q.x % 2 === 0 && q.y % 2 === 0);
}

// O ganho que motivou buscar o ORIGINAL: pixels reais de rosto por resolução.
const lado360 = quadradoDaCamera({ width: 640, height: 360 }).width;
const lado1080 = quadradoDaCamera({ width: 1920, height: 1080 }).width;
conferir('Full HD tem ~3x mais pixels de câmera por eixo que 360p',
  lado1080 / lado360 > 2.9, `${lado360}px vs ${lado1080}px`);
console.log(`     (360p: ${lado360}px · 1080p: ${lado1080}px de lado útil)`);

conferir('a margem interna existe (bolha encosta no rodapé e no triângulo do slide)',
  MARGEM_DO_CIRCULO < 1 && MARGEM_DO_CIRCULO > 0.7);

/* ── Instante e fonte ────────────────────────────────────────── */
conferir('instante "00:01:43.190" vira 103,19s', Math.abs(segundosDe('00:01:43.190') - 103.19) < 1e-9);
conferir('instante numérico passa direto', segundosDe(42.5) === 42.5);
conferir('MP4 do Bunny vira o ORIGINAL',
  fonteOriginal('https://vz-a.b-cdn.net/9741e6a7-0bef-4874-a0dc-82c42b0eef2e/play_360p.mp4')
    === 'https://vz-a.b-cdn.net/9741e6a7-0bef-4874-a0dc-82c42b0eef2e/original');
conferir('outra origem (Storage) volta como veio',
  fonteOriginal('https://storage.googleapis.com/x/video.mp4') === 'https://storage.googleapis.com/x/video.mp4');

/* ── Escolha do quadro ───────────────────────────────────────── */
const L = 100;
const liso = (v) => new Uint8Array(L * L).fill(v);
const xadrez = () => {
  const a = new Uint8Array(L * L);
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) a[y * L + x] = ((x >> 1) + (y >> 1)) % 2 ? 200 : 40;
  return a;
};
conferir('rosto com detalhe é mais nítido que rosto liso', nitidezDoQuadro(xadrez(), L) > nitidezDoQuadro(liso(120), L));
conferir('quadros iguais: movimento zero', movimentoEntre(liso(100), liso(100), L) === 0);
conferir('quadros diferentes: há movimento', movimentoEntre(liso(100), liso(160), L) > 0);

// Mudança só no canto (slide trocando de página) não conta como movimento do rosto.
const cantoMudou = liso(100);
for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) cantoMudou[y * L + x] = 250;
conferir('slide mudando no canto não conta como movimento',
  movimentoEntre(liso(100), cantoMudou, L) === 0 && movimentoEntre(liso(100), cantoMudou, L, true) === 0);

// Sequência: o apresentador gesticula (quadros mudam), para no meio (3 quadros
// iguais e nítidos), e volta a gesticular. O escolhido tem de ser o do meio da pausa.
const sequencia = [liso(60), liso(140), liso(70), xadrez(), xadrez(), xadrez(), liso(150), liso(50)];
const escolhido = escolherQuadro(sequencia, L);
conferir('escolhe o quadro parado e nítido, não o do gesto', escolhido === 4, `escolheu ${escolhido}`);
conferir('um quadro só: escolhe ele', escolherQuadro([liso(100)], L) === 0);

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} TESTE(S) FALHARAM`}`);
process.exit(falhas === 0 ? 0 : 1);
