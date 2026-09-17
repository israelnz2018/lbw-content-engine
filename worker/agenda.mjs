/**
 * O relógio da publicação: quem percebe que chegou a hora da peça agendada.
 *
 * A peça guarda dia e hora LOCAIS, sem fuso ("2026-09-20" e "19:00"), porque o
 * Israel mora na Nova Zelândia e publica para o Brasil — qualquer conversão na
 * hora de gravar erraria o dia para um dos dois lados (ver Peca.agendadoEm).
 *
 * Para publicar sozinho, porém, o worker precisa de um instante exato. A regra é:
 * a hora marcada é a hora DE QUEM VAI LER, ou seja o horário de Brasília. Quando
 * ele escolhe 19:00, quer dizer 19:00 para o público brasileiro.
 */
import { db, COLECOES } from './firestore.mjs';

/** O fuso do público, não o de quem agenda. */
export const FUSO_PADRAO = process.env.FUSO_PUBLICACAO || 'America/Sao_Paulo';

/** Hora usada quando a peça foi arrastada para um dia sem hora escolhida. */
const HORA_PADRAO = '09:00';

/**
 * Atraso que ainda vale publicar.
 *
 * Se o worker ficar fora do ar um fim de semana, na volta ele NÃO despeja tudo
 * que venceu de uma vez: além de parecer robô, o Instagram corta a mão de quem
 * publica em rajada. Passado este prazo a peça fica para o consultor decidir.
 */
const ATRASO_MAXIMO_HORAS = Number(process.env.ATRASO_MAXIMO_HORAS || 24);

/** Quantas peças no máximo entram na fila por passada. */
const MAXIMO_POR_PASSADA = 3;

/**
 * Quantos minutos o fuso está à frente do UTC naquele instante.
 * Feito com Intl para não depender de biblioteca de fuso nem de tabela própria.
 */
export function deslocamentoMinutos(data, fuso = FUSO_PADRAO) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(data);

  const p = {};
  for (const parte of partes) if (parte.type !== 'literal') p[parte.type] = Number(parte.value);
  const comoSeFosseUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return Math.round((comoSeFosseUtc - data.getTime()) / 60000);
}

/**
 * O instante exato em que "dia às hora, no fuso" acontece.
 *
 * Duas passadas de propósito: perto da virada do horário de verão o deslocamento
 * do palpite inicial pode ser o do outro lado da virada, e a segunda passada
 * corrige. (O Brasil não tem mais horário de verão, mas o consultor de amanhã
 * pode publicar para um país que tenha.)
 */
export function instanteDoAgendamento(dia, hora, fuso = FUSO_PADRAO) {
  if (!dia) return null;
  const [ano, mes, data] = String(dia).split('-').map(Number);
  const [h, min] = String(hora || HORA_PADRAO).split(':').map(Number);
  if (!ano || !mes || !data || Number.isNaN(h)) return null;

  const palpite = Date.UTC(ano, mes - 1, data, h, min || 0);
  let instante = palpite - deslocamentoMinutos(new Date(palpite), fuso) * 60000;
  instante = palpite - deslocamentoMinutos(new Date(instante), fuso) * 60000;
  return new Date(instante);
}

/** Já foi ao ar (ou está indo) — não mexer. */
export function jaSaiu(peca) {
  const estado = peca?.publicacao?.status;
  return peca?.status === 'publicado' || estado === 'publicada' || estado === 'publicando';
}

/**
 * Chegou a hora desta peça?
 * Só peça aprovada, agendada, ainda não publicada e dentro do prazo de atraso.
 */
export function estaNaHora(peca, agora = new Date(), fuso = FUSO_PADRAO) {
  if (!peca || peca.status !== 'aprovado' || !peca.agendadoEm) return false;
  if (jaSaiu(peca)) return false;
  // Falhou antes: quem manda tentar de novo é o consultor, não o relógio —
  // senão a mesma peça quebrada tentaria publicar de hora em hora, para sempre.
  if (peca.publicacao?.status === 'falhou') return false;

  const instante = instanteDoAgendamento(peca.agendadoEm, peca.agendadoHora, fuso);
  if (!instante) return false;

  const atrasoMs = agora.getTime() - instante.getTime();
  return atrasoMs >= 0 && atrasoMs <= ATRASO_MAXIMO_HORAS * 3600 * 1000;
}

/** As peças que vencem agora, da mais antiga para a mais nova. */
export function pecasDevidas(pecas, agora = new Date(), fuso = FUSO_PADRAO) {
  return pecas
    .filter((p) => estaNaHora(p, agora, fuso))
    .sort((a, b) => {
      const ia = instanteDoAgendamento(a.agendadoEm, a.agendadoHora, fuso);
      const ib = instanteDoAgendamento(b.agendadoEm, b.agendadoHora, fuso);
      return ia - ib;
    });
}

/** Já existe tarefa de publicação em andamento para esta peça? */
async function temTarefaAberta(pecaId) {
  const snap = await db().collection(COLECOES.tarefas)
    .where('pecaId', '==', pecaId)
    .where('tipo', '==', 'publicar')
    .limit(10)
    .get();
  return snap.docs.some((d) => ['pendente', 'executando'].includes(d.data().status));
}

export async function enfileirarPublicacao(peca) {
  if (await temTarefaAberta(peca.id)) return null;

  const id = `publicar__${peca.id}__${Date.now()}`;
  await db().collection(COLECOES.tarefas).doc(id).set({
    consultorId: peca.consultorId,
    campanhaId: peca.campanhaId,
    pecaId: peca.id,
    tipo: 'publicar',
    status: 'pendente',
    tentativas: 0,
    criadoEm: new Date().toISOString(),
  });
  return id;
}

/** O dia de hoje no fuso do público, no formato que a peça guarda. */
export function diaNoFuso(data, fuso = FUSO_PADRAO) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(data);
}

/**
 * Passada do relógio: procura peça vencida e põe na fila.
 *
 * A consulta é por FAIXA DE DATA, e não por status, por dois motivos: assim cabe
 * num índice de campo único (juntar igualdade e faixa exigiria índice composto
 * criado à mão no console do Firebase) e, principalmente, custa pouco — são as
 * peças marcadas para ontem ou hoje, meia dúzia de documentos. Filtrar pelo
 * status 'aprovado' no banco traria TODAS as aprovadas, centenas de leituras a
 * cada batida do worker.
 */
export async function conferirAgenda({ agora = new Date(), fuso = FUSO_PADRAO } = {}) {
  const hoje = diaNoFuso(agora, fuso);
  const ontem = diaNoFuso(new Date(agora.getTime() - 24 * 3600 * 1000), fuso);

  const snap = await db().collection(COLECOES.pecas)
    .where('agendadoEm', '>=', ontem)
    .where('agendadoEm', '<=', hoje)
    .limit(50)
    .get();

  const candidatas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const devidas = pecasDevidas(candidatas, agora, fuso).slice(0, MAXIMO_POR_PASSADA);

  const enfileiradas = [];
  for (const peca of devidas) {
    const tarefaId = await enfileirarPublicacao(peca);
    if (tarefaId) enfileiradas.push({ pecaId: peca.id, tipo: peca.tipo, tarefaId });
  }
  return enfileiradas;
}
