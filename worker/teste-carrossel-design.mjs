/**
 * Confere as decisoes de design do carrossel, sem renderizar nada.
 *
 * Importa o proprio renderizador? Nao da: ele executa ao ser carregado. Entao o
 * que este teste faz e ler o arquivo e rodar as funcoes puras dele num sandbox,
 * que e a forma de testar o codigo DE VERDADE em vez de uma copia que eu escrevi
 * aqui e que pode divergir amanha.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fonte = fs.readFileSync(
  path.join(raiz, 'squads/lbw-carousel-production/automation/render-carousel.mjs'),
  'utf8',
);

/**
 * Recorta uma funcao do arquivo pelo nome e a traz para cá, tal como está lá.
 *
 * Conta chaves IGNORANDO texto entre aspas e comentarios. A primeira versao disto
 * contava as chaves cruas e parava no meio de `css.split('}')` — a chave dentro
 * das aspas fechava a funcao cedo demais.
 */
function extrair(nome) {
  const inicio = fonte.indexOf(`function ${nome}(`);
  if (inicio < 0) throw new Error(`nao achei a funcao ${nome}`);
  let profundidade = 0;
  let aspas = null;
  let i = fonte.indexOf('{', inicio);
  for (; i < fonte.length; i++) {
    const c = fonte[i];
    if (aspas) {
      if (c === '\\') { i++; continue; }
      if (c === aspas) aspas = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { aspas = c; continue; }
    if (c === '/' && fonte[i + 1] === '/') { i = fonte.indexOf('\n', i); continue; }
    if (c === '{') profundidade++;
    else if (c === '}') { profundidade--; if (profundidade === 0) break; }
  }
  return `${fonte.slice(inicio, i + 1)}\n;globalThis.${nome} = ${nome};`;
}

const caixa = vm.createContext({ Math, Number, String, globalThis: null });
caixa.globalThis = caixa;
vm.runInContext(extrair('semente') + extrair('escalarFontes'), caixa);
const { semente, escalarFontes } = caixa;

const PESSOAS_PADRAO = (fonte.match(/const PESSOAS_PADRAO = \[([\s\S]*?)\];/) || [])[1]
  .split(',').map((l) => l.trim().replace(/^'|'$/g, '')).filter(Boolean);

let falhas = 0;
const conferir = (nome, ok, detalhe = '') => {
  if (!ok) falhas++;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome}${ok || !detalhe ? '' : `\n        ${detalhe}`}`);
};

/* ── A semente e estavel e espalha ──────────────────────────── */
console.log(`biblioteca de pessoas no rodizio: ${PESSOAS_PADRAO.length}\n`);

conferir('a mesma entrada da o mesmo numero', semente('abc') === semente('abc'));
conferir('entradas diferentes dao numeros diferentes', semente('abc') !== semente('abd'));

const partida = (slug) => semente(slug) % PESSOAS_PADRAO.length;
const slugs = [
  'israel-lean-six-sigma-white-belt-parte-1-00426',
  'israel-lean-six-sigma-white-belt-parte-1-00312',
  'israel-lean-six-sigma-white-belt-parte-2-00101',
  'israel-gestao-da-qualidade-00007',
  'israel-auditoria-interna-00055',
  'israel-ishikawa-00088',
];
const partidas = slugs.map(partida);
console.log(`pontos de partida: ${partidas.join(', ')}`);
conferir('criativos diferentes nao comecam todos no mesmo lugar',
  new Set(partidas).size > 1,
  `todos comecaram em ${partidas[0]}`);
conferir('o mesmo criativo comeca sempre no mesmo lugar',
  partida(slugs[0]) === partida(slugs[0]));

// O que importa de verdade: a CAPA de dois criativos nao pode ser sempre a mesma pessoa.
const capas = slugs.map((s) => PESSOAS_PADRAO[partida(s) % PESSOAS_PADRAO.length]);
console.log(`capas: ${capas.map((c) => c.slice(0, 14)).join(' | ')}`);
conferir('a capa muda entre criativos', new Set(capas).size > 1);

/* ── Espalhamento em muitos criativos ───────────────────────── */
const muitos = Array.from({ length: 300 }, (_, i) => partida(`israel-aula-${i}-00${i}`));
const contagem = new Map();
for (const p of muitos) contagem.set(p, (contagem.get(p) || 0) + 1);
const usados = contagem.size;
const maior = Math.max(...contagem.values());
console.log(`\nem 300 criativos: ${usados} de ${PESSOAS_PADRAO.length} posicoes usadas, a mais comum aparece ${maior}x`);
conferir('usa a biblioteca toda', usados === PESSOAS_PADRAO.length);
conferir('nenhuma posicao domina (menos de 25%)', maior < 75, `a mais comum apareceu ${maior} de 300`);

/* ── A escala mexe no conteudo e nao na moldura ─────────────── */
const css = `.title{font-size:78px;font-weight:900}
.body{font-size:35px}
.brand span{color:#fff;font-size:29px}
.strip-item{font-size:16px}
.strip-sign{font-size:16px}`;

const g = escalarFontes(css, 1.25);
conferir('escala 1 nao muda nada', escalarFontes(css, 1) === css);
conferir('o titulo cresce', g.includes('font-size:97.5px'), g.split('\n')[0]);
conferir('o texto cresce', g.includes('font-size:43.8px'));
conferir('a marca do cabecalho NAO cresce', g.includes('.brand span{color:#fff;font-size:29px}'));
conferir('a faixa do rodape NAO cresce', (g.match(/font-size:16px/g) || []).length === 2);

const p = escalarFontes(css, 0.8);
conferir('encolher tambem funciona', p.includes('font-size:62.4px'));

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} TESTE(S) FALHARAM`}`);
process.exit(falhas === 0 ? 0 : 1);
