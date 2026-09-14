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
// Local: grava em ENTREGAS/ na raiz do projeto (comportamento de sempre).
// Worker: recebe outputRoot e grava numa pasta temporária, de onde sobe pro Storage.
const entregas = config.outputRoot
  ? path.resolve(config.outputRoot)
  : path.resolve(squadRoot, '..', '..', 'ENTREGAS');
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

/* ── A marca de quem assina a peça ─────────────────────────── */

// O nome e a logo do consultor, e as cores dele. Sem isto a peça saía sempre com
// "EDUCAÇÃO PELO TRABALHO" escrito fixo no código, mesmo para outro consultor.
const MARCA = config.marca || {};

/** Baixa a logo quando ela vem como endereço na web, e não como arquivo local. */
async function logoDaMarca() {
  const remota = String(MARCA.logoUrl || '').trim();
  if (/^https?:\/\//i.test(remota)) {
    try {
      const resposta = await fetch(remota);
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const tipo = resposta.headers.get('content-type') || 'image/png';
      const bytes = Buffer.from(await resposta.arrayBuffer());
      return `data:${tipo.split(';')[0]};base64,${bytes.toString('base64')}`;
    } catch (e) {
      // Logo que não baixa não derruba a peça: cai na logo padrão e avisa.
      console.warn(`aviso: não consegui baixar a logo ${remota} (${e.message}); usando a padrão`);
    }
  }
  if (remota.startsWith('data:')) return remota;
  return dataUrl(resolveAsset(config.logoPath || remota) || path.resolve(squadRoot, '..', '..', 'assets/marca/logo-lbw-branca.png'));
}

const logo = await logoDaMarca();
if (!logo) throw new Error('Logo oficial não encontrada.');

const NOME_DA_MARCA = String(MARCA.nome || 'EDUCAÇÃO PELO TRABALHO').toUpperCase();

/* ── A paleta ──────────────────────────────────────────────── */

/** Mistura duas cores hexadecimais. `t` é quanto da segunda entra. */
function misturar(a, b, t) {
  const ler = (h) => {
    const x = h.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  };
  const [r1, g1, b1] = ler(a);
  const [r2, g2, b2] = ler(b);
  const c = (x, y) => Math.round(x * (1 - t) + y * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/**
 * As cores da peça.
 *
 * SEM cores na configuração, devolve os hexadecimais ORIGINAIS, um por um — o
 * visual que já foi aprovado não muda nem um tom por causa de arredondamento de
 * mistura. As derivadas só são calculadas quando o consultor traz a própria
 * paleta, e aí um desvio pequeno é preferível a pedir nove cores a ele.
 */
function paleta(cores) {
  const ORIGINAL = {
    navy: '#0A2A5E', blue: '#1B4FD8', light: '#EEF3FA',
    blueClaro: '#5B93FF', textoClaro: '#C9D8EE', sub: '#9FBCE6',
    borda: '#DCE6F2', mutedForte: '#3A5B80', mutedSuave: '#6D89AB',
    negTexto: '#4A688C',
  };
  if (!cores || !cores.navy || !cores.blue || !cores.light) return ORIGINAL;

  const navy = cores.navy;
  const blue = cores.blue;
  const light = cores.light;
  const muted = cores.muted || misturar(light, navy, 0.62);
  return {
    navy, blue, light,
    blueClaro: misturar(blue, '#ffffff', 0.35),
    textoClaro: misturar(light, navy, 0.18),
    sub: misturar(light, blue, 0.35),
    borda: misturar(light, navy, 0.08),
    mutedForte: muted,
    mutedSuave: misturar(muted, '#ffffff', 0.28),
    negTexto: misturar(muted, '#ffffff', 0.12),
  };
}

const C = paleta(MARCA.cores);

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

// Personagens de expressao neutra ou positiva, para quem nao escolheu ninguem.
// Sem isso o slide fica com a metade de baixo vazia: o texto ocupa o topo e o resto
// do 1080x1350 fica em branco. Rodizio por indice, e nao sorteio, para o mesmo
// config render sempre igual.
const PESSOAS_PADRAO = [
  '04-explicando-homem-40',
  '12-lideranca-mulher-30',
  '08-foco-mulher-40',
  '11-explicando-homem-30',
  '02-decisao-mulher-30',
  '06-insight-homem-20',
  '07-apontando-mulher-40',
  '03-duvida-homem-40',
];

/**
 * Um numero estavel a partir de um texto.
 *
 * Estavel e a palavra: o MESMO criativo refeito tem de dar a MESMA peca. Por isso
 * nao e sorteio — e uma conta sobre o slug, que nao muda.
 */
function semente(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Embaralha os bits altos para dentro dos baixos. Sem isto o resto da divisao
  // usa so os tres bits finais, que mal mudam entre slugs parecidos: 300 criativos
  // caiam em 4 das 8 pessoas, uma delas 168 vezes.
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

// De onde a rotacao de pessoas comeca NESTE carrossel.
//
// Antes comecava sempre do zero, e o resultado era que TODA capa saia com o mesmo
// homem, toda pagina 2 com a mesma mulher, para sempre — quem publica todo dia
// repete as mesmas oito caras a semana inteira. Agora o ponto de partida vem do
// slug, entao criativos diferentes recebem pessoas diferentes, e o mesmo criativo
// refeito continua identico.
const PONTO_DE_PARTIDA = semente(slug) % PESSOAS_PADRAO.length;

/** A pessoa do slide, ou uma do rodizio quando o slide nao pediu nenhuma. */
function pessoaDoSlide(slide, indice) {
  if (slide.pessoa === false || slide.pessoa === 'nenhuma') return '';
  if (slide.pessoa) return pessoaUrl(slide.pessoa);
  if (!pessoasDisponiveis.length) return '';
  return pessoaUrl(PESSOAS_PADRAO[(PONTO_DE_PARTIDA + indice) % PESSOAS_PADRAO.length]);
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
function bodyCapa(slide, i) {
  const img = pessoaDoSlide(slide, i);
  const sub = slide.sub ? `<div class="sub"><span class="sub-mark">?</span><span>${rich(slide.sub)}</span></div>` : '';
  return `<section class="main capa${img ? '' : ' sozinho'}">
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

function bodyDado(slide, i) {
  const img = pessoaDoSlide(slide, i);
  const fonte = slide.fonte ? `<div class="fonte">Fonte: ${escapeHtml(slide.fonte)}</div>` : '';
  return `<section class="main light dado${img ? '' : ' sozinho'}">
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

function bodyCta(slide, i) {
  const img = pessoaDoSlide(slide, i);
  // O "Comente 'PALAVRA'" saiu. Pedir comentario com uma palavra-chave e isca de
  // engajamento: quem le sabe que e isca, e a pagina de fecho fica valendo menos
  // do que a ideia que ela deveria fechar. O fecho agora e o proprio texto.
  return `<section class="main capa cta${img ? '' : ' sozinho'}">
    <div class="capa-text">
      <h1 class="title">${rich(slide.title)}</h1>
      <div class="rule"></div>
      <p class="body">${rich(slide.body)}</p>
    </div>
    <div class="capa-person">${img ? `<img src="${img}" alt="">` : ''}</div>
  </section>`;
}

function bodyPadrao(slide, i) {
  const img = pessoaDoSlide(slide, i);
  return `<section class="main light dado${img ? '' : ' sozinho'}">
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
.page{width:1080px;height:${H}px;display:flex;flex-direction:column;background:${C.light};overflow:hidden}
.page.dark{background:${C.navy}}

.brand{flex:0 0 96px;display:flex;align-items:center;gap:22px;background:${C.navy};padding:0 54px;border-bottom:4px solid ${C.blue}}
.brand img{width:62px;height:62px;object-fit:contain}
.brand span{color:#fff;font-size:29px;font-weight:800;letter-spacing:.6px}

.main{flex:1 1 auto;display:flex;min-height:0;padding:48px 54px 30px}
.main.light{flex-direction:column;background:${C.light}}
.hl{color:${C.blue}}
.page.dark .hl{color:${C.blueClaro}}

.title{font-size:78px;line-height:1.02;letter-spacing:-2px;margin:0;text-transform:uppercase;font-style:italic;font-weight:900;color:#fff}
.title.dark{color:${C.navy}}
.title.small{font-size:56px}
.body{font-size:35px;line-height:1.22;font-weight:700;color:${C.textoClaro};margin:22px 0 0}
.body.dim{color:${C.mutedForte}}
.rule{width:100%;height:4px;background:${C.blue};margin:26px 0 0;opacity:.8}

/* capa e cta */
.capa{align-items:stretch;gap:0;padding:0 54px 0;position:relative}
.capa-text{flex:1 1 50%;display:flex;flex-direction:column;justify-content:flex-start;min-width:0;padding:58px 0 30px;position:relative;z-index:2}
.capa .title{font-size:86px}
.capa-person{flex:0 0 50%;display:flex;align-items:flex-end;justify-content:flex-end;min-width:0;margin-left:-36px;overflow:visible}
.capa-person img{width:165%;height:auto;max-width:none;max-height:100%;object-fit:contain;object-position:bottom right;transform:translateX(7%)}
.sub{display:flex;align-items:center;gap:16px;margin-top:34px;color:${C.sub};font-size:28px;font-weight:700}
.sub-mark{flex:0 0 46px;height:46px;border-radius:50%;background:${C.blue};color:#fff;display:flex;align-items:center;justify-content:center;font-size:27px;font-weight:900}

/* camadas */
.cards{flex:1 1 auto;display:flex;flex-direction:column;justify-content:center;margin-top:26px;min-height:0}
.card{display:flex;align-items:center;gap:26px;background:#fff;border:2px solid ${C.borda};border-radius:22px;padding:22px 28px;box-shadow:0 10px 26px rgba(10,42,94,.10)}
.card-left{flex:0 0 33%}
.chip{display:inline-block;background:${C.blue};color:#fff;font-size:20px;font-weight:900;letter-spacing:1px;padding:7px 15px;border-radius:8px}
.card-label{font-size:42px;font-weight:900;color:${C.navy};line-height:1.04;margin-top:10px;text-transform:uppercase}
.card-items{flex:1 1 auto;display:flex;gap:14px}
.card-item{flex:1;background:${C.light};border-radius:14px;padding:16px 12px;text-align:center;font-size:24px;font-weight:700;color:${C.mutedForte};display:flex;align-items:center;justify-content:center}
.link{width:5px;height:26px;background:${C.blue};margin:0 auto;opacity:.5}

/* dado e padrao */
.main.light.dado{flex-direction:row;align-items:stretch;gap:20px;padding-bottom:0}
.dado-text{flex:1 1 56%;display:flex;flex-direction:column;justify-content:flex-start;min-width:0;padding-top:14px;position:relative;z-index:2}
.dado-person{flex:0 0 44%;display:flex;align-items:flex-end;justify-content:flex-end;min-width:0;margin-left:-24px;overflow:visible}
.dado-person img{width:160%;height:auto;max-width:none;max-height:100%;object-fit:contain;object-position:bottom right;transform:translateX(8%)}
.numero{font-size:168px;font-weight:900;color:${C.blue};line-height:.9;letter-spacing:-6px;font-style:italic}
.fonte{margin-top:22px;font-size:23px;font-weight:700;color:${C.mutedSuave}}

/* comparacao */
.compare{flex:1 1 auto;display:flex;align-items:center;gap:22px;margin-top:28px;min-height:0}
.cmp{flex:1;height:72%;border-radius:26px;display:flex;align-items:center;justify-content:center;text-align:center;padding:26px;font-size:44px;font-weight:900;text-transform:uppercase;font-style:italic}
.cmp-neg{background:${C.borda};color:${C.negTexto}}
.cmp-pos{background:${C.blue};color:#fff}
.cmp-arrow{font-size:64px;font-weight:900;color:${C.blue}}

/* ── Sem pessoa: o texto toma a pagina ──────────────────────────
   Uma pagina sem pessoa deixava 60% de branco embaixo, porque a coluna do texto
   ocupa so metade e o resto era da figura. Aqui o texto fica com a largura toda,
   centrado na vertical, e cresce — a pagina passa a ser DE TEXTO, em vez de uma
   pagina de figura a que faltou a figura. */
.main.sozinho .capa-text,
.main.sozinho .dado-text{flex:1 1 100%;justify-content:center;padding-right:0}
.main.sozinho .capa-person,
.main.sozinho .dado-person{display:none}
.main.capa.sozinho{padding:0 70px}
.main.sozinho .title{font-size:104px}
.main.sozinho .title.small{font-size:74px}
.main.sozinho .capa .title,
.main.capa.sozinho .title{font-size:112px}
.main.sozinho .body{font-size:46px;line-height:1.24;margin-top:30px}
.main.sozinho .numero{font-size:210px}
.main.sozinho .sub{font-size:34px;margin-top:44px}
.main.sozinho .sub-mark{flex:0 0 56px;height:56px;font-size:33px}
.main.sozinho .fonte{font-size:28px}

/* No 9:16 a pagina ja e mais alta: sem pessoa, cresce mais ainda. */
.tall .main.sozinho .title{font-size:124px}
.tall .main.sozinho .title.small{font-size:88px}
.tall .main.capa.sozinho .title{font-size:132px}
.tall .main.sozinho .body{font-size:56px}
.tall .main.sozinho .numero{font-size:280px}

/* faixa de processo */
.strip{flex:0 0 112px;display:flex;align-items:center;justify-content:space-between;gap:18px;background:${C.navy};padding:0 40px;border-top:4px solid ${C.blue}}
/* overflow:hidden e o que impede a trilha de invadir a assinatura quando a soma
   das duas passa de 1000px. Sem ele os textos se sobrepoem e ficam ilegiveis. */
.strip-items{display:flex;align-items:center;gap:15px;flex-wrap:nowrap;flex:0 1 auto;min-width:0;overflow:hidden}
.strip-item{display:flex;align-items:center;gap:7px;color:${C.textoClaro};font-size:16px;font-weight:800;letter-spacing:.4px;white-space:nowrap}
.dot{width:11px;height:11px;border-radius:3px;background:${C.blue};flex:0 0 11px}
/* A assinatura tem prioridade sobre a trilha, mas nao pode comer a faixa inteira:
   ate 46% da largura, e o que passar disso vira reticencias. */
.strip-sign{text-align:right;color:${C.sub};font-size:16px;font-weight:700;line-height:1.35;white-space:nowrap;flex:0 0 auto;max-width:46%;overflow:hidden;text-overflow:ellipsis}
.strip-sign div{overflow:hidden;text-overflow:ellipsis}
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

/**
 * Recalcula os font-size do CSS pela escala pedida.
 *
 * DEIXA O CABECALHO E O RODAPE DE FORA: a marca e a faixa de processo sao a
 * moldura da peca, iguais em todas as paginas. Escalar junto faria o carrossel
 * parecer ter sido montado em tamanhos diferentes, pagina a pagina.
 */
function escalarFontes(css, escala) {
  if (escala === 1) return css;
  return css.split('}').map((bloco) => {
    const seletor = bloco.split('{')[0] || '';
    if (/\.(strip|brand|dot)\b/.test(seletor)) return bloco;
    return bloco.replace(
      /font-size:(\d+(?:\.\d+)?)px/g,
      (_, n) => `font-size:${(Number(n) * escala).toFixed(1)}px`,
    );
  }).join('}');
}

function slideHtml(slide, H = 1350, indice = 0) {
  const type = String(slide.type || 'padrao').toLowerCase();
  const build = BUILDERS[type] || bodyPadrao;
  const isDark = type === 'capa' || type === 'cta';
  const tall = H >= 1600 ? ' tall' : '';
  // A escala do texto desta pagina.
  //
  // Limitada porque abaixo de 0,8 nao se le no celular e acima de 1,25 estoura a
  // pagina. Nao da para fazer isso com font-size no html: o CSS inteiro esta em
  // px, e px nao herda escala. Entao as medidas sao recalculadas de verdade.
  const escala = Math.min(1.25, Math.max(0.8, Number(slide.escala) || 1));
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${escalarFontes(cssFor(H), escala)}</style></head><body>
<main class="page${isDark ? ' dark' : ''}${tall}">
  <header class="brand"><img src="${logo}"><span>${escapeHtml(NOME_DA_MARCA)}</span></header>
  ${build(slide, indice)}
  ${stripMarkup()}
</main></body></html>`;
}

/**
 * Tira da trilha do processo os itens que nao cabem ao lado da assinatura.
 *
 * O CSS sozinho nao resolve: ou os dois textos se sobrepoem, ou o ultimo item sai
 * cortado no meio da palavra ("ENTREGAR VAI"). Aqui medimos de verdade no navegador
 * e removemos o item inteiro que ultrapassa a borda. Melhor mostrar quatro etapas
 * completas do que cinco pela metade.
 */
async function ajustarRodape(pagina) {
  await pagina.evaluate(() => {
    const faixa = document.querySelector('.strip-items');
    if (!faixa) return;
    const limite = faixa.getBoundingClientRect().right;
    for (const item of [...faixa.querySelectorAll('.strip-item')].reverse()) {
      if (item.getBoundingClientRect().right > limite + 0.5) item.remove();
    }
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
const pngPaths = [];

for (let index = 0; index < config.slides.length; index++) {
  const slide = config.slides[index];
  const wordCount = `${plain(slide.title)} ${plain(slide.body)}`.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > 32) throw new Error(`Página ${index + 1} excede 32 palavras.`);
  await page.setContent(slideHtml(slide, 1350, index), { waitUntil: 'load' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await ajustarRodape(page);
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
    await vPage.setContent(slideHtml(config.slides[i], VH, i), { waitUntil: 'load' });
    await vPage.evaluate(() => window.scrollTo(0, 0));
    await ajustarRodape(vPage);
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

// A legenda NAO sai mais como arquivo .md.
//
// Ela virava um legenda.md dentro de cada pasta e ninguem usava: o consultor nao
// tem o que fazer com um markdown, e na tela ele so atrapalhava a lista de
// arquivos da peca. O texto para publicar agora e escrito na plataforma, editavel,
// e vive no criativo — que e onde ele pode ser revisado e copiado.
const contentPath = null;
await browser.close();

console.log(JSON.stringify({ campanha: base, feedDir, slides: pngPaths.length, pngPaths, videoPath, pdfPath, contentPath }, null, 2));
