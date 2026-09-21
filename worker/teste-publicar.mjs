/**
 * As regras da publicação que não dependem de rede nem de Firebase.
 *
 * O que está testado aqui é justamente o que não dá para conferir olhando:
 * a trava de fase 1, o cálculo da hora no fuso do público e as recusas antes
 * de falar com a rede.
 *
 *   node teste-publicar.mjs
 */
import {
  redeDaPeca, consultorLiberado, limitarLegenda, slidesDoCarrossel,
  capaDaPeca, videoDaPeca, pdfDaPeca, conferirPeca, escolherTexto,
  deveCruzarParaFacebook, deveCruzarParaYoutube,
} from './publicar.mjs';
import { instanteDoAgendamento, estaNaHora, pecasDevidas, diaNoFuso, jaSaiu } from './agenda.mjs';

let falhas = 0;
const conferir = (nome, ok, detalhe = '') => {
  if (!ok) falhas++;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome}${ok || !detalhe ? '' : `\n        ${detalhe}`}`);
};

const erroDe = (fn) => {
  try { fn(); return null; } catch (e) { return e.message; }
};

/* ── Qual rede ───────────────────────────────────────────────── */
conferir('reel e carrossel vão para o Instagram',
  redeDaPeca('reel') === 'instagram' && redeDaPeca('carrossel-feed') === 'instagram'
  && redeDaPeca('carrossel-video') === 'instagram');
conferir('PDF e imagem única vão para o LinkedIn',
  redeDaPeca('linkedin-pdf') === 'linkedin' && redeDaPeca('linkedin-imagem') === 'linkedin');
conferir('tipo desconhecido não escolhe rede nenhuma', redeDaPeca('tiktok') === null);

/* ── O bônus do Facebook ─────────────────────────────────────── */
// O Facebook não tem aprovação nem agendamento próprios: cruza sozinho com
// tudo que já vai para o Instagram, e só isso.
conferir('Reel e os dois carrosséis do Instagram cruzam para o Facebook',
  deveCruzarParaFacebook('reel') && deveCruzarParaFacebook('carrossel-feed') && deveCruzarParaFacebook('carrossel-video'));
conferir('peça de LinkedIn não cruza — não há Instagram para acompanhar',
  !deveCruzarParaFacebook('linkedin-pdf') && !deveCruzarParaFacebook('linkedin-imagem'));

/* ── O bônus do YouTube ──────────────────────────────────────── */
// Só quem já é vídeo vertical vira Short — carrossel de feed é foto, não tem
// o que cruzar.
conferir('Reel e carrossel em vídeo cruzam para o YouTube como Shorts',
  deveCruzarParaYoutube('reel') && deveCruzarParaYoutube('carrossel-video'));
conferir('carrossel de feed (fotos) não cruza para o YouTube',
  !deveCruzarParaYoutube('carrossel-feed'));
conferir('peça de LinkedIn não cruza para o YouTube',
  !deveCruzarParaYoutube('linkedin-pdf') && !deveCruzarParaYoutube('linkedin-imagem'));

/* ── Trava da fase 1 ─────────────────────────────────────────── */
conferir('israel publica', consultorLiberado('israel'));
conferir('ISRAEL com maiúscula também', consultorLiberado('ISRAEL'));
conferir('outro consultor NÃO publica automático na fase 1', !consultorLiberado('mariana'));
conferir('consultor vazio não publica', !consultorLiberado(''));

/* ── Legenda ─────────────────────────────────────────────────── */
conferir('legenda curta passa inteira', limitarLegenda('  Olá mundo  ', 2200) === 'Olá mundo');
const longa = limitarLegenda(`${'palavra '.repeat(400)}fim`, 2200);
conferir('legenda longa é cortada no limite', longa.length <= 2200);
conferir('o corte não parte palavra no meio', !longa.endsWith('palavr') && !longa.endsWith(' '));
conferir('legenda ausente vira texto vazio', limitarLegenda(undefined, 100) === '');

/* ── Quais arquivos ──────────────────────────────────────────── */
const carrossel = {
  id: 'p1', consultorId: 'israel', tipo: 'carrossel-feed', status: 'aprovado', legenda: 'texto',
  arquivoUrl: 'm/feed/v1/slide-01.png',
  arquivos: ['m/feed/v1/capa.jpg', 'm/feed/v1/slide-02.png', 'm/feed/v1/slide-10.png',
    'm/feed/v1/slide-01.png', 'm/feed/v1/legenda.md'],
};
const slides = slidesDoCarrossel(carrossel);
conferir('só as páginas entram no carrossel, na ordem',
  JSON.stringify(slides) === JSON.stringify(['m/feed/v1/slide-01.png', 'm/feed/v1/slide-02.png', 'm/feed/v1/slide-10.png']),
  JSON.stringify(slides));
conferir('a capa não é mandada como página do carrossel', !slides.includes('m/feed/v1/capa.jpg'));
conferir('slide-10 vem depois de slide-02, não antes', slides[2].includes('slide-10'));

const reel = {
  id: 'p2', consultorId: 'israel', tipo: 'reel', status: 'aprovado', legenda: 'texto',
  arquivoUrl: 'm/reel/reel.mp4', arquivos: ['m/reel/capa.jpg', 'm/reel/reel.mp4', 'm/reel/legenda.md'],
};
conferir('acha o vídeo do Reel', videoDaPeca(reel) === 'm/reel/reel.mp4');
conferir('acha a capa do Reel', capaDaPeca(reel) === 'm/reel/capa.jpg');
conferir('a capa versionada vence a capa antiga', capaDaPeca({
  ...reel,
  capaUrl: 'm/reel/capa-1720000000000.jpg',
  arquivos: ['m/reel/capa.jpg', 'm/reel/reel.mp4', 'm/reel/capa-1720000000000.jpg'],
}) === 'm/reel/capa-1720000000000.jpg');
conferir('a capa versionada é encontrada mesmo sem capaUrl', capaDaPeca({
  ...reel,
  capaUrl: null,
  arquivos: ['m/reel/capa.jpg', 'm/reel/reel.mp4', 'm/reel/capa-1720000000000.jpg'],
}) === 'm/reel/capa-1720000000000.jpg');
conferir('acha o PDF do LinkedIn',
  pdfDaPeca({ arquivos: ['m/li/documento.pdf'] }) === 'm/li/documento.pdf');

/* ── Recusas antes de falar com a rede ───────────────────────── */
conferir('peça inexistente é recusada', erroDe(() => conferirPeca(null))?.includes('não encontrada'));

conferir('peça de outro consultor é recusada com explicação',
  erroDe(() => conferirPeca({ ...carrossel, consultorId: 'mariana' }))?.includes('fase 1'));

conferir('peça não aprovada é recusada',
  erroDe(() => conferirPeca({ ...carrossel, status: 'revisar' }))?.includes('aprovada'));

conferir('peça sem legenda em lugar nenhum é recusada',
  erroDe(() => conferirPeca({ ...carrossel, legenda: '   ' }))?.includes('legenda'));

conferir('a recusa do LinkedIn fala de TEXTO, não de legenda de Instagram',
  erroDe(() => conferirPeca({ ...carrossel, tipo: 'linkedin-pdf', legenda: '', arquivos: ['m/li/documento.pdf'] }))?.includes('texto do LinkedIn'));

conferir('a legenda vinda do criativo serve a peça que não tem a própria',
  conferirPeca({ ...carrossel, legenda: '' }, 'texto do criativo').legenda === 'texto do criativo');

conferir('a legenda da própria peça vence a do criativo quando existe',
  conferirPeca(carrossel, undefined).legenda === 'texto');

/* ── Qual texto vai em qual rede ──────────────────────────────── */
const textos = { artigoLinkedin: 'artigo longo', legendaInstagram: 'legenda curta' };
conferir('o Instagram leva a legenda curta', escolherTexto('instagram', textos) === 'legenda curta');
conferir('o LinkedIn leva o artigo', escolherTexto('linkedin', textos) === 'artigo longo');
conferir('faltando o artigo, o LinkedIn aproveita a legenda',
  escolherTexto('linkedin', { legendaInstagram: 'só esta' }) === 'só esta');
conferir('sem texto nenhum não inventa', escolherTexto('instagram', {}) === '');

conferir('carrossel com uma página só é recusado',
  erroDe(() => conferirPeca({ ...carrossel, arquivoUrl: null, arquivos: ['m/feed/v1/slide-01.png'] }))?.includes('2 páginas'));

conferir('Reel falado sem capa é recusado, e o motivo explica o porquê',
  erroDe(() => conferirPeca({ ...reel, arquivoUrl: 'm/reel/reel.mp4', arquivos: ['m/reel/reel.mp4'] }))?.includes('sem capa'));

conferir('carrossel em vídeo NÃO precisa de capa: o primeiro quadro já é o slide de capa',
  conferirPeca({ ...reel, tipo: 'carrossel-video', arquivoUrl: 'm/reels/reel.mp4', arquivos: ['m/reels/reel.mp4'] }).rede === 'instagram');

conferir('Reel sem vídeo é recusado',
  erroDe(() => conferirPeca({ ...reel, arquivoUrl: null, arquivos: ['m/reel/capa.jpg'] }))?.includes('.mp4'));

conferir('carrossel completo passa e já vem com a rede e a legenda',
  (() => { const r = conferirPeca(carrossel); return r.rede === 'instagram' && r.legenda === 'texto'; })());

conferir('Reel completo passa', conferirPeca(reel).rede === 'instagram');

conferir('imagem única do LinkedIn passa',
  conferirPeca({ id: 'p3', consultorId: 'israel', tipo: 'linkedin-imagem', status: 'aprovado',
    legenda: 'x', arquivoUrl: 'm/feed/v1/slide-01.png' }).rede === 'linkedin');

/* ── A hora, no fuso de quem lê ──────────────────────────────── */
// O Brasil está três horas atrás do UTC: 19:00 em São Paulo é 22:00 em UTC.
conferir('19:00 de Brasília é 22:00 UTC',
  instanteDoAgendamento('2026-09-20', '19:00').toISOString() === '2026-09-20T22:00:00.000Z',
  String(instanteDoAgendamento('2026-09-20', '19:00')?.toISOString()));

conferir('dia sem hora escolhida sai às 9 da manhã',
  instanteDoAgendamento('2026-09-20', undefined).toISOString() === '2026-09-20T12:00:00.000Z');

conferir('a virada da meia-noite não pula o dia',
  instanteDoAgendamento('2026-09-20', '00:30').toISOString() === '2026-09-20T03:30:00.000Z');

conferir('num fuso com horário de verão a conta também fecha',
  instanteDoAgendamento('2026-07-01', '12:00', 'Europe/Lisbon').toISOString() === '2026-07-01T11:00:00.000Z',
  String(instanteDoAgendamento('2026-07-01', '12:00', 'Europe/Lisbon')?.toISOString()));

conferir('sem dia não há instante', instanteDoAgendamento(null, '19:00') === null);
conferir('dia estragado não vira instante', instanteDoAgendamento('amanhã', '19:00') === null);

conferir('o dia de hoje sai no formato que a peça guarda',
  diaNoFuso(new Date('2026-09-20T02:00:00Z')) === '2026-09-19',
  diaNoFuso(new Date('2026-09-20T02:00:00Z')));

/* ── Chegou a hora? ──────────────────────────────────────────── */
const agendada = { ...carrossel, agendadoEm: '2026-09-20', agendadoHora: '19:00' };
const umMinutoAntes = new Date('2026-09-20T21:59:00Z');
const umMinutoDepois = new Date('2026-09-20T22:01:00Z');

conferir('um minuto antes não publica', !estaNaHora(agendada, umMinutoAntes));
conferir('um minuto depois publica', estaNaHora(agendada, umMinutoDepois));

conferir('peça sem data no calendário nunca vence',
  !estaNaHora({ ...carrossel, agendadoEm: undefined }, umMinutoDepois));

conferir('peça em revisão não vai ao ar pelo relógio',
  !estaNaHora({ ...agendada, status: 'revisar' }, umMinutoDepois));

conferir('peça já publicada não publica de novo',
  !estaNaHora({ ...agendada, status: 'publicado' }, umMinutoDepois));

conferir('peça no meio da publicação não é enfileirada outra vez',
  !estaNaHora({ ...agendada, publicacao: { status: 'publicando' } }, umMinutoDepois));

conferir('peça que falhou espera o consultor, não tenta sozinha de hora em hora',
  !estaNaHora({ ...agendada, publicacao: { status: 'falhou', erro: 'x' } }, umMinutoDepois));

conferir('peça pausada não vai ao ar, mesmo na hora marcada',
  !estaNaHora({ ...agendada, pausada: true }, umMinutoDepois));

conferir('retomada (pausada: false) volta a publicar',
  estaNaHora({ ...agendada, pausada: false }, umMinutoDepois));

conferir('atraso de dois dias NÃO publica (worker voltou do fora do ar)',
  !estaNaHora(agendada, new Date('2026-09-22T22:01:00Z')));

conferir('atraso de duas horas ainda publica',
  estaNaHora(agendada, new Date('2026-09-21T00:01:00Z')));

conferir('jaSaiu reconhece os três jeitos de já ter ido',
  jaSaiu({ status: 'publicado' }) && jaSaiu({ publicacao: { status: 'publicada' } })
  && jaSaiu({ publicacao: { status: 'publicando' } }) && !jaSaiu({ status: 'aprovado' }));

/* ── A ordem da fila ─────────────────────────────────────────── */
const fila = pecasDevidas([
  { ...carrossel, id: 'tarde', agendadoEm: '2026-09-20', agendadoHora: '19:00' },
  { ...carrossel, id: 'manha', agendadoEm: '2026-09-20', agendadoHora: '08:00' },
  { ...carrossel, id: 'amanha', agendadoEm: '2026-09-21', agendadoHora: '19:00' },
], umMinutoDepois);
conferir('quem estava marcado primeiro sai primeiro',
  JSON.stringify(fila.map((p) => p.id)) === JSON.stringify(['manha', 'tarde']),
  JSON.stringify(fila.map((p) => p.id)));

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} TESTE(S) FALHARAM`}`);
process.exit(falhas === 0 ? 0 : 1);
