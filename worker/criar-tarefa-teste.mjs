/**
 * Cria uma campanha e um pedido de teste na fila, para validar o caminho completo:
 * fila -> worker -> renderizador -> Storage -> Firestore.
 *
 * Uso: node criar-tarefa-teste.mjs
 */
import { db, COLECOES } from './firestore.mjs';

const CONSULTOR = 'israel';
const CAMPANHA = 'teste-ponta-a-ponta';
const agora = new Date().toISOString();

await db().collection(COLECOES.campanhas).doc(CAMPANHA).set({
  id: CAMPANHA,
  consultorId: CONSULTOR,
  videoId: 'wb-parte-1',
  titulo: 'Teste de ponta a ponta',
  objetivo: 'autoridade',
  status: 'rascunho',
  criadoEm: agora,
}, { merge: true });

const render = {
  date: '2026-09-12',
  slug: 'teste-ponta-a-ponta',
  folderType: 'Carrossel',
  sequence: 9,
  video: { enabled: false },
  signature: ['FONTE: curso White Belt', 'LEAN SIX SIGMA parte 1'],
  slides: [
    { type: 'capa', title: 'Teste de *ponta a ponta*', body: 'Esta peca foi gerada pelo worker, nao pela maquina do Israel.', sub: 'O caminho completo funciona?', pessoa: '03-duvida' },
    { type: 'padrao', title: 'O pedido saiu da *fila*', body: 'A plataforma cria a tarefa no Firestore. O worker pega, executa e devolve.', pessoa: '04-explicando' },
    { type: 'padrao', title: 'O texto passou pelo *dicionario*', body: 'Termos como se sigma e caizen sao corrigidos antes de virarem imagem.', pessoa: '08-foco' },
    { type: 'comparacao', title: 'Antes e *depois*', body: 'Antes o arquivo ficava so na maquina. Agora sobe para a nuvem, por consultor.', negativo: 'Maquina local', positivo: 'Nuvem' },
    { type: 'padrao', title: 'Cada consultor tem sua *pasta*', body: 'O caminho no armazenamento separa por consultor e por campanha.', pessoa: '12-lideranca' },
    { type: 'cta', title: 'Funcionou?', body: 'Se voce esta vendo esta imagem na tela de revisao, o caminho inteiro esta de pe.', palavra: 'FUNCIONOU', pessoa: '06-insight' },
  ],
};

const ref = await db().collection(COLECOES.tarefas).add({
  consultorId: CONSULTOR,
  campanhaId: CAMPANHA,
  tipo: 'gerar-campanha',
  status: 'pendente',
  tentativas: 0,
  render,
  criadoEm: agora,
});

console.log('Tarefa criada na fila:', ref.id);
console.log('Campanha:', CAMPANHA);
console.log('\nAgora rode:  node index.mjs --uma-vez');
