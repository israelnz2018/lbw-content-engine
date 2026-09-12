/**
 * Conexão com o Firestore e operações da fila.
 *
 * A fila é a coleção marketing_tarefas. O worker pega uma tarefa pendente por vez,
 * marca como executando, processa e grava o resultado.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const COLECOES = {
  config: 'marketing_config',
  videos: 'marketing_videos',
  campanhas: 'marketing_campanhas',
  pecas: 'marketing_pecas',
  tarefas: 'marketing_tarefas',
};

function credencial() {
  // No Railway a credencial vem inteira na variável, não como caminho de arquivo.
  const bruto = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!bruto) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT não definida. Cole o JSON da conta de serviço na variável.');
  }
  try {
    return JSON.parse(bruto);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT não é um JSON válido.');
  }
}

/**
 * Inicialização sob demanda.
 *
 * Fazer isso no topo do arquivo quebrava o import inteiro quando faltava credencial —
 * inclusive para quem só queria usar uma função pura deste projeto. Agora a credencial
 * só é exigida quando alguém realmente fala com o Firebase.
 */
let iniciado = false;
function garantirApp() {
  if (iniciado || getApps().length) { iniciado = true; return; }
  initializeApp({
    credential: cert(credencial()),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
  iniciado = true;
}

export function db() {
  garantirApp();
  return getFirestore();
}

export function bucket() {
  garantirApp();
  return getStorage().bucket();
}

export { COLECOES };

/**
 * Pega a tarefa pendente mais antiga e marca como executando na mesma transação.
 * A transação evita que dois workers peguem a mesma tarefa.
 */
export async function pegarProximaTarefa() {
  const fila = db().collection(COLECOES.tarefas)
    .where('status', '==', 'pendente')
    .orderBy('criadoEm')
    .limit(1);

  return db().runTransaction(async (t) => {
    const snap = await t.get(fila);
    if (snap.empty) return null;

    const doc = snap.docs[0];
    const tarefa = { id: doc.id, ...doc.data() };

    t.update(doc.ref, {
      status: 'executando',
      iniciadoEm: new Date().toISOString(),
      tentativas: (tarefa.tentativas || 0) + 1,
    });

    return tarefa;
  });
}

export async function concluirTarefa(tarefaId) {
  await db().collection(COLECOES.tarefas).doc(tarefaId).update({
    status: 'concluida',
    concluidoEm: new Date().toISOString(),
    erro: null,
  });
}

/** Falhou. Depois de 3 tentativas desiste, para não ficar em laço infinito. */
export async function falharTarefa(tarefaId, erro, tentativas) {
  const desistir = (tentativas || 0) >= 3;
  await db().collection(COLECOES.tarefas).doc(tarefaId).update({
    status: desistir ? 'erro' : 'pendente',
    erro: String(erro).slice(0, 500),
    concluidoEm: desistir ? new Date().toISOString() : null,
  });
  return desistir;
}

export async function lerConfig(consultorId) {
  const snap = await db().collection(COLECOES.config).doc(consultorId).get();
  return snap.exists ? snap.data() : null;
}

export async function lerCampanha(campanhaId) {
  const snap = await db().collection(COLECOES.campanhas).doc(campanhaId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function lerPeca(pecaId) {
  const snap = await db().collection(COLECOES.pecas).doc(pecaId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function gravarPeca(peca) {
  await db().collection(COLECOES.pecas).doc(peca.id).set(
    { ...peca, atualizadoEm: new Date().toISOString() },
    { merge: true },
  );
}

export async function atualizarCampanha(campanhaId, campos) {
  await db().collection(COLECOES.campanhas).doc(campanhaId).update({
    ...campos,
    atualizadoEm: new Date().toISOString(),
  });
}
