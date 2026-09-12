/** Diagnostico rapido do estado do marketing no Firestore. Nao altera nada. */
import { db, COLECOES } from './firestore.mjs';
for (const col of ['videos', 'campanhas', 'pecas', 'tarefas']) {
  const s = await db().collection(COLECOES[col]).get();
  console.log(`\n== ${col} (${s.size})`);
  s.forEach(d => {
    const x = d.data();
    console.log(' ', d.id, '|', x.status || '-', '|', x.arquivoUrl || x.titulo || x.tipo || '');
  });
}
