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
import { pegarProximaTarefa, concluirTarefa, falharTarefa } from './firestore.mjs';
import { EXECUTORES } from './executores.mjs';

const INTERVALO_MS = Number(process.env.INTERVALO_FILA_MS || 5000);
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
    log('info', 'tarefa concluida', {
      id: tarefa.id,
      segundos: Math.round((Date.now() - comecou) / 1000),
      ...resultado,
    });
  } catch (e) {
    const desistiu = await falharTarefa(tarefa.id, e?.message || e, tarefa.tentativas);
    log('erro', desistiu ? 'tarefa falhou em definitivo' : 'tarefa falhou, vai tentar de novo', {
      id: tarefa.id,
      tentativas: tarefa.tentativas,
      erro: String(e?.message || e).slice(0, 300),
    });
  }
  return true;
}

async function laco() {
  log('info', 'worker iniciado', { intervaloMs: INTERVALO_MS });

  while (!encerrando) {
    let teveTrabalho = false;
    try {
      teveTrabalho = await processarUma();
    } catch (e) {
      // Falha ao ler a fila (rede, permissão). Não derruba o worker.
      log('erro', 'falha ao consultar a fila', { erro: String(e?.message || e).slice(0, 300) });
    }

    if (UMA_VEZ) {
      log('info', 'modo uma-vez, encerrando', { processou: teveTrabalho });
      return;
    }
    // Só espera quando a fila está vazia. Com trabalho, emenda na próxima.
    if (!teveTrabalho) await new Promise((r) => setTimeout(r, INTERVALO_MS));
  }
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
