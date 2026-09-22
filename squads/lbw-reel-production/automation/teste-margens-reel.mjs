import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ajustarTitulo, LARGURA_TITULO } from './ajustar-titulo.mjs';

const pasta = path.dirname(fileURLToPath(import.meta.url));
const fonte = process.platform === 'win32' ? 'C:/Windows/Fonts/arialbd.ttf' : '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf';
const exemplos = [
  ['VARIAÇÃO NO PROCESSO NEM', 'SEMPRE É UM PROBLEMA'],
  ['QUEM DEVE ESTUDAR', 'MELHORIA CONTÍNUA?'],
  ['A IMPORTÂNCIA DA ANÁLISE DE DADOS', 'PARA MELHORAR PROCESSOS COMPLEXOS'],
];

for (const [linha1, linha2] of exemplos) {
  const resultado = await ajustarTitulo(linha1, linha2, fonte);
  assert(resultado.larguras.every((largura) => largura <= LARGURA_TITULO));
  assert.equal(resultado.linhas.join(' ').replace(/\s+/g, ' '), `${linha1} ${linha2}`);
}

const temporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'lbw-teste-capa-'));
try {
  const gancho = ['VARIAÇÃO NO PROCESSO NEM', 'SEMPRE É UM PROBLEMA'];
  const logo = path.join(pasta, 'assets', 'logo-oficial-lw.png');
  const configuracao = path.join(temporaria, 'config.json');
  const saida = path.join(temporaria, 'capa.jpg');
  fs.writeFileSync(configuracao, JSON.stringify({
    logoPath: logo,
    cover: { mode: 'dedicated', courseKey: 'white-belt', hookLines: gancho },
  }));
  const bruto = execFileSync(process.execPath, [path.join(pasta, 'render-reel-cover.mjs'),
    '--config', configuracao, '--portrait', logo, '--output', saida], { encoding: 'utf8' });
  const resultado = JSON.parse(bruto);
  assert.equal(resultado.hookLayout.texto, gancho.join(' '));
  assert(resultado.hookLayout.fonte >= 12);
  assert(fs.statSync(saida).size > 0);
  console.log(`OK: título do vídeo dentro de ${LARGURA_TITULO}px e capa completa com ${resultado.hookLayout.fonte}px.`);
} finally {
  fs.rmSync(temporaria, { recursive: true, force: true });
}
