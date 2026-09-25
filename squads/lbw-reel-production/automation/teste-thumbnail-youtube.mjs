/**
 * Prova de fogo da capa 16:9 do YouTube.
 *
 * Confere as DUAS metades do critério: gancho curto sai legível (corpo acima do
 * piso de 60px) e gancho comprido é RECUSADO em vez de encolhido.
 *
 * É o inverso da capa do Reel de propósito. Lá encolher até caber está certo,
 * porque a capa é vista grande no Instagram. Aqui a miniatura é vista a 168px
 * na lista de sugeridos, e um gancho de 13 palavras encolhido para caber foi
 * medido virando borrão ilegível.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const pasta = path.dirname(fileURLToPath(import.meta.url));
const logo = path.join(pasta, 'assets', 'logo-oficial-lw.png');
const temporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'lbw-teste-thumb-'));

/** Gera e devolve {ok, resultado|erro}. */
function gerar(hookLines, nome) {
  const configuracao = path.join(temporaria, `${nome}.json`);
  const saida = path.join(temporaria, `${nome}.jpg`);
  fs.writeFileSync(configuracao, JSON.stringify({
    logoPath: logo,
    thumb: { courseKey: 'white-belt', seriesLabel: 'WHITE BELT', episode: 'PARTE 2', hookLines },
  }));
  try {
    const bruto = execFileSync(process.execPath, [
      path.join(pasta, 'render-youtube-thumbnail.mjs'),
      '--config', configuracao, '--portrait', logo, '--output', saida,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, resultado: JSON.parse(bruto), saida };
  } catch (e) {
    return { ok: false, erro: String(e.stderr || e.message) };
  }
}

try {
  /* ── Gancho no padrão: sai grande e em poucas linhas ───────── */
  const curto = gerar(['POR QUE NINGUÉM GOSTA DE LEAN'], 'curto');
  assert(curto.ok, `o gancho de 6 palavras devia passar, mas falhou:\n${curto.erro}`);
  assert.equal(curto.resultado.width, 1280);
  assert.equal(curto.resultado.height, 720);
  assert.equal(curto.resultado.hookLayout.texto, 'POR QUE NINGUÉM GOSTA DE LEAN');
  assert(
    curto.resultado.hookLayout.fonte >= 60,
    `o corpo ficou em ${curto.resultado.hookLayout.fonte}px, abaixo do piso legível de 60px`,
  );
  assert(
    curto.resultado.hookLayout.linhas <= 3,
    `ocupou ${curto.resultado.hookLayout.linhas} linhas, acima do limite de 3`,
  );
  assert(fs.statSync(curto.saida).size > 0, 'a miniatura saiu vazia');

  /* ── Gancho comprido: RECUSA, e diz o que fazer ────────────── */
  // Este é o caso que provou que o piso de fonte sozinho não bastava: a 70px
  // ele CABIA, em cinco linhas — cabia e não se lia.
  const longo = gerar(['POR QUE TANTA GENTE NÃO GOSTA DO LEAN SIX SIGMA (E O QUE FAZER SOBRE ISSO)'], 'longo');
  assert(!longo.ok, 'o gancho de 15 palavras devia ter sido RECUSADO, mas a capa foi gerada');
  assert.match(longo.erro, /palavras/, 'o erro deveria dizer quantas palavras o gancho tem');
  assert.match(longo.erro, /linhas/, 'o erro deveria dizer quantas linhas ele ocupou');
  assert.match(longo.erro, /168px/, 'o erro deveria explicar de onde vem o piso');

  console.log(
    `OK: 6 palavras a ${curto.resultado.hookLayout.fonte}px em `
    + `${curto.resultado.hookLayout.linhas} linha(s); gancho comprido recusado com o motivo.`,
  );
} finally {
  fs.rmSync(temporaria, { recursive: true, force: true });
}
