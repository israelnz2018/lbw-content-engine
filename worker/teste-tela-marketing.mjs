/**
 * Entra logado e CLICA EM CADA ETAPA da aba de marketing, procurando erro.
 *
 * Abrir a primeira tela nao prova nada: o erro que derrubou tudo estava numa
 * tela que so aparece depois de clicar. Conferir o texto dentro do arquivo
 * publicado tambem nao prova — o texto estava la e a tela nao abria.
 */
import { chromium } from 'playwright';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const API_KEY = 'AIzaSyB9LDdd9E6wZOb5LQ1oLfU3BP5_69rLmvE';
const SITE = 'https://app.educacaopelotrabalho.com';
const EMAIL = 'israelnz2018@hotmail.com';
const PASTA = process.argv[2] || '.';
const ETAPAS = ['Configuração', 'Redes sociais', 'Meus vídeos', 'Minhas peças', 'Publicação'];

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_KEY_JSON)) });
}
const user = await getAuth().getUserByEmail(EMAIL);
const custom = await getAuth().createCustomToken(user.uid);
const sessao = await (await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) },
)).json();

const navegador = await chromium.launch({ headless: true });
const pagina = await (await navegador.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();

let etapaAtual = '(carregando)';
const erros = [];
const anotar = (texto) => { erros.push(`[${etapaAtual}] ${texto}`); };
pagina.on('console', (m) => { if (m.type() === 'error') anotar(m.text().slice(0, 300)); });
pagina.on('pageerror', (e) => anotar(`ERRO DE PAGINA: ${e.message}`));

await pagina.goto(SITE, { waitUntil: 'domcontentloaded' });
await pagina.evaluate(async (d) => {
  const registro = {
    fbase_key: `firebase:authUser:${d.apiKey}:[DEFAULT]`,
    value: {
      uid: d.uid, email: d.email, emailVerified: true, displayName: null, isAnonymous: false, photoURL: null,
      providerData: [{ providerId: 'password', uid: d.email, displayName: null, email: d.email, phoneNumber: null, photoURL: null }],
      stsTokenManager: { refreshToken: d.refreshToken, accessToken: d.idToken, expirationTime: Date.now() + Number(d.expiresIn) * 1000 },
      createdAt: String(Date.now()), lastLoginAt: String(Date.now()), apiKey: d.apiKey, appName: '[DEFAULT]',
    },
  };
  await new Promise((ok, err) => {
    const p = indexedDB.open('firebaseLocalStorageDb', 1);
    p.onupgradeneeded = () => p.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
    p.onsuccess = () => {
      const bd = p.result;
      const tx = bd.transaction('firebaseLocalStorage', 'readwrite');
      tx.objectStore('firebaseLocalStorage').put(registro);
      tx.oncomplete = () => { bd.close(); ok(); };
      tx.onerror = () => err(tx.error);
    };
    p.onerror = () => err(p.error);
  });
}, { apiKey: API_KEY, idToken: sessao.idToken, refreshToken: sessao.refreshToken, expiresIn: sessao.expiresIn, uid: user.uid, email: EMAIL });

await pagina.goto(`${SITE}/configuracao?aba=marketing`, { waitUntil: 'domcontentloaded' });
await pagina.waitForTimeout(9000);

for (const etapa of ETAPAS) {
  etapaAtual = etapa;
  const antes = erros.length;
  try {
    await pagina.getByText(etapa, { exact: true }).first().click({ timeout: 15000 });
    await pagina.waitForTimeout(5000);
  } catch (e) {
    anotar(`nao consegui clicar: ${String(e.message).split('\n')[0]}`);
  }
  const texto = await pagina.evaluate(() => (document.getElementById('root')?.innerText || ''));
  const quebrou = texto.includes('Algo deu errado');
  if (quebrou) anotar('A TELA QUEBROU (Ops! Algo deu errado)');
  const arquivo = `${PASTA}/etapa-${ETAPAS.indexOf(etapa) + 1}.png`;
  await pagina.screenshot({ path: arquivo });
  const novos = erros.length - antes;
  console.log(`${novos === 0 && !quebrou ? 'ok   ' : 'FALHA'} ${etapa}${novos ? ` — ${novos} erro(s)` : ''}`);
}

console.log('');
if (erros.length) { for (const e of erros) console.log(`  ${e}`); console.log(`\n${erros.length} ERRO(S)`); }
else console.log('AS CINCO ETAPAS ABREM SEM NENHUM ERRO.');
await navegador.close();
process.exit(erros.length ? 1 : 0);
