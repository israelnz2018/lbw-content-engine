/**
 * Confere se o recorte do Reel termina em ponto final, em TODOS os criativos.
 *
 * A regra é a mesma do endpoint gerar-reel: depois do fim da faixa, o corte anda
 * pra frente ate a palavra que fecha a frase, com teto de 20 s.
 *
 * Uso: node teste-fim-de-frase.mjs
 */
import { db, COLECOES } from './firestore.mjs';

const FIM_DE_FRASE = /[.!?…]["'”’)\]]?$/;
const MAX_EXTENSAO_MS = 20000;

const criativos = await db().collection(COLECOES.criativos).get();
const porVideo = new Map();

let comFrase = 0;
let semFrase = 0;
let semPalavras = 0;
const exemplos = [];

for (const doc of criativos.docs) {
  const c = doc.data();

  if (!porVideo.has(c.videoId)) {
    const ref = db().collection(COLECOES.videos).doc(c.videoId);
    const blocos = await ref.collection('palavras').get();
    const todas = [];
    blocos.docs.sort((a, b) => a.id.localeCompare(b.id))
      .forEach((d) => todas.push(...(d.data().palavras || [])));
    porVideo.set(c.videoId, todas);
  }
  const todas = porVideo.get(c.videoId);
  if (!todas.length) { semPalavras++; continue; }

  const apagadas = new Set(c.linhasApagadas || []);
  const emUso = (c.linhas || []).filter((_, i) => !apagadas.has(i));
  if (!emUso.length) continue;

  const faixaInicioMs = Math.round(emUso[0].inicio * 1000);
  const faixaFimMs = Math.round(emUso[emUso.length - 1].fim * 1000);

  const primeiroIdx = todas.findIndex((p) => p.i >= faixaInicioMs);
  if (primeiroIdx < 0) { semPalavras++; continue; }
  let ultimoIdx = primeiroIdx;
  while (ultimoIdx + 1 < todas.length && todas[ultimoIdx + 1].i < faixaFimMs) ultimoIdx++;

  const antesDaExtensao = todas[ultimoIdx];
  const jaFechava = FIM_DE_FRASE.test(String(antesDaExtensao.t || ''));

  const limite = faixaFimMs + MAX_EXTENSAO_MS;
  let estendeu = 0;
  while (
    !FIM_DE_FRASE.test(String(todas[ultimoIdx].t || '')) &&
    ultimoIdx + 1 < todas.length &&
    todas[ultimoIdx + 1].f <= limite
  ) { ultimoIdx++; estendeu++; }

  const fechou = FIM_DE_FRASE.test(String(todas[ultimoIdx].t || ''));
  if (fechou) comFrase++; else semFrase++;

  if (!jaFechava && exemplos.length < 5) {
    exemplos.push({
      titulo: c.titulo,
      antes: todas.slice(Math.max(0, ultimoIdx - estendeu - 3), ultimoIdx - estendeu + 1).map((p) => p.t).join(' '),
      depois: todas.slice(Math.max(0, ultimoIdx - 3), ultimoIdx + 1).map((p) => p.t).join(' '),
      estendeu,
      segundos: ((todas[ultimoIdx].f - faixaFimMs) / 1000).toFixed(1),
      fechou,
    });
  }
}

console.log(`criativos conferidos: ${comFrase + semFrase}`);
console.log(`  terminam em ponto final: ${comFrase}`);
console.log(`  NAO terminam:            ${semFrase}`);
if (semPalavras) console.log(`  sem palavras com tempo (video antigo): ${semPalavras}`);

console.log('\nexemplos que precisaram estender:');
for (const e of exemplos) {
  console.log(`\n  ${e.titulo}`);
  console.log(`    antes:  ...${e.antes}`);
  console.log(`    depois: ...${e.depois}`);
  console.log(`    +${e.estendeu} palavra(s), +${e.segundos}s  | fechou: ${e.fechou ? 'SIM' : 'NAO'}`);
}
