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

/* ── No maximo duas pessoas automaticas: capa e fecho ───────── */
// A funcao roda como esta no renderizador; so o que vem de fora dela e simulado.
const MAX = Number((fonte.match(/const MAX_PESSOAS_AUTOMATICAS = (\d+);/) || [])[1]);
const contextoPessoas = (rodizio) => {
  const c = vm.createContext({
    Math, Number, String,
    PESSOAS_PADRAO,
    RODIZIO: rodizio,
    PONTO_DE_PARTIDA: 0,
    pessoasDisponiveis: PESSOAS_PADRAO,
    pessoaUrl: (nome) => (nome ? `url:${nome}` : ''),
    MAX_PESSOAS_AUTOMATICAS: MAX,
    globalThis: null,
  });
  c.globalThis = c;
  vm.runInContext(extrair('refDaPessoa') + extrair('pessoaDoSlide'), c);
  return c;
};
const { pessoaDoSlide } = contextoPessoas(PESSOAS_PADRAO);

console.log(`\nmaximo de pessoas automaticas: ${MAX}`);
const comPessoa = (slides) => slides
  .map((s, i) => (pessoaDoSlide(s, i, slides.length) ? i : null))
  .filter((i) => i !== null);

const sete = Array.from({ length: 7 }, () => ({}));
conferir('carrossel de 7 paginas sai com 2 pessoas, na capa e no fecho',
  comPessoa(sete).join(',') === '0,6', `com pessoa: ${comPessoa(sete).join(',')}`);
conferir('carrossel de 1 pagina sai com a pessoa so na capa',
  comPessoa([{}]).join(',') === '0', `com pessoa: ${comPessoa([{}]).join(',')}`);
const escolhida = sete.map((s, i) => (i === 3 ? { pessoa: 'fulana.png' } : s));
conferir('pessoa escolhida no miolo continua e nao conta no limite',
  comPessoa(escolhida).join(',') === '0,3,6', `com pessoa: ${comPessoa(escolhida).join(',')}`);
const capaSemNinguem = sete.map((s, i) => (i === 0 ? { pessoa: 'nenhuma' } : s));
conferir('"nenhuma" na capa tira a pessoa sem puxar outra para o miolo',
  comPessoa(capaSemNinguem).join(',') === '6', `com pessoa: ${comPessoa(capaSemNinguem).join(',')}`);

// A biblioteca do worker substitui o elenco da pasta, com as MESMAS posicoes.
const daBiblioteca = contextoPessoas(['https://armazem/a.png', 'https://armazem/b.png']);
const refs = sete.map((s, i) => daBiblioteca.refDaPessoa(s, i, sete.length));
conferir('com biblioteca, a pessoa automatica vem dela',
  refs[0] === 'https://armazem/a.png' && refs[6].startsWith('https://armazem/'), `refs: ${refs.join(' | ')}`);
conferir('com biblioteca, o miolo continua sem pessoa',
  refs.slice(1, 6).every((r) => r === ''), `refs: ${refs.join(' | ')}`);
const vazio = contextoPessoas(PESSOAS_PADRAO);
vazio.pessoasDisponiveis = [];
conferir('sem biblioteca e sem pasta, ninguem aparece (e nada quebra)',
  sete.every((s, i) => vazio.refDaPessoa(s, i, sete.length) === ''));

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} TESTE(S) FALHARAM`}`);
process.exit(falhas === 0 ? 0 : 1);
