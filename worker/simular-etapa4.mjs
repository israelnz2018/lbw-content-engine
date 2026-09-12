/**
 * Simula a etapa 4 inteira, sem abrir o navegador:
 *   1. grava o roteiro no criativo (o que o endpoint gerar-roteiro faz)
 *   2. cria campanha + tarefa (o que o botao "Produzir as pecas" faz)
 *
 * Serve pra conferir que a tela e o worker falam a mesma lingua antes de a
 * tela existir de verdade no ar.
 *
 * Uso: node simular-etapa4.mjs <arquivo-do-roteiro.json>
 */
import fs from 'node:fs';
import { db, COLECOES } from './firestore.mjs';

const arquivoRoteiro = process.argv[2];
if (!arquivoRoteiro) { console.error('informe o json do roteiro'); process.exit(1); }
const slides = JSON.parse(fs.readFileSync(arquivoRoteiro, 'utf8'));

const criativoId = 'israel__lean-six-sigma-white-belt-parte-1__00426';
const snap = await db().collection(COLECOES.criativos).doc(criativoId).get();
if (!snap.exists) { console.error('criativo nao encontrado'); process.exit(1); }
const criativo = snap.data();

const agora = new Date().toISOString();

// 1) o roteiro fica no criativo, como o endpoint grava
await snap.ref.update({ roteiro: { slides, geradoEm: agora }, atualizadoEm: agora });
console.log(`roteiro gravado no criativo: ${slides.length} paginas`);

// 2) campanha + tarefa, como a tela escreve
const campanhaId = `${criativoId}__pecas`;
const apagadas = new Set(criativo.linhasApagadas || []);
const usadas = (criativo.linhas || []).filter((_, i) => !apagadas.has(i));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

await db().collection(COLECOES.campanhas).doc(campanhaId).set({
  id: campanhaId,
  consultorId: criativo.consultorId,
  videoId: criativo.videoId,
  criativoId,
  titulo: criativo.titulo,
  objetivo: 'autoridade',
  status: 'processando',
  corteInicio: mmss(usadas[0]?.inicio ?? 0),
  corteFim: mmss(usadas[usadas.length - 1]?.fim ?? 0),
  criadoEm: agora,
}, { merge: true });

const ref = await db().collection(COLECOES.tarefas).add({
  consultorId: criativo.consultorId,
  campanhaId,
  tipo: 'gerar-campanha',
  status: 'pendente',
  tentativas: 0,
  render: {
    date: agora.slice(0, 10),
    slug: criativoId.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60),
    folderType: 'Carrossel',
    sequence: Math.min(99, Math.max(1, criativo.ordem || 1)),
    video: { enabled: true, secondsPerSlide: 5 },
    signature: ['FONTE: curso White Belt', 'PARTE 1'],
    slides,
  },
  criadoEm: agora,
});

console.log(`campanha ${campanhaId}`);
console.log(`tarefa ${ref.id} na fila — o worker deve pegar em segundos`);
