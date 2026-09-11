import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const squadRoot = path.resolve(scriptDir, '..');
const configPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!configPath || !fs.existsSync(configPath)) throw new Error('Informe um arquivo JSON de configuração existente.');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (!/^\d{4}-\d{2}-\d{2}$/.test(config.date || '')) throw new Error('A data deve usar YYYY-MM-DD.');
if (!Array.isArray(config.slides) || config.slides.length < 6 || config.slides.length > 8) {
  throw new Error('O carrossel deve ter entre 6 e 8 páginas.');
}

const slug = String(config.slug || 'carrossel').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const folderType = String(config.folderType || 'Reels').trim().replace(/[^A-Za-z]/g, '');
const sequenceNumber = Number(config.sequence);
if (!folderType) throw new Error('Informe folderType, por exemplo: Reels ou Videos.');
if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1 || sequenceNumber > 99) {
  throw new Error('Informe sequence entre 1 e 99 para nomear a pasta.');
}
const sequence = String(sequenceNumber).padStart(2, '0');
// Área de entrega única na raiz, organizada por destino.
// A legenda é copiada para toda pasta que recebe peça desta campanha.
const base = `${config.date}__${folderType} - ${sequence}-${slug}`;
const entregas = path.resolve(squadRoot, '..', '..', 'ENTREGAS');
// Cada produto tem sua pasta, e dentro dela uma subpasta por campanha.
const feedDir = path.resolve(entregas, 'FEED', base);         // 7 PNGs 4:5
const reelsDir = path.resolve(entregas, 'REELS', base);       // MP4 9:16 — só se houver vídeo
const linkedinDir = path.resolve(entregas, 'LINKEDIN', base); // documento PDF
// Reels só é criada quando um MP4 for realmente produzido: nada que não seja vídeo entra lá.
for (const d of [feedDir, linkedinDir]) fs.mkdirSync(d, { recursive: true });

function resolveAsset(value) {
  if (!value) return null;
  if (path.isAbsolute(value)) return value;
  const fromConfig = path.resolve(path.dirname(configPath), value);
  if (fs.existsSync(fromConfig)) return fromConfig;
  return path.resolve(squadRoot, value);
}

function dataUrl(file) {
  if (!file || !fs.existsSync(file)) return '';
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

const logo = dataUrl(resolveAsset(config.logoPath) || path.resolve(squadRoot, '..', '..', 'assets/marca/logo-lbw-branca.png'));
if (!logo) throw new Error('Logo oficial não encontrada.');

// ── Biblioteca de pessoas (compartilhada entre os squads) ────
const projectRoot = path.resolve(squadRoot, '..', '..');
const PESSOAS_DIR = path.resolve(projectRoot, 'assets/pessoas/recortadas');
const pessoasDisponiveis = fs.existsSync(PESSOAS_DIR) ? fs.readdirSync(PESSOAS_DIR).filter(f => f.endsWith('.png')) : [];

function pessoaUrl(ref) {
  if (!ref) return '';
  const direct = resolveAsset(ref);
  if (direct && fs.existsSync(direct)) return dataUrl(direct);
  const key = String(ref).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const hit = pessoasDisponiveis.find(f => f.toLowerCase().includes(key));
  if (!hit) {
    console.warn(`aviso: pessoa "${ref}" nao encontrada em ${PESSOAS_DIR}`);
    return '';
  }
  return dataUrl(path.join(PESSOAS_DIR, hit));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// *palavra* vira destaque em azul vivo
function rich(value) {
  return escapeHtml(value).replace(/\*(.+?)\*/g, '<span class="hl">$1</span>');
}

function plain(value) {
  return String(value ?? '').replace(/\*/g, '');
}

const STRIP = Array.isArray(config.processStrip) && config.processStrip.length
  ? config.processStrip
  : ['ENTENDER', 'MAPEAR', 'ANALISAR', 'MELHORAR', 'ENTREGAR VALOR'];
const SIGNATURE = Array.isArray(config.signature) && config.signature.length
  ? config.signature
  : ['MELHORIA de processos', 'RESULTADO na prática'];

function stripMarkup() {
  const items = STRIP.map(label => `<div class="strip-item"><span class="dot"></span><span>${escapeHtml(label)}</span></div>`).join('');
  const sign = SIGNATURE.map(line => {
    const [first, ...rest] = String(line).split(' ');
    return `<div><strong>${escapeHtml(first)}</strong> ${escapeHtml(rest.join(' '))}</div>`;
  }).join('');
  return `<footer class="strip"><div class="strip-items">${items}</div><div class="strip-sign">${sign}</div></footer>`;
}

// ── Corpos por tipo de slide ─────────────────────────────────
function bodyCapa(slide) {
  const img = pessoaUrl(slide.pessoa);
  const sub = slide.sub ? `<div class="sub"><span class="sub-mark">?</span><span>${rich(slide.sub)}</span></div>` : '';
  return `<section class="main capa">
    <div class="capa-text">
      <h1 class="title">${rich(slide.title)}</h1>
      <div class="rule"></div>
      <p class="body">${rich(slide.body)}</p>
      ${sub}
    </div>
    <div class="capa-person">${img ? `<img src="${img}" alt="">` : ''}</div>
  </section>`;
}

function bodyCamadas(slide) {
  const cards = (slide.cards || []).map(card => {
    const items = (card.items || []).map(i => `<div class="card-item">${escapeHtml(i)}</div>`).join('');
    return `<div class="card">
      <div class="card-left"><span class="chip">${escapeHtml(card.chip || '')}</span><div class="card-label">${escapeHtml(card.label || '')}</div></div>
      <div class="card-items">${items}</div>
    </div>`;
  }).join('<div class="link"></div>');
  return `<section class="main light">
    <h1 class="title dark">${rich(slide.title)}</h1>
    <p class="body dim">${rich(slide.body)}</p>
    <div class="cards">${cards}</div>
  </section>`;
}

function bodyDado(slide) {
  const img = pessoaUrl(slide.pessoa);
  const fonte = slide.fonte ? `<div class="fonte">Fonte: ${escapeHtml(slide.fonte)}</div>` : '';
  return `<section class="main light dado">
    <div class="dado-text">
      <div class="numero">${escapeHtml(slide.numero || '')}</div>
      <h1 class="title dark small">${rich(slide.title)}</h1>
      <p class="body dim">${rich(slide.body)}</p>
      ${fonte}
    </div>
    ${img ? `<div class="dado-person"><img src="${img}" alt=""></div>` : ''}
  </section>`;
}

function bodyComparacao(slide) {
  return `<section class="main light">
    <h1 class="title dark">${rich(slide.title)}</h1>
    <p class="body dim">${rich(slide.body)}</p>
    <div class="compare">
      <div class="cmp cmp-neg"><span>${escapeHtml(slide.negativo || 'IMPROVISO')}</span></div>
      <div class="cmp-arrow">&rarr;</div>
      <div class="cmp cmp-pos"><span>${escapeHtml(slide.positivo || 'MÉTODO')}</span></div>
    </div>
  </section>`;
}

function bodyCta(slide) {
  const img = pessoaUrl(slide.pessoa);
  const palavra = slide.palavra ? `<div class="cta-word">Comente <span class="hl">'${escapeHtml(slide.palavra)}'</span></div>` : '';
  return `<section class="main capa cta">
    <div class="capa-text">
      <h1 class="title">${rich(slide.title)}</h1>
      <div class="rule"></div>
      <p class="body">${rich(slide.body)}</p>
      ${palavra}
    </div>
    <div class="capa-person">${img ? `<img src="${img}" alt="">` : ''}</div>
  </section>`;
}

function bodyPadrao(slide) {
  const img = pessoaUrl(slide.pessoa);
  return `<section class="main light dado">
    <div class="dado-text">
      <h1 class="title dark">${rich(slide.title)}</h1>
      <p class="body dim">${rich(slide.body)}</p>
    </div>
    ${img ? `<div class="dado-person"><img src="${img}" alt=""></div>` : ''}
  </section>`;
}

const BUILDERS = { capa: bodyCapa, camadas: bodyCamadas, dado: bodyDado, comparacao: bodyComparacao, cta: bodyCta, padrao: bodyPadrao };

const cssFor = (H) => `
*{box-sizing:border-box}
html,body{margin:0;width:1080px;height:${H}px;overflow:hidden}
body{font-family:Arial,Helvetica,sans-serif}
.page{width:1080px;height:${H}px;display:flex;flex-direction:column;background:#EEF3FA;overflow:hidden}
.page.dark{background:#0A2A5E}

.brand{flex:0 0 96px;display:flex;align-items:center;gap:22px;background:#0A2A5E;padding:0 54px;border-bottom:4px solid #1B4FD8}
.brand img{width:62px;height:62px;object-fit:contain}
.brand span{color:#fff;font-size:29px;font-weight:800;letter-spacing:.6px}

.main{flex:1 1 auto;display:flex;min-height:0;padding:48px 54px 30px}
.main.light{flex-direction:column;background:#EEF3FA}
.hl{color:#1B4FD8}
.page.dark .hl{color:#5B93FF}

.title{font-size:78px;line-height:1.02;letter-spacing:-2px;margin:0;text-transform:uppercase;font-style:italic;font-weight:900;color:#fff}
.title.dark{color:#0A2A5E}
.title.small{font-size:56px}
.body{font-size:35px;line-height:1.22;font-weight:700;color:#C9D8EE;margin:22px 0 0}
.body.dim{color:#3A5B80}
.rule{width:100%;height:4px;background:#1B4FD8;margin:26px 0 0;opacity:.8}

/* capa e cta */
.capa{align-items:stretch;gap:0;padding:0 54px 0;position:relative}
.capa-text{flex:1 1 50%;display:flex;flex-direction:column;justify-content:flex-start;min-width:0;padding:58px 0 30px;position:relative;z-index:2}
.capa .title{font-size:86px}
.capa-person{flex:0 0 50%;display:flex;align-items:flex-end;justify-content:flex-end;min-width:0;margin-left:-36px;overflow:visible}
.capa-person img{width:165%;height:auto;max-width:none;max-height:100%;object-fit:contain;object-position:bottom right;transform:translateX(7%)}
.sub{display:flex;align-items:center;gap:16px;margin-top:34px;color:#9FBCE6;font-size:28px;font-weight:700}
.sub-mark{flex:0 0 46px;height:46px;border-radius:50%;background:#1B4FD8;color:#fff;display:flex;align-items:center;justify-content:center;font-size:27px;font-weight:900}
.cta-word{margin-top:30px;font-size:44px;font-style:italic;font-weight:900;color:#fff}

/* camadas */
.cards{flex:1 1 auto;display:flex;flex-direction:column;justify-content:center;margin-top:26px;min-height:0}
.card{display:flex;align-items:center;gap:26px;background:#fff;border:2px solid #DCE6F2;border-radius:22px;padding:22px 28px;box-shadow:0 10px 26px rgba(10,42,94,.10)}
.card-left{flex:0 0 33%}
.chip{display:inline-block;background:#1B4FD8;color:#fff;font-size:20px;font-weight:900;letter-spacing:1px;padding:7px 15px;border-radius:8px}
.card-label{font-size:42px;font-weight:900;color:#0A2A5E;line-height:1.04;margin-top:10px;text-transform:uppercase}
.card-items{flex:1 1 auto;display:flex;gap:14px}
.card-item{flex:1;background:#EEF3FA;border-radius:14px;padding:16px 12px;text-align:center;font-size:24px;font-weight:700;color:#3A5B80;display:flex;align-items:center;justify-content:center}
.link{width:5px;height:26px;background:#1B4FD8;margin:0 auto;opacity:.5}

/* dado e padrao */
.main.light.dado{flex-direction:row;align-items:stretch;gap:20px;padding-bottom:0}
.dado-text{flex:1 1 56%;display:flex;flex-direction:column;justify-content:flex-start;min-width:0;padding-top:14px;position:relative;z-index:2}
.dado-person{flex:0 0 44%;display:flex;align-items:flex-end;justify-content:flex-end;min-width:0;margin-left:-24px;overflow:visible}
.dado-person img{width:160%;height:auto;max-width:none;max-height:100%;object-fit:contain;object-position:bottom right;transform:translateX(8%)}
.numero{font-size:168px;font-weight:900;color:#1B4FD8;line-height:.9;letter-spacing:-6px;font-style:italic}
.fonte{margin-top:22px;font-size:23px;font-weight:700;color:#6D89AB}

/* comparacao */
.compare{flex:1 1 auto;display:flex;align-items:center;gap:22px;margin-top:28px;min-height:0}
.cmp{flex:1;height:72%;border-radius:26px;display:flex;align-items:center;justify-content:center;text-align:center;padding:26px;font-size:44px;font-weight:900;text-transform:uppercase;font-style:italic}
.cmp-neg{background:#DCE6F2;color:#4A688C}
.cmp-pos{background:#1B4FD8;color:#fff}
.cmp-arrow{font-size:64px;font-weight:900;color:#1B4FD8}

/* faixa de processo */
.strip{flex:0 0 112px;display:flex;align-items:center;justify-content:space-between;gap:18px;background:#0A2A5E;padding:0 40px;border-top:4px solid #1B4FD8}
.strip-items{display:flex;align-items:center;gap:15px;flex-wrap:nowrap;flex:0 1 auto;min-width:0}
.strip-item{display:flex;align-items:center;gap:7px;color:#C9D8EE;font-size:16px;font-weight:800;letter-spacing:.4px;white-space:nowrap}
.dot{width:11px;height:11px;border-radius:3px;background:#1B4FD8;flex:0 0 11px}
.strip-sign{text-align:right;color:#9FBCE6;font-size:16px;font-weight:700;line-height:1.35;white-space:nowrap;flex:0 0 auto}
.strip-sign strong{color:#fff;font-weight:900}

/* ── Variante 9:16: ocupa a altura extra em vez de deixar vazio ── */
.tall .main{padding:60px 54px 36px}
.tall .title{font-size:94px}
.tall .title.small{font-size:66px}
.tall .capa .title{font-size:104px}
.tall .body{font-size:44px;line-height:1.24;margin-top:30px}
.tall .rule{margin-top:34px;height:5px}
.tall .numero{font-size:230px}
.tall .sub{font-size:34px;margin-top:44px}
.tall .sub-mark{flex:0 0 56px;height:56px;font-size:33px}
.tall .cta-word{font-size:56px;margin-top:40px}
.tall .cards{justify-content:center;margin-top:40px;gap:0}
.tall .card{padding:34px 32px;border-radius:26px}
.tall .card-label{font-size:52px;margin-top:14px}
.tall .chip{font-size:24px;padding:9px 18px}
.tall .card-item{font-size:29px;padding:24px 14px;border-radius:18px}
.tall .link{height:34px;width:6px}
.tall .compare{margin-top:40px;gap:28px}
.tall .cmp{font-size:56px;height:80%;border-radius:32px}
.tall .cmp-arrow{font-size:80px}
.tall .fonte{font-size:28px;margin-top:30px}
.tall .capa-text{padding:70px 0 40px}
.tall .capa-person img{width:180%}
.tall .dado-person img{width:175%}
.tall .strip{flex:0 0 128px}
.tall .strip-item{font-size:18px}
.tall .strip-sign{font-size:18px}
`;

function slideHtml(slide, H = 1350) {
  const type = String(slide.type || 'padrao').toLowerCase();
  const build = BUILDERS[type] || bodyPadrao;
  const isDark = type === 'capa' || type === 'cta';
  const tall = H >= 1600 ? ' tall' : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${cssFor(H)}</style></head><body>
<main class="page${isDark ? ' dark' : ''}${tall}">
  <header class="brand"><img src="${logo}"><span>EDUCAÇÃO PELO TRABALHO</span></header>
  ${build(slide)}
  ${stripMarkup()}
</main></body></html>`;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
const pngPaths = [];

for (let index = 0; index < config.slides.length; index++) {
  const slide = config.slides[index];
  const wordCount = `${plain(slide.title)} ${plain(slide.body)}`.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > 32) throw new Error(`Página ${index + 1} excede 32 palavras.`);
  await page.setContent(slideHtml(slide), { waitUntil: 'load' });
  await page.evaluate(() => window.scrollTo(0, 0));
  const filename = `slide-${String(index + 1).padStart(2, '0')}.png`;
  const destination = path.join(feedDir, filename);
  await page.screenshot({ path: destination, type: 'png' });
  pngPaths.push(destination);
}

const pdfPages = pngPaths.map(file => `<section><img src="${dataUrl(file)}"></section>`).join('');
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:1080px 1350px;margin:0}html,body{margin:0}section{width:1080px;height:1350px;page-break-after:always}section:last-child{page-break-after:auto}img{width:1080px;height:1350px;display:block}</style></head><body>${pdfPages}</body></html>`, { waitUntil: 'load' });
const pdfPath = path.join(linkedinDir, 'documento.pdf');
await page.pdf({ path: pdfPath, width: '1080px', height: '1350px', printBackground: true });

// ── Passe de vídeo 9:16 (Reels, TikTok, Shorts) ──────────────
// Os quadros são redesenhados em 1080x1920, não esticados a partir do 4:5.
let videoPath = null;
const video = config.video;
if (video && video.enabled !== false) {
  const VH = 1920;
  const segundos = Number(video.secondsPerSlide) > 0 ? Number(video.secondsPerSlide) : 5;
  fs.mkdirSync(reelsDir, { recursive: true });
  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lbw-reel-'));

  const vPage = await browser.newPage({ viewport: { width: 1080, height: VH }, deviceScaleFactor: 1 });
  const frames = [];
  for (let i = 0; i < config.slides.length; i++) {
    await vPage.setContent(slideHtml(config.slides[i], VH), { waitUntil: 'load' });
    await vPage.evaluate(() => window.scrollTo(0, 0));
    const fp = path.join(frameDir, `frame-${String(i + 1).padStart(2, '0')}.png`);
    await vPage.screenshot({ path: fp, type: 'png' });
    frames.push(fp);
  }
  await vPage.close();

  videoPath = path.join(reelsDir, 'reel.mp4');
  try {
    const inputs = frames.flatMap(frame => ['-loop', '1', '-t', String(segundos), '-i', frame]);
    const normalize = frames.map((_, i) => `[${i}:v]fps=30,format=yuv420p[v${i}]`).join(';');
    const concatInputs = frames.map((_, i) => `[v${i}]`).join('');
    const filter = `${normalize};${concatInputs}concat=n=${frames.length}:v=1:a=0[outv]`;
    execFileSync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      ...inputs,
      '-filter_complex', filter, '-map', '[outv]', '-r', '30',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      videoPath,
    ], { stdio: 'pipe' });
  } catch (e) {
    console.error('falha no ffmpeg:', String(e.stderr || e.message).slice(0, 400));
    videoPath = null;
  }

  fs.rmSync(frameDir, { recursive: true, force: true });
}

const content = [`# ${config.date} | ${config.slug}`, '', ...config.slides.flatMap((slide, i) => [`## Página ${i + 1}`, '', plain(slide.title), '', plain(slide.body), ''])].join('\n');
// A legenda acompanha cada peça, em toda pasta que recebeu algo desta campanha.
// Só recebe legenda a pasta que de fato recebeu peça desta campanha.
const destinosLegenda = [feedDir, linkedinDir, ...(videoPath ? [reelsDir] : [])];
const legendas = [];
for (const d of destinosLegenda) {
  const p = path.join(d, 'legenda.md');
  fs.writeFileSync(p, content, 'utf8');
  legendas.push(p);
}
const contentPath = legendas[0];
await browser.close();

console.log(JSON.stringify({ campanha: base, feedDir, slides: pngPaths.length, pngPaths, videoPath, pdfPath, contentPath }, null, 2));
