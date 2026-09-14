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
const cover = config.cover;

if (!cover || cover.mode !== 'dedicated') throw new Error('A configuracao cover.mode deve ser "dedicated".');
if (!Array.isArray(cover.hookLines) || cover.hookLines.length < 1 || cover.hookLines.length > 3) {
  throw new Error('cover.hookLines deve ter entre 1 e 3 linhas.');
}
const hookWordCount = cover.hookLines.join(' ').trim().split(/\s+/).filter(Boolean).length;
if (hookWordCount < 3 || hookWordCount > 6) throw new Error('O gancho da capa deve ter entre 3 e 6 palavras.');
if (!/^\d{2}$/.test(String(cover.episode || ''))) throw new Error('cover.episode deve ter dois digitos, como 01.');
if (!fs.existsSync(config.logoPath)) throw new Error(`Logo nao encontrada: ${config.logoPath}`);
if (!fs.existsSync(portraitPath)) throw new Error(`Retrato nao encontrado: ${portraitPath}`);

const palettes = {
  'white-belt': { background: '#FFFFFF', ink: '#062B61', accent: '#0757FF', highlight: '#F4C430', label: 'WHITE BELT' },
  'yellow-belt': { background: '#F4C430', ink: '#062B61', accent: '#FFFFFF', highlight: '#0757FF', label: 'YELLOW BELT' },
  'green-belt': { background: '#178447', ink: '#FFFFFF', accent: '#F4C430', highlight: '#FFFFFF', label: 'GREEN BELT' },
  'black-belt': { background: '#111827', ink: '#FFFFFF', accent: '#F4C430', highlight: '#0757FF', label: 'BLACK BELT' },
};
if (!palettes[cover.courseKey]) throw new Error(`Curso de capa nao configurado: ${cover.courseKey}`);
const palette = palettes[cover.courseKey];
const series = escapeHtml(cover.seriesLabel || palette.label);
// O assunto do rodape e a sigla de fundo vinham escritos no codigo — "AULA PRATICA
// / MELHORIA CONTINUA" e "WB" —, o que servia para o video que estava sendo feito
// naquele dia e para nenhum outro. Agora vem da configuracao, com o mesmo texto
// de antes como padrao para nada mudar sem pedido.
const topico = escapeHtml(cover.topicLabel || 'AULA PRÁTICA');
const topicoForte = escapeHtml(cover.topicStrong || 'MELHORIA CONTÍNUA');
const sigla = escapeHtml(
  cover.ghost
  || (cover.seriesLabel || palette.label).split(/\s+/).map((p) => p[0] || '').join('').slice(0, 3).toUpperCase(),
);
const episode = String(cover.episode || '').padStart(2, '0');
const hookLines = cover.hookLines.map(escapeHtml);
const logo = fileDataUrl(path.resolve(config.logoPath));
const portrait = fileDataUrl(portraitPath);

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;overflow:hidden}body{font-family:Arial,Helvetica,sans-serif;background:${palette.background};color:${palette.ink}}
.cover{position:relative;width:1080px;height:1920px;overflow:hidden;background:${palette.background}}
.top-field{position:absolute;inset:0 0 auto 0;height:125px;background:${palette.ink}}.top-line{position:absolute;top:125px;left:0;width:100%;height:12px;background:${palette.highlight}}
.ghost{position:absolute;top:-8px;right:30px;font-size:150px;line-height:.9;font-weight:900;color:rgba(255,255,255,.08);letter-spacing:-12px}
.safe{position:absolute;left:55px;top:250px;width:970px;height:1550px}.brand{height:104px;display:flex;align-items:center;gap:24px}
.brand-badge{width:94px;height:94px;border-radius:19px;display:grid;place-items:center;background:${palette.ink};flex:0 0 auto}.brand-badge img{width:76px;height:76px;object-fit:contain}
.brand-name{font-size:32px;line-height:1;font-weight:900;letter-spacing:1px;white-space:nowrap}.series-row{margin-top:20px;display:flex;align-items:center;gap:15px}
.series{padding:13px 22px 12px;border-radius:10px;color:#fff;background:${palette.accent};font-size:30px;line-height:1;font-weight:900;letter-spacing:1.5px}
.hook{position:relative;z-index:3;width:960px;margin-top:27px;font-weight:950;font-style:italic;text-transform:uppercase;letter-spacing:-4.5px;line-height:.91}.hook .line{display:block;font-size:104px}.hook .line:first-child{color:${palette.accent}}.hook .line:not(:first-child){color:${palette.ink}}
.rule{position:absolute;left:0;top:515px;width:610px;height:14px;border-radius:10px;background:${palette.highlight};z-index:3}
.portrait-shell{position:absolute;z-index:2;right:-90px;bottom:0;width:900px;height:950px;border-radius:52% 48% 10% 10% / 54% 54% 10% 10%;overflow:hidden;background:#EAF1FA;border:13px solid ${palette.ink};box-shadow:0 27px 0 ${palette.highlight}}
.portrait-shell img{width:100%;height:100%;object-fit:cover;object-position:center 34%;transform:scale(1.13)}
.topic{position:absolute;z-index:4;left:0;bottom:105px;width:400px;padding:23px 25px;border-radius:17px;color:#fff;background:${palette.ink};font-size:29px;line-height:1.07;font-weight:900;text-transform:uppercase}.topic strong{display:block;margin-top:6px;color:${palette.highlight};font-size:39px}
.bottom-accent{position:absolute;left:55px;right:55px;bottom:44px;height:16px;border-radius:10px;background:${palette.ink}}.bottom-accent:after{content:'';position:absolute;right:0;top:0;width:260px;height:16px;border-radius:10px;background:${palette.highlight}}
</style></head><body><main class="cover"><div class="top-field"><div class="ghost">${sigla}</div></div><div class="top-line"></div><section class="safe">
<div class="brand"><div class="brand-badge"><img src="${logo}"></div><div class="brand-name">LBW · EDUCAÇÃO PELO TRABALHO</div></div>
<div class="series-row"><span class="series">${series} ${escapeHtml(episode)}</span></div>
<div class="hook">${hookLines.map(line => `<span class="line">${line}</span>`).join('')}</div><div class="rule"></div>
<div class="portrait-shell"><img src="${portrait}"></div><div class="topic">${topico}<strong>${topicoForte}</strong></div></section>
<div class="bottom-accent"></div></main></body></html>`;

/**
 * Faz o gancho caber, medindo de verdade no navegador.
 *
 * A fonte era fixa em 104px e cada linha do gancho ia para um <span> de bloco. Uma
 * linha comprida — "SUA MENTALIDADE É DE" — nao cabia nos 960px e QUEBRAVA SOZINHA
 * em duas: o gancho de duas linhas virava quatro, descia sobre a regua amarela e
 * sobre o retrato, e a capa saia com uma risca cortando a palavra ao meio.
 *
 * CSS sozinho nao resolve, porque depende da largura real do texto na fonte
 * instalada. E a mesma tecnica do rodape do carrossel: medir no Chromium e ajustar.
 *
 * A regua desce junto quando o gancho ocupa mais: ela marca o fim do gancho, entao
 * nao pode ficar num ponto fixo. Nunca SOBE do lugar desenhado, para o gancho curto
 * continuar saindo exatamente como o padrao homologado.
 */
async function ajustarGancho(pagina) {
  await pagina.evaluate(() => {
    const gancho = document.querySelector('.hook');
    const regua = document.querySelector('.rule');
    if (!gancho) return;
    const linhas = [...gancho.querySelectorAll('.line')];
    if (!linhas.length) return;

    /** Uma linha "cabe" quando ocupa a altura de uma linha so. */
    const cabe = () => linhas.every((l) => {
      const fonte = parseFloat(getComputedStyle(l).fontSize);
      return l.getBoundingClientRect().height < fonte * 1.35;
    });

    let tamanho = 104;
    while (!cabe() && tamanho > 46) {
      tamanho -= 4;
      linhas.forEach((l) => { l.style.fontSize = `${tamanho}px`; });
    }

    if (regua) {
      const fimDoGancho = gancho.offsetTop + gancho.offsetHeight;
      const desenhado = 515;
      regua.style.top = `${Math.max(desenhado, fimDoGancho + 42)}px`;
    }
  });
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await ajustarGancho(page);
  await page.screenshot({ path: outputPath, type: 'jpeg', quality: 94 });
} finally {
  await browser.close();
}
console.log(JSON.stringify({ outputPath, courseKey: cover.courseKey, episode, profileSafeZone: { x: 55, y: 250, width: 970, height: 1410 }, centralHookZone: { x: 55, y: 420, width: 970, height: 1080 } }, null, 2));
