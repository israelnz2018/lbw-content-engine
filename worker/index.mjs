/**
 * Laço principal do worker.
 *
 * Fica pegando tarefas pendentes da fila do Firestore e executando. Roda separado
 * do site porque editar vídeo leva minutos e consome processador e memória — se
 * estivesse na mesma requisição que serve a plataforma, derrubaria o site.
 *
 *   node index.mjs            laço contínuo (é assim que roda no Railway)
 *   node index.mjs --uma-vez  processa uma tarefa e sai (bom para testar)
 */
import {
  pegarProximaTarefa, concluirTarefa, falharTarefa, atualizarCampanha, ouvirFila,
  recuperarTarefasTravadas, normalizarCampanhaSemTarefaAtiva,
} from './firestore.mjs';
import { EXECUTORES } from './executores.mjs';
import { conferirAgenda } from './agenda.mjs';

// Rede de segurança, não o mecanismo principal: quem acorda o worker é o ouvinte
// da fila. Isto aqui só cobre o caso de a conexão do ouvinte cair sem avisar.
const INTERVALO_MS = Number(process.env.INTERVALO_FILA_MS || 60000);

// O relógio da agenda. Cinco minutos de precisão bastam para uma publicação, e
// olhar de minuto em minuto seria leitura no Firestore sem ninguém pedindo nada.
const INTERVALO_AGENDA_MS = Number(process.env.INTERVALO_AGENDA_MS || 5 * 60000);
const UMA_VEZ = process.argv.includes('--uma-vez');

let encerrando = false;

function log(nivel, msg, extra) {
  const linha = { hora: new Date().toISOString(), nivel, msg, ...extra };
  console.log(JSON.stringify(linha));
}

async function processarUma() {
  const tarefa = await pegarProximaTarefa();
  if (!tarefa) return false;

  log('info', 'tarefa iniciada', { id: tarefa.id, tipo: tarefa.tipo, consultorId: tarefa.consultorId });
  const comecou = Date.now();

  const executor = EXECUTORES[tarefa.tipo];
  if (!executor) {
    await falharTarefa(tarefa.id, `Tipo de tarefa desconhecido: ${tarefa.tipo}`, 99);
    log('erro', 'tipo desconhecido', { id: tarefa.id, tipo: tarefa.tipo });
    return true;
  }

  try {
    const resultado = await executor(tarefa);
    await concluirTarefa(tarefa.id);
    if (resultado?.ignorada && tarefa.campanhaId) {
      await normalizarCampanhaSemTarefaAtiva(tarefa.campanhaId).catch(() => {});
    }
    log('info', 'tarefa concluida', {
      id: tarefa.id,
      segundos: Math.round((Date.now() - comecou) / 1000),
      ...resultado,
    });
  } catch (e) {
    const desistiu = await falharTarefa(tarefa.id, e?.message || e, tarefa.tentativas);
    if (desistiu && tarefa.campanhaId) {
      await atualizarCampanha(tarefa.campanhaId, {
        status: 'erro',
        erro: String(e?.message || e).slice(0, 500),
      }).catch(() => {});
    }
    log('erro', desistiu ? 'tarefa falhou em definitivo' : 'tarefa falhou, vai tentar de novo', {
      id: tarefa.id,
      tentativas: tarefa.tentativas,
      erro: String(e?.message || e).slice(0, 300),
    });
  }
  return true;
}

/** Processa até a fila secar. Uma execução por vez, mesmo se a campainha tocar junto. */
let drenando = false;
async function drenarFila() {
  if (drenando || encerrando) return;
  drenando = true;
  try {
    while (!encerrando) {
      let teve = false;
      try {
        teve = await processarUma();
      } catch (e) {
        // Falha ao ler a fila (rede, permissão). Não derruba o worker.
        log('erro', 'falha ao consultar a fila', { erro: String(e?.message || e).slice(0, 300) });
        return;
      }
      if (!teve) return;
    }
  } finally {
    drenando = false;
  }
}

/**
 * Olha o calendário e põe na fila o que venceu.
 *
 * Não publica aqui: só enfileira. Publicar é tarefa como qualquer outra, com
 * registro de início, erro e conclusão — e uma por vez, para não sair em rajada.
 */
async function baterONoRelogio() {
  if (encerrando) return;
  try {
    const recuperadas = await recuperarTarefasTravadas();
    if (recuperadas.length) log('info', 'tarefas travadas recuperadas', { recuperadas });
    const enfileiradas = await conferirAgenda();
    if (enfileiradas.length) log('info', 'peças agendadas entraram na fila', { quantas: enfileiradas.length, enfileiradas });
  } catch (e) {
    // A agenda falhar não pode derrubar o worker: a fila continua atendendo.
    log('erro', 'falha ao conferir a agenda', { erro: String(e?.message || e).slice(0, 300) });
  }
}

async function laco() {
  if (UMA_VEZ) {
    const teve = await processarUma().catch((e) => {
      log('erro', 'falha ao consultar a fila', { erro: String(e?.message || e).slice(0, 300) });
      return false;
    });
    log('info', 'modo uma-vez, encerrando', { processou: teve });
    return;
  }

  log('info', 'worker iniciado', { modo: 'ouvinte', batidaMs: INTERVALO_MS });

  // A campainha: acorda na hora em que a tarefa entra na fila.
  const parar = ouvirFila((erro) => {
    if (erro) {
      log('erro', 'ouvinte da fila falhou', { erro: String(erro?.message || erro).slice(0, 300) });
      return;
    }
    void drenarFila();
  });

  // Uma passada na subida: pega o que entrou enquanto o worker estava fora do ar.
  void drenarFila();
  void baterONoRelogio();

  // Batida de segurança. Se o ouvinte cair sem avisar, o worker não fica mudo.
  const batida = setInterval(() => { void drenarFila(); }, INTERVALO_MS);
  const relogio = setInterval(() => { void baterONoRelogio(); }, INTERVALO_AGENDA_MS);

  await new Promise((resolve) => {
    const conferir = setInterval(() => {
      if (!encerrando) return;
      clearInterval(conferir);
      clearInterval(batida);
      clearInterval(relogio);
      parar();
      resolve();
    }, 500);
  });
}

// Encerramento limpo: termina a tarefa atual antes de sair.
for (const sinal of ['SIGTERM', 'SIGINT']) {
  process.on(sinal, () => {
    log('info', 'encerrando apos a tarefa atual', { sinal });
    encerrando = true;
  });
}

laco().catch((e) => {
  log('erro', 'worker parou', { erro: String(e?.message || e) });
  process.exit(1);
});
