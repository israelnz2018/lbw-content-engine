/**
 * Prova de fogo da capa 16:9 do YouTube: gera de verdade e confere que o
 * gancho comprido não trunca — o mesmo padrão do teste da capa do Reel.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const pasta = path.dirname(fileURLToPath(import.meta.url));
const temporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'lbw-teste-thumb-'));

try {
  const logo = path.join(pasta, 'assets', 'logo-oficial-lw.png');
  const configuracao = path.join(temporaria, 'config.json');
  const saida = path.join(temporaria, 'thumb.jpg');

  // Um gancho de 13 palavras — bem acima das "3 a 6" do Reel — para provar que
  // a capa 16:9 também não tem teto de palavra, só encolhe até caber.
  const gancho = ['POR QUE TANTA GENTE NÃO GOSTA DO LEAN SIX SIGMA (E O QUE FAZER SOBRE ISSO)'];
  fs.writeFileSync(configuracao, JSON.stringify({
    logoPath: logo,
    thumb: { courseKey: 'white-belt', seriesLabel: 'WHITE BELT', episode: 'PARTE 2', hookLines: gancho },
  }));

  const bruto = execFileSync(process.execPath, [
    path.join(pasta, 'render-youtube-thumbnail.mjs'),
    '--config', configuracao, '--portrait', logo, '--output', saida,
  ], { encoding: 'utf8' });
  const resultado = JSON.parse(bruto);

  assert.equal(resultado.width, 1280);
  assert.equal(resultado.height, 720);
  assert.equal(resultado.hookLayout.texto, gancho.join(' '));
  assert(resultado.hookLayout.fonte >= 24, `fonte caiu para ${resultado.hookLayout.fonte}px — abaixo do piso de legibilidade`);
  assert(fs.statSync(saida).size > 0, 'a miniatura saiu vazia');

  console.log(`OK: miniatura 1280x720 completa, gancho de 13 palavras a ${resultado.hookLayout.fonte}px.`);
} finally {
  fs.rmSync(temporaria, { recursive: true, force: true });
}
