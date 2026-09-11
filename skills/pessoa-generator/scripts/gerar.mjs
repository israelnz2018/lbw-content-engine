import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..', '..', '..');
const LIB = path.resolve(projectRoot, 'assets/pessoas');
const ORIGINAIS = path.join(LIB, 'originais');
const RECORTADAS = path.join(LIB, 'recortadas');

const MODEL = process.env.PESSOA_MODEL || 'black-forest-labs/FLUX-1-dev';

const BASE = 'candid documentary-style photograph, waist-up framing, photorealistic, '
  + 'natural skin texture, sharp focus, high detail, soft even studio lighting, '
  + 'plain solid light grey seamless studio backdrop, no text, no logo, no watermark';

const slug = process.argv[2];
const subject = process.argv[3];

if (!slug || !subject) {
  console.error('uso: node gerar.mjs "<slug>" "<descricao em ingles>"');
  console.error('ex:  node gerar.mjs "13-negociando-homem-30" "A Brazilian man in his thirties, ..."');
  process.exit(1);
}

const safeSlug = String(slug).toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── Acúmulo: nunca gerar se já existe algo com esse slug ──────
fs.mkdirSync(ORIGINAIS, { recursive: true });
fs.mkdirSync(RECORTADAS, { recursive: true });

const jaExiste = [...fs.readdirSync(ORIGINAIS), ...fs.readdirSync(RECORTADAS)]
  .filter(f => f.toLowerCase().includes(safeSlug));

if (jaExiste.length) {
  console.log(`ja existe na biblioteca — nada foi gerado, nada foi cobrado:`);
  jaExiste.forEach(f => console.log(`  ${f}`));
  console.log('\nUse a imagem existente. Se precisar mesmo de outra, escolha um slug diferente.');
  process.exit(0);
}

console.log(`nenhuma pessoa com "${safeSlug}" na biblioteca (${fs.readdirSync(RECORTADAS).length} recortadas hoje). Gerando...`);

const KEY = process.env.DEEPINFRA_API_KEY;
if (!KEY) {
  console.error('erro: DEEPINFRA_API_KEY nao definida. Adicione ao .env da raiz do projeto.');
  process.exit(1);
}

const res = await fetch(`https://api.deepinfra.com/v1/inference/${MODEL}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: `${subject}. ${BASE}`, width: 1024, height: 1024, num_inference_steps: 30 }),
});

const text = await res.text();
if (!res.ok) { console.error(`falha HTTP ${res.status}: ${text.slice(0, 300)}`); process.exit(1); }

let data;
try { data = JSON.parse(text); } catch { console.error('resposta nao-JSON:', text.slice(0, 300)); process.exit(1); }

const img = data.images?.[0];
if (!img) { console.error('sem imagem na resposta. chaves:', Object.keys(data).join(', ')); process.exit(1); }

const outFile = path.join(ORIGINAIS, `pessoa-${safeSlug}.png`);
fs.writeFileSync(outFile, Buffer.from(String(img).replace(/^data:image\/\w+;base64,/, ''), 'base64'));

const cost = data.inference_status?.cost;
console.log(`ok  assets/pessoas/originais/pessoa-${safeSlug}.png  ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB${cost != null ? `  US$ ${cost}` : ''}`);
console.log(`\nproximo: node skills/pessoa-generator/scripts/recortar.mjs "${outFile}"`);
console.log('depois: registrar em assets/pessoas/CATALOGO.md');
