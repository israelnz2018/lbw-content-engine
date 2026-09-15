/**
 * A tela e o servidor calculam o gancho da capa cada um do seu lado.
 *
 * A tela precisa mostrar o valor efetivo ANTES de o servidor calcular — senao o
 * campo vira um placeholder que mente, que foi exatamente o problema relatado. O
 * preco e ter a conta escrita duas vezes, e o risco e uma divergir da outra sem
 * ninguem perceber.
 *
 * Este teste roda as DUAS, dos dois arquivos de verdade, e falha se discordarem.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.resolve(raiz, '..', 'Claude - Formacao 2026', 'github-temp');

/** Recorta uma funcao de um arquivo, contando chaves fora de aspas e comentarios. */
function extrair(fonte, nome) {
  const inicio = fonte.indexOf(`function ${nome}(`);
  if (inicio < 0) throw new Error(`nao achei ${nome}`);
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
  return fonte.slice(inicio, i + 1)
    .replace(/: \[string, string\]/g, '')
    .replace(/: string\[\]/g, '')
    .replace(/: number/g, '')
    .replace(/: string/g, '');
}

function carregar(arquivo, nomes, exportar) {
  const fonte = fs.readFileSync(path.join(base, arquivo), 'utf8');
  const caixa = vm.createContext({ Math, Number, String, globalThis: null });
  caixa.globalThis = caixa;
  vm.runInContext(
    `${nomes.map((n) => extrair(fonte, n)).join('\n')}\nglobalThis.alvo = ${exportar};`,
    caixa,
  );
  return caixa.alvo;
}

const doServidor = carregar('server.ts', ['tituloEmDuasLinhas', 'ganchoDoTitulo'], 'ganchoDoTitulo');
const daTela = carregar(
  'src/components/consultor/marketing/CriativosAprovados.tsx',
  ['ganchoDoTitulo'],
  'ganchoDoTitulo',
);

const titulos = [
  'Sua mentalidade é de Melhoria Contínua?',
  'Lean Six Sigma é método',
  'Minha Jornada na Melhoria Contínua',
  'Master Black Belt e Implementação',
  'Cuidado com Certificações Falsas',
  'Líder de Melhoria na Nova Zelândia',
  'O que faz o Lean Six Sigma ser diferente de tudo',
  'A maioria não sabe liderar projetos de melhoria',
  'Três coisas',
  'Melhoria',
  '',
];

let falhas = 0;
for (const t of titulos) {
  const a = doServidor(t);
  const b = daTela(t);
  const igual = JSON.stringify(a) === JSON.stringify(b);
  if (!igual) falhas++;
  console.log(`${igual ? 'ok  ' : 'FALHA'} "${t}"`);
  if (!igual) {
    console.log(`        servidor: ${JSON.stringify(a)}`);
    console.log(`        tela:     ${JSON.stringify(b)}`);
  } else if (t) {
    console.log(`        -> ${JSON.stringify(a)}`);
  }
}

console.log(`\n${falhas === 0 ? 'A TELA MOSTRA EXATAMENTE O QUE O SERVIDOR VAI USAR.' : `${falhas} DIVERGENCIA(S) — o campo da capa vai mentir.`}`);
process.exit(falhas === 0 ? 0 : 1);
