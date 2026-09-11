import { removeBackground } from '@imgly/background-removal-node';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..', '..', '..');
const LIB = path.resolve(projectRoot, 'assets/pessoas');

// Sem argumento: varre a biblioteca inteira e recorta só o que ainda falta.
const target = path.resolve(process.argv[2] || path.join(LIB, 'originais'));

if (!fs.existsSync(target)) {
  console.error(`erro: nao encontrado: ${target}`);
  process.exit(1);
}

const isDir = fs.statSync(target).isDirectory();
const outDir = path.resolve(process.argv[3] || path.join(LIB, 'recortadas'));
fs.mkdirSync(outDir, { recursive: true });

const candidatos = isDir
  ? fs.readdirSync(target).filter(f => f.toLowerCase().endsWith('.png')).sort().map(f => path.join(target, f))
  : [target];

// Acúmulo: pula o que já tem versão recortada.
const pendentes = candidatos.filter(src => {
  const dst = path.join(outDir, path.basename(src).replace(/\.png$/i, '-recortada.png'));
  return !fs.existsSync(dst);
});

const jaFeitos = candidatos.length - pendentes.length;
if (jaFeitos) console.log(`${jaFeitos} ja recortada(s), pulando.`);

if (!pendentes.length) {
  console.log('nada a fazer — a biblioteca esta completa.');
  process.exit(0);
}

let ok = 0, fail = 0;
for (const src of pendentes) {
  const dst = path.join(outDir, path.basename(src).replace(/\.png$/i, '-recortada.png'));
  try {
    const blob = await removeBackground(pathToFileURL(src).href);
    fs.writeFileSync(dst, Buffer.from(await blob.arrayBuffer()));
    console.log(`ok  ${path.basename(dst)}  ${(fs.statSync(dst).size / 1024).toFixed(0)} KB`);
    ok++;
  } catch (e) {
    console.error(`falha  ${path.basename(src)}  ${String(e.message || e).slice(0, 160)}`);
    fail++;
  }
}

console.log(`\n${ok} recortada(s)${fail ? `, ${fail} falha(s)` : ''}`);
console.log(`biblioteca agora: ${fs.readdirSync(outDir).filter(f => f.endsWith('.png')).length} pessoas prontas`);
if (ok) console.log('lembre de registrar os personagens novos em assets/pessoas/CATALOGO.md');
