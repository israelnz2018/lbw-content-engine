/**
 * Capa 16:9 para vídeo longo do YouTube — 1280x720, o formato clássico de
 * thumbnail, diferente da capa 9:16 do Reel (render-reel-cover.mjs).
 *
 * Nasceu porque o YouTube não tem onde entrar nessa conversa até agora: o
 * `publicar.mjs` só sabe subir Short (sempre vertical, sempre com #Shorts na
 * descrição, sempre a partir de um Reel). Vídeo longo — uma aula inteira — é
 * outro fluxo, e thumbnail de vídeo longo é o principal motivo de clique,
 * bem diferente do Short, que toca sozinho no feed sem mostrar capa nenhuma.
 *
 * Reaproveita da capa do Reel o que já foi resolvido: a paleta por curso, o
 * jeito de medir o gancho de verdade no navegador em vez de confiar em CSS
 * sozinho, e a regra de nunca truncar por contagem de palavra — só encolher
 * até caber, e falhar apenas se for fisicamente impossível.
 *
 * Uso:
 *   node render-youtube-thumbnail.mjs --config config.json --portrait retrato.png --output capa.jpg
 *
 * config.json:
 *   { "logoPath": "...", "thumb": { "courseKey": "white-belt",
 *     "seriesLabel": "WHITE BELT", "episode": "01" | "PARTE 1",
 *     "hookLines": ["GANCHO", "SEM LIMITE DE PALAVRA"] } }
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Argumento obrigatorio ausente: ${name}`);
  return process.argv[index + 1];
}

function fileDataUrl(filePath) {
  const mime = path.extname(filePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

const configPath = path.resolve(argument('--config'));
const portraitPath = path.resolve(argument('--portrait'));
const outputPath = path.resolve(argument('--output'));
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const thumb = config.thumb;

if (!thumb) throw new Error('A configuracao precisa do bloco "thumb".');
if (!fs.existsSync(config.logoPath)) throw new Error(`Logo nao encontrada: ${config.logoPath}`);
if (!fs.existsSync(portraitPath)) throw new Error(`Retrato nao encontrado: ${portraitPath}`);

// MESMA paleta da capa do Reel (render-reel-cover.mjs) — é a mesma marca em
// outro formato, não uma marca nova. Se uma mudar, a outra tem que mudar junto.
const palettes = {
  'white-belt': { background: '#FFFFFF', ink: '#062B61', accent: '#0757FF', highlight: '#F4C430', label: 'WHITE BELT' },
  'yellow-belt': { background: '#F4C430', ink: '#062B61', accent: '#FFFFFF', highlight: '#0757FF', label: 'YELLOW BELT' },
  'green-belt': { background: '#178447', ink: '#FFFFFF', accent: '#F4C430', highlight: '#FFFFFF', label: 'GREEN BELT' },
  'black-belt': { background: '#111827', ink: '#FFFFFF', accent: '#F4C430', highlight: '#0757FF', label: 'BLACK BELT' },
};
if (!palettes[thumb.courseKey]) throw new Error(`Curso de capa nao configurado: ${thumb.courseKey}`);
const palette = palettes[thumb.courseKey];

const series = escapeHtml(String(thumb.seriesLabel ?? palette.label).trim());
const episode = escapeHtml(String(thumb.episode ?? '').trim());
const ganchoInformado = (Array.isArray(thumb.hookLines) ? thumb.hookLines : [])
  .map((l) => String(l ?? '').trim())
  .filter(Boolean);
const hookLines = ganchoInformado.map(escapeHtml);
const logo = fileDataUrl(path.resolve(config.logoPath));
const portrait = fileDataUrl(portraitPath);

// GEOMETRIA: 1280x720. A miniatura do YouTube mostra a DURAÇÃO no canto
// inferior direito por cima da imagem — por isso o texto e a marca ficam à
// esquerda, e o retrato ocupa a direita, onde uma sobreposição de 60x24px no
// canto não derruba nada importante.
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:1280px;height:720px;overflow:hidden}
body{font-family:Arial,Helvetica,sans-serif;background:${palette.background};color:${palette.ink}}
.thumb{position:relative;width:1280px;height:720px;overflow:hidden;background:${palette.background}}
.portrait-shell{position:absolute;z-index:1;right:0;top:0;width:620px;height:720px;overflow:hidden;background:#EAF1FA}
.portrait-shell img{width:100%;height:100%;object-fit:cover;object-position:center 30%;transform:scale(1.08)}
.fade{position:absolute;z-index:2;left:600px;top:0;width:180px;height:720px;background:linear-gradient(90deg, ${palette.background} 0%, ${palette.background}00 100%)}
.side-bar{position:absolute;z-index:3;left:0;top:0;width:12px;height:720px;background:${palette.accent}}
.content{position:relative;z-index:3;padding:44px 40px 40px 64px;width:700px;height:720px;display:flex;flex-direction:column;justify-content:space-between}
.brand{display:flex;align-items:center;gap:18px}
.brand-badge{width:72px;height:72px;border-radius:15px;display:grid;place-items:center;background:${palette.ink};flex:0 0 auto}
.brand-badge img{width:58px;height:58px;object-fit:contain}
.brand-name{font-size:25px;line-height:1.1;font-weight:900;letter-spacing:.5px}
.hook{width:660px;font-weight:950;font-style:italic;text-transform:uppercase;letter-spacing:-2.5px;line-height:.95}
.hook .line{display:block;font-size:82px;overflow-wrap:anywhere;color:${palette.ink}}
.hook .line:first-child{color:${palette.accent}}
.badge-row{display:flex;align-items:center;gap:14px}
.series{display:inline-block;white-space:nowrap;padding:13px 22px 12px;border-radius:10px;color:#fff;background:${palette.ink};font-size:23px;line-height:1;font-weight:900;letter-spacing:.5px}
.rule{flex:0 0 auto;width:90px;height:9px;border-radius:8px;background:${palette.highlight}}
</style></head><body><main class="thumb">
<div class="portrait-shell"><img src="${portrait}"></div>
<div class="fade"></div>
<div class="side-bar"></div>
<div class="content">
  <div class="brand"><div class="brand-badge"><img src="${logo}"></div><div class="brand-name">LBW · EDUCAÇÃO<br>PELO TRABALHO</div></div>
  <div class="hook">${hookLines.map((line) => `<span class="line">${line}</span>`).join('')}</div>
  ${(series || episode) ? `<div class="badge-row"><span class="series">${[series, episode].filter(Boolean).join(' · ')}</span><span class="rule"></span></div>` : '<div></div>'}
</div>
</main></body></html>`;

/**
 * Mesma técnica da capa do Reel: mede de verdade no navegador (scrollWidth E
 * altura real), encolhe até caber, e só desiste se não couber nem no piso —
 * nunca corta por contar palavra.
 */
async function ajustarGancho(pagina) {
  return pagina.evaluate(() => {
    const gancho = document.querySelector('.hook');
    if (!gancho) return null;
    const linhas = [...gancho.querySelectorAll('.line')];
    if (!linhas.length) return null;

    // O PISO É 60px, e ele é uma medida, não um gosto.
    //
    // Aqui a regra é o INVERSO da capa do Reel. Lá, encolher até caber está
    // certo: a capa do Reel é vista grande, ocupando a tela do Instagram. A
    // miniatura do YouTube é vista a 168px de largura na lista de sugeridos —
    // foi medido: um gancho de 13 palavras encolhido para caber virou um borrão
    // ilegível nesse tamanho, enquanto o rosto continuou reconhecível.
    //
    // Então abaixo de 60px o problema não é a fonte ser grande, é o texto ser
    // comprido. Quem corrige é quem escreveu o gancho (Mary Moon), reescrevendo
    // mais curto — não o desenho, fingindo que caber é a mesma coisa que ler.
    // DUAS travas, porque a fonte sozinha não segura.
    //
    // Um gancho de 13 palavras CABE a 70px — em cinco linhas. Cabe e não se lê:
    // cinco linhas viram cinco riscos a 168px. Então o limite é o par
    // (corpo mínimo, linhas máximas), e não só o corpo.
    const PISO = 60;
    const MAX_LINHAS = 3;
    // line-height é .95; três linhas ocupam 3 x .95 x corpo, com uma folga de
    // 6px para o arredondamento do navegador.
    const alturaDe = (corpo) => Math.ceil(MAX_LINHAS * 0.95 * corpo) + 6;

    let tamanho = 92;
    const cabe = () => gancho.scrollWidth <= gancho.clientWidth + 1
      && gancho.scrollHeight <= alturaDe(tamanho);
    linhas.forEach((l) => { l.style.fontSize = `${tamanho}px`; });
    while (!cabe() && tamanho > PISO) {
      tamanho -= 2;
      linhas.forEach((l) => { l.style.fontSize = `${tamanho}px`; });
    }
    if (!cabe()) {
      const texto = linhas.map((l) => l.textContent).join(' ').trim();
      const palavras = texto.split(/\s+/).filter(Boolean).length;
      const usadas = Math.round(gancho.scrollHeight / (0.95 * tamanho));
      throw new Error(
        `O gancho tem ${palavras} palavras e ocupa ${usadas} linhas a ${PISO}px — o limite é `
        + `${MAX_LINHAS} linhas, e ${PISO}px é o menor corpo que ainda se lê quando o YouTube `
        + 'mostra a miniatura a 168px de largura. Encurte para no máximo 6 palavras: '
        + 'encolher mais deixaria a capa completa e ilegível.',
      );
    }
    return {
      fonte: tamanho,
      linhas: Math.round(gancho.scrollHeight / (0.95 * tamanho)),
      texto: linhas.map((l) => l.textContent).join(' '),
    };
  });
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const browser = await chromium.launch({ headless: true });
let hookLayout = null;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  if (hookLines.length) hookLayout = await ajustarGancho(page);
  await page.screenshot({ path: outputPath, type: 'jpeg', quality: 92 });
} finally {
  await browser.close();
}

console.log(JSON.stringify({ outputPath, courseKey: thumb.courseKey, episode, hookLayout, width: 1280, height: 720 }, null, 2));
