/**
 * Conserta as pecas gravadas antes de escolherPrincipal existir: a previa apontava
 * para legenda.md, que em ordem alfabetica vinha antes de slide-01.png.
 *
 * Le o que esta no Storage e regrava arquivoUrl e arquivos. Nao apaga nada.
 */
import { db, bucket, COLECOES } from './firestore.mjs';

function escolherPrincipal(caminhos = []) {
  const visual = caminhos.find((c) => /\.(png|jpe?g|mp4)$/i.test(c));
  const documento = caminhos.find((c) => /\.pdf$/i.test(c));
  return visual || documento || caminhos[0] || null;
}

const pecas = await db().collection(COLECOES.pecas).get();
for (const doc of pecas.docs) {
  const p = doc.data();
  if (!p.arquivoUrl?.startsWith('marketing/')) continue;

  const prefixo = p.arquivoUrl.split('/').slice(0, 4).join('/') + '/';
  const [arquivos] = await bucket().getFiles({ prefix: prefixo });
  const caminhos = arquivos.map((a) => a.name).sort();
  const principal = escolherPrincipal(caminhos);

  if (principal === p.arquivoUrl && p.arquivos?.length === caminhos.length) continue;
  await doc.ref.update({ arquivoUrl: principal, arquivos: caminhos });
  console.log(doc.id, '->', principal, `(${caminhos.length} arquivos)`);
}
console.log('pronto');
