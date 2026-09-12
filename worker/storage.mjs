/**
 * Envio das peças geradas para o Firebase Storage.
 *
 * Caminho: marketing/{consultorId}/{campanhaId}/{tipo}/{arquivo}
 * Cada consultor só enxerga o que está debaixo do próprio consultorId.
 */
import fs from 'node:fs';
import path from 'node:path';
import { bucket } from './firestore.mjs';

const TIPOS_MIME = {
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function mime(arquivo) {
  return TIPOS_MIME[path.extname(arquivo).toLowerCase()] || 'application/octet-stream';
}

/**
 * Sobe um arquivo e devolve o caminho dentro do bucket.
 *
 * Não devolve URL assinada aqui de propósito: link assinado vence, e guardar link
 * vencido no Firestore gera peça que "some" depois. A tela pede a URL na hora de
 * exibir, a partir deste caminho.
 */
export async function enviarArquivo(caminhoLocal, { consultorId, campanhaId, tipo }) {
  const nome = path.basename(caminhoLocal);
  const destino = `marketing/${consultorId}/${campanhaId}/${tipo}/${nome}`;

  await bucket().upload(caminhoLocal, {
    destination: destino,
    metadata: {
      contentType: mime(nome),
      // Cache curto: a peça pode ser regerada quando o consultor pedir melhoria.
      cacheControl: 'private, max-age=300',
      metadata: { consultorId, campanhaId, tipo },
    },
  });

  return destino;
}

/** Sobe todos os arquivos de uma pasta. Ignora subpastas de trabalho. */
export async function enviarPasta(pastaLocal, contexto) {
  if (!fs.existsSync(pastaLocal)) return [];

  const arquivos = fs.readdirSync(pastaLocal, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.join(pastaLocal, e.name))
    .sort();

  const enviados = [];
  for (const arquivo of arquivos) {
    enviados.push(await enviarArquivo(arquivo, contexto));
  }
  return enviados;
}

/** Baixa um arquivo do Storage para processar localmente. */
export async function baixarArquivo(caminhoBucket, destinoLocal) {
  fs.mkdirSync(path.dirname(destinoLocal), { recursive: true });
  await bucket().file(caminhoBucket).download({ destination: destinoLocal });
  return destinoLocal;
}
