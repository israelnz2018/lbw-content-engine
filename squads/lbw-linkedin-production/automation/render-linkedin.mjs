import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const squadRoot = path.resolve(scriptDir, '..');
const projectRoot = path.resolve(squadRoot, '..', '..');

const configPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!configPath || !fs.existsSync(configPath)) throw new Error('Informe um arquivo JSON de configuração existente.');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (!/^\d{4}-\d{2}-\d{2}$/.test(config.date || '')) throw new Error('A data deve usar YYYY-MM-DD.');
if (!config.title && !config.frase) throw new Error('Informe "title" (post normal) ou "frase" (layout citação).');

const slug = String(config.slug || 'post').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const base = `${config.date}__${slug}`;
const entregas = config.outputRoot
  ? path.resolve(config.outputRoot)
  : path.resolve(projectRoot, 'ENTREGAS');
const outDir = path.resolve(entregas, 'LINKEDIN', base);
fs.mkdirSync(outDir, { recursive: true });

// LinkedIn: 1200x627 é o padrão de post com imagem; 1080x1080 para feed quadrado.
const FORMATOS = { paisagem: [1200, 627], quadrado: [1080, 1080] };
const [W, H] = FORMATOS[String(config.formato || 'paisagem').toLowerCase()] || FORMATOS.paisagem;

function dataUrl(file) {
  if (!file || !fs.existsSync(file)) return '';
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

const logo = dataUrl(path.resolve(projectRoot, 'assets/marca/logo-lbw-branca.png'));
if (!logo) throw new Error('Logo oficial não encontrada em assets/marca/.');

const PESSOAS_DIR = path.resolve(projectRoot, 'assets/pessoas/recortadas');
const pessoas = fs.existsSync(PESSOAS_DIR) ? fs.readdirSync(PESSOAS_DIR).filter(f => f.endsWith('.png')) : [];

function pessoaUrl(ref) {
  if (!ref) return '';
  const key = String(ref).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const hit = pessoas.find(f => f.toLowerCase().includes(key));
  if (!hit) { console.warn(`aviso: pessoa "${ref}" nao encontrada`); return ''; }
  return dataUrl(path.join(PESSOAS_DIR, hit));
}

const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rich = v => esc(v).replace(/\*(.+?)\*/g, '<span class="hl">$1</span>');
const plain = v => String(v ?? '').replace(/\*/g, '');

const modoCitacao = String(config.layout || '').toLowerCase() === 'citacao';
const img = modoCitacao ? '' : pessoaUrl(config.pessoa);
const numero = config.numero ? `<div class="numero">${esc(config.numero)}</div>` : '';
const fonte = config.fonte ? `<div class="fonte">Fonte: ${esc(config.fonte)}</div>` : '';
const body = config.body ? `<p class="body">${rich(config.body)}</p>` : '';

// Linguagem visual do LinkedIn: sóbria, clara, muito respiro.
// Deliberadamente diferente do Instagram — nada de caixa alta gritada ou fundo escuro.
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
body{font-family:Arial,Helvetica,sans-serif;background:#FFFFFF}
.page{width:${W}px;height:${H}px;display:flex;flex-direction:column;background:#FFFFFF}
.brand{flex:0 0 ${Math.round(H * 0.13)}px;display:flex;align-items:center;gap:16px;background:#0A2A5E;padding:0 ${Math.round(W * 0.04)}px}
.brand img{width:${Math.round(H * 0.085)}px;height:${Math.round(H * 0.085)}px;object-fit:contain}
.brand span{color:#fff;font-size:${Math.round(H * 0.036)}px;font-weight:800;letter-spacing:.4px}
.main{flex:1 1 auto;display:flex;align-items:center;gap:${Math.round(W * 0.03)}px;padding:${Math.round(H * 0.07)}px ${Math.round(W * 0.04)}px}
.col{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;justify-content:center}
.numero{font-size:${Math.round(H * 0.20)}px;font-weight:900;color:#1B4FD8;line-height:.92;letter-spacing:-3px}
.title{font-size:${Math.round(H * 0.085)}px;line-height:1.12;color:#0A2A5E;font-weight:900;margin:0;letter-spacing:-.8px}
.hl{color:#1B4FD8}
.rule{width:${Math.round(W * 0.09)}px;height:6px;background:#1B4FD8;margin:${Math.round(H * 0.035)}px 0}
.body{font-size:${Math.round(H * 0.043)}px;line-height:1.35;color:#3A5B80;font-weight:700;margin:0;max-width:95%}
.fonte{margin-top:${Math.round(H * 0.03)}px;font-size:${Math.round(H * 0.028)}px;color:#6D89AB;font-weight:700}
.person{flex:0 0 ${Math.round(W * 0.26)}px;align-self:stretch;display:flex;align-items:flex-end;justify-content:center}
.person img{width:100%;height:100%;object-fit:contain;object-position:bottom center}
.foot{flex:0 0 ${Math.round(H * 0.028)}px;background:#1B4FD8}

/* Modo citação: frase grande, muito respiro, sem pessoa.
   Formato dos posts de texto que performam bem no LinkedIn. */
.main.citacao{flex-direction:column;justify-content:center;align-items:flex-start;padding:${Math.round(H * 0.09)}px ${Math.round(W * 0.075)}px}
.aspas{font-size:${Math.round(H * 0.16)}px;line-height:.7;color:#1B4FD8;font-weight:900;margin-bottom:${Math.round(H * 0.01)}px}
.frase{font-size:${Math.round(H * 0.093 * (Number(config.quoteScale) || 1))}px;line-height:1.16;color:#0A2A5E;font-weight:900;letter-spacing:-1.5px;margin:0}
.credito{margin-top:${Math.round(H * 0.055)}px;font-size:${Math.round(H * 0.03)}px;color:#6D89AB;font-weight:700;line-height:1.4}
.credito strong{color:#0A2A5E;font-weight:900}
</style></head><body>
<main class="page">
  <header class="brand"><img src="${logo}"><span>EDUCAÇÃO PELO TRABALHO</span></header>
  ${modoCitacao ? `
  <section class="main citacao">
    <div class="aspas">&ldquo;</div>
    <p class="frase">${rich(config.frase || config.title)}</p>
    ${config.fonte ? `<div class="credito"><strong>Fonte:</strong> ${esc(config.fonte)}</div>` : ''}
  </section>` : `
  <section class="main">
    <div class="col">
      ${numero}
      <h1 class="title">${rich(config.title)}</h1>
      <div class="rule"></div>
      ${body}
      ${fonte}
    </div>
    ${img ? `<div class="person"><img src="${img}" alt=""></div>` : ''}
  </section>`}
  <div class="foot"></div>
</main></body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });

const imagePath = path.join(outDir, 'imagem.png');
await page.screenshot({ path: imagePath, type: 'png' });
await browser.close();

// O texto do post acompanha a imagem, como em toda entrega.
const textoPath = path.join(outDir, 'post.md');
const texto = config.post
  ? String(config.post)
  : [`# ${plain(config.title)}`, '', plain(config.body), config.fonte ? `\nFonte: ${config.fonte}` : ''].join('\n');
fs.writeFileSync(textoPath, texto, 'utf8');

console.log(JSON.stringify({ campanha: base, formato: `${W}x${H}`, imagePath, textoPath }, null, 2));
