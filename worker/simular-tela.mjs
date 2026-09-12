/**
 * Escreve na fila EXATAMENTE o que o formulario da etapa 4 escreve.
 * Serve para conferir, sem abrir o navegador, que a tela e o worker falam a mesma lingua.
 *
 * Uso: node simular-tela.mjs
 */
import { db, COLECOES } from './firestore.mjs';

const consultorId = 'israel';
const titulo = 'Teste pela tela de marketing';
const gerarSlug = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// O mesmo texto que o consultor digitaria na caixa de blocos.
const blocos = `Quem manda no *Lean Six Sigma*
Ninguem controla a metodologia. Ela nao tem dono, nao tem licenca e nao tem certificado obrigatorio.

De onde veio o *Lean*
Taiichi Ohno, na Toyota, depois da guerra. O problema era produzir pouco sem desperdicar nada.

De onde veio o *se sigma*
Motorola, anos 80. O problema era outro: defeito demais saindo da linha.

O que os dois tem em comum
Os dois olham para o processo, nao para a pessoa. E os dois exigem dado antes de opiniao.

O que muda na *pratica*
Voce para de discutir quem errou e passa a discutir onde o processo deixa passar.

Quer comecar hoje?
Escolha um processo que te irrita e meca ele por uma semana. So isso ja muda a conversa.`;

function interpretarBlocos(texto) {
  const partes = texto.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return partes.map((bloco, i) => {
    const [primeira, ...resto] = bloco.split('\n');
    const slide = {
      type: i === 0 ? 'capa' : i === partes.length - 1 ? 'cta' : 'padrao',
      title: primeira.trim(),
      body: resto.join(' ').trim(),
    };
    if (slide.type === 'cta') slide.palavra = 'COMECE';
    return slide;
  });
}

const slides = interpretarBlocos(blocos);
const campanhaId = `${consultorId}__${gerarSlug(titulo)}`;
const agora = new Date().toISOString();

await db().collection(COLECOES.campanhas).doc(campanhaId).set({
  id: campanhaId, consultorId, videoId: 'wb-parte-1', titulo,
  objetivo: 'autoridade', status: 'processando', criadoEm: agora,
}, { merge: true });

const ref = await db().collection(COLECOES.tarefas).add({
  consultorId, campanhaId,
  tipo: 'gerar-campanha', status: 'pendente', tentativas: 0,
  render: {
    date: agora.slice(0, 10),
    slug: gerarSlug(titulo),
    folderType: 'Carrossel',
    sequence: 1,
    video: { enabled: false },
    signature: ['FONTE: curso White Belt', 'LEAN SIX SIGMA WHITE BELT - PARTE 1'],
    slides,
  },
  criadoEm: agora,
});

console.log(`${slides.length} slides | campanha ${campanhaId} | tarefa ${ref.id}`);
