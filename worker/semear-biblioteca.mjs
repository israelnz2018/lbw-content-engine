/**
 * Põe as 12 pessoas da casa na biblioteca de imagens.
 *
 * Elas viviam só na pasta assets/pessoas, dentro do worker, e a tela tinha a lista
 * escrita à mão. Com a biblioteca no banco, tela e renderizador passam a ler o
 * mesmo lugar — e as imagens geradas e enviadas entram ao lado delas.
 *
 * Pode rodar de novo sem estragar nada: a ficha é gravada por cima com os mesmos
 * dados, e o contador de uso de cada uma é preservado.
 *
 *   node semear-biblioteca.mjs            grava
 *   node semear-biblioteca.mjs --ver      só mostra o que gravaria
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, bucket, COLECOES } from './firestore.mjs';
import { PREFIXO_ELENCO } from './imagens.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA = path.join(raiz, 'assets/pessoas/recortadas');
const SO_VER = process.argv.includes('--ver');

// De assets/pessoas/CATALOGO.md. As etiquetas usam o MESMO vocabulário da tela
// (ETIQUETAS_PESSOA em src/types/marketing.ts na plataforma): é por elas que a
// busca encontra "já tenho algo parecido" antes de gerar outra.
//
// `automatica` é o rodízio de quem não escolheu ninguém — as mesmas 8 de antes:
// frustração, sobrecarga, ceticismo e confusão só entram quando alguém pede.
const ELENCO = [
  ['01-frustracao-mulher-30', 'Analista frustrada', 'analista', 'escritorio', 'frustracao', false, ['problema', 'retrabalho', 'caos']],
  ['02-decisao-mulher-30', 'Analista confiante', 'analista', 'escritorio', 'decisao', true, ['solução', 'método', 'conclusão']],
  ['03-duvida-homem-40', 'Gestor em dúvida', 'gestor', 'escritorio', 'duvida', true, ['pergunta', 'diagnóstico', 'por quê']],
  ['04-explicando-homem-40', 'Gestor explicando', 'gestor', 'escritorio', 'explicando', true, ['passo a passo', 'ensino']],
  ['05-sobrecarga-homem-20', 'Júnior sobrecarregado', 'analista', 'escritorio', 'sobrecarga', false, ['excesso de trabalho', 'desorganização']],
  ['06-insight-homem-20', 'Júnior com uma ideia', 'analista', 'escritorio', 'insight', true, ['virada', 'causa raiz', 'descoberta']],
  ['07-apontando-mulher-40', 'Engenheira apontando', 'engenheiro', 'fabrica', 'apontando', true, ['chão de fábrica', 'causa', 'gemba']],
  ['08-foco-mulher-40', 'Engenheira medindo', 'engenheiro', 'fabrica', 'foco', true, ['medição', 'auditoria', 'coleta de dados']],
  ['09-ceticismo-homem-50', 'Diretor cético', 'diretor', 'escritorio', 'ceticismo', false, ['resistência', 'stakeholder']],
  ['10-confusao-mulher-20', 'Júnior confusa', 'analista', 'escritorio', 'confusao', false, ['processo sem padrão', 'falta de clareza']],
  ['11-explicando-homem-30', 'Analista de dados explicando', 'analista', 'escritorio', 'explicando', true, ['análise', 'indicador', 'número']],
  ['12-lideranca-mulher-30', 'Líder apresentando', 'lider', 'escritorio', 'lideranca', true, ['liderança', 'equipe', 'chamada']],
];

let gravadas = 0;
for (const [nome, titulo, papel, ambiente, emocao, automatica, temas] of ELENCO) {
  const arquivoLocal = path.join(PASTA, `pessoa-${nome}-recortada.png`);
  if (!fs.existsSync(arquivoLocal)) {
    console.error(`falta o arquivo ${arquivoLocal}`);
    process.exitCode = 1;
    continue;
  }
  const [, genero, idade] = nome.match(/-(mulher|homem)-(\d+)$/) || [];
  const id = `${PREFIXO_ELENCO}${nome}`;
  const caminho = `marketing/_biblioteca/imagens/${id}/imagem.png`;

  const ficha = {
    id,
    tipo: 'pessoa',
    origem: 'elenco',
    status: 'aprovada',
    publica: true,
    automatica,
    consultorId: 'lbw',
    titulo,
    etiquetas: { papel, ambiente, emocao, genero, idade },
    temas,
    arquivo: caminho,
    original: caminho,
    atualizadoEm: new Date().toISOString(),
  };

  if (SO_VER) {
    console.log(`${id}  ${automatica ? 'rodízio' : '       '}  ${titulo}`);
    continue;
  }

  await bucket().upload(arquivoLocal, {
    destination: caminho,
    metadata: { contentType: 'image/png', cacheControl: 'private, max-age=86400' },
  });
  const ref = db().collection(COLECOES.imagens).doc(id);
  const atual = await ref.get();
  await ref.set({
    ...ficha,
    criadoEm: atual.exists ? atual.data().criadoEm : ficha.atualizadoEm,
    vezesUsada: atual.exists ? (atual.data().vezesUsada || 0) : 0,
  });
  gravadas++;
  console.log(`ok  ${id}`);
}

if (!SO_VER) console.log(`\n${gravadas} de ${ELENCO.length} pessoas na biblioteca.`);
