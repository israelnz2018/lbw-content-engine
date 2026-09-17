/**
 * Conexão com o Firestore e operações da fila.
 *
 * A fila é a coleção marketing_tarefas. O worker pega uma tarefa pendente por vez,
 * marca como executando, processa e grava o resultado.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Espelha src/types/marketing.ts na plataforma. Se uma coleção entrar lá e não
// aqui, o worker quebra só na hora de usar — foi o que aconteceu com `criativos`.
const COLECOES = {
  config: 'marketing_config',
  videos: 'marketing_videos',
  criativos: 'marketing_criativos',
  campanhas: 'marketing_campanhas',
  pecas: 'marketing_pecas',
  tarefas: 'marketing_tarefas',
  imagens: 'marketing_imagens',
};

function credencial() {
  // No Railway a credencial vem inteira na variável, não como caminho de arquivo.
  //
  // Aceita os DOIS nomes de propósito. A plataforma já usa FIREBASE_ADMIN_KEY_JSON,
  // então quando o worker roda no mesmo projeto do Railway ele aproveita a variável
  // que já está lá — ninguém precisa colar a chave duas vezes. FIREBASE_SERVICE_ACCOUNT
  // continua valendo para quando o worker roda sozinho, em outro projeto.
  const bruto = process.env.FIREBASE_ADMIN_KEY_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!bruto) {
    throw new Error(
      'Credencial do Firebase não encontrada. Defina FIREBASE_ADMIN_KEY_JSON '
      + '(o mesmo nome que a plataforma usa) ou FIREBASE_SERVICE_ACCOUNT com o JSON da conta de serviço.',
    );
  }
  try {
    return JSON.parse(bruto);
  } catch {
    throw new Error('A credencial do Firebase não é um JSON válido. Confira se o valor colado começa com { e termina com }.');
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
  // Filtrar por status E ordenar por data exigiria um indice composto no Firestore,
  // que precisa ser criado a mao no console. Como a fila e curta (poucas tarefas por
  // consultor por dia), buscamos as pendentes e ordenamos em memoria: mesmo resultado,
  // sem depender de configuracao externa.
  const fila = db().collection(COLECOES.tarefas)
    .where('status', '==', 'pendente')
    .limit(20);

  return db().runTransaction(async (t) => {
    const snap = await t.get(fila);
    if (snap.empty) return null;

    // Mais antiga primeiro, para ninguem furar a fila.
    const ordenadas = snap.docs.slice().sort((a, b) =>
      String(a.data().criadoEm || '').localeCompare(String(b.data().criadoEm || '')));

    const doc = ordenadas[0];
    const tarefa = { id: doc.id, ...doc.data() };

    t.update(doc.ref, {
      status: 'executando',
      iniciadoEm: new Date().toISOString(),
      tentativas: (tarefa.tentativas || 0) + 1,
    });

    return tarefa;
  });
}

/**
 * Avisa sempre que a fila muda, em vez de perguntar de dez em dez segundos.
 *
 * Consultar em laço custava ~17 mil leituras por dia sem nenhum trabalho acontecer,
 * e ainda assim demorava até um intervalo inteiro pra pegar a tarefa. O ouvinte
 * cobra só quando algo muda de verdade e acorda na hora.
 *
 * Ele é só a campainha: quem garante que dois workers não peguem a mesma tarefa
 * continua sendo a transação de pegarProximaTarefa.
 */
export function ouvirFila(aoMudar) {
  return db().collection(COLECOES.tarefas)
    .where('status', '==', 'pendente')
    .limit(20)
    .onSnapshot(
      (snap) => { if (!snap.empty) aoMudar(); },
      (erro) => aoMudar(erro),
    );
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

export async function lerCriativo(criativoId) {
  const snap = await db().collection(COLECOES.criativos).doc(criativoId).get();
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
