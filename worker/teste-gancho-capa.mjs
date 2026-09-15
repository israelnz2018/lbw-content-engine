/**
 * Confere o gancho automatico da capa, com a funcao DO server.ts.
 *
 * O gancho tem de caber em 3 a 6 palavras e ate 3 linhas: e o limite do padrao
 * das capas, e quem o estoura faz o render-reel-cover.mjs recusar a peca inteira.
 * Titulo comprido e o caso comum, entao esta conta nao pode falhar em silencio.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const caminhoServer = path.resolve(raiz, '..', 'Claude - Formacao 2026', 'github-temp', 'server.ts');
const fonte = fs.readFileSync(caminhoServer, 'utf8');

/** Recorta uma funcao do arquivo de verdade, contando chaves fora de aspas. */
function extrair(nome) {
  const inicio = fonte.indexOf(`function ${nome}(`);
  if (inicio < 0) throw new Error(`nao achei ${nome} em server.ts`);
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
  // Tira as anotacoes de tipo, que o vm nao entende. O corpo continua sendo o do
  // arquivo — o que se testa e a conta de verdade, nao uma copia minha.
  return fonte.slice(inicio, i + 1)
    .replace('(titulo: string): string[]', '(titulo)')
    .replace('(titulo: string): [string, string]', '(titulo)')
    .replace('const linhas: string[] = []', 'const linhas = []')
    .replace(/: string\[\]/g, '')
    .replace(/: number/g, '')
    .replace(/: string/g, '');
}

const caixa = vm.createContext({ Math, Number, String, globalThis: null });
caixa.globalThis = caixa;
vm.runInContext(
  `${extrair('tituloEmDuasLinhas')}\n${extrair('ganchoDoTitulo')}\n`
  + 'globalThis.ganchoDoTitulo = ganchoDoTitulo;',
  caixa,
);
const { ganchoDoTitulo } = caixa;

let falhas = 0;
function conferir(titulo) {
  const linhas = ganchoDoTitulo(titulo);
  const palavras = linhas.join(' ').split(/\s+/).filter(Boolean).length;
  // Titulo com menos de 3 palavras nao da gancho: o servidor recusa com aviso,
  // e recusar e o comportamento certo — nao e falha da conta.
  const palavrasDoTitulo = titulo.trim().split(/\s+/).filter(Boolean).length;
  const ok = palavrasDoTitulo < 3
    ? palavras === palavrasDoTitulo
    : (linhas.length >= 1 && linhas.length <= 3 && palavras >= 3 && palavras <= 6);
  if (!ok) falhas++;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${palavras}p/${linhas.length}l  "${titulo}"`);
  if (!ok) console.log(`        ${JSON.stringify(linhas)}`);
  return linhas;
}

console.log('titulos reais e extremos:\n');
conferir('Sua mentalidade é de Melhoria Contínua?');
conferir('Lean Six Sigma é método');
conferir('Minha Jornada na Melhoria Contínua');
conferir('Master Black Belt e Implementação');
conferir('Cuidado com Certificações Falsas');
conferir('Líder de Melhoria na Nova Zelândia');
conferir('O que faz o Lean Six Sigma ser diferente de todas as outras metodologias de gestão');
conferir('Três coisas');
conferir('A maioria não sabe liderar projetos de melhoria contínua na indústria brasileira');

console.log('\nquebras em 3 linhas:');
for (const t of ['Sua mentalidade é de Melhoria Contínua?', 'Lean Six Sigma é método', 'Três coisas']) {
  console.log(`  "${t}" -> ${JSON.stringify(ganchoDoTitulo(t))}`);
}

console.log('\ncasos que devem devolver vazio (a capa sai sem gancho):');
for (const t of ['', '   ']) {
  const r = ganchoDoTitulo(t);
  const ok = r.length === 0;
  if (!ok) falhas++;
  console.log(`${ok ? 'ok  ' : 'FALHA'} titulo vazio -> ${JSON.stringify(r)}`);
}

// Titulo de 1 ou 2 palavras nao chega a 3. Nao e mais recusado — nada na capa e
// obrigatorio —, a tela so avisa que o padrao recomenda de 3 a 6.
const curto = ganchoDoTitulo('Melhoria');
const palavrasCurto = curto.join(' ').split(/\s+/).filter(Boolean).length;
console.log(`\ntitulo de uma palavra -> ${palavrasCurto} palavra(s); a tela avisa, a capa sai assim mesmo.`);

console.log(`\n${falhas === 0 ? 'O GANCHO SEMPRE CABE NO PADRAO.' : `${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
