/**
 * As regras da biblioteca de imagens que não dependem do Firebase.
 *
 *   node teste-imagens.mjs
 */
import { aplicarNaPagina, imagensPorPagina, podeUsar } from './imagens.mjs';

let falhas = 0;
const conferir = (nome, ok, detalhe = '') => {
  if (!ok) falhas++;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome}${ok || !detalhe ? '' : `\n        ${detalhe}`}`);
};

/* ── Onde a imagem entra ─────────────────────────────────────── */
const capa = { type: 'capa', title: 'x', body: 'y', imagemId: 'abc' };

const comPessoa = aplicarNaPagina(capa, 'https://a/p.png', 'pessoa');
conferir('pessoa vai na coluna da pessoa', comPessoa.pessoa === 'https://a/p.png' && comPessoa.type === 'capa');
conferir('o id sai da página que vai ao renderizador', !('imagemId' in comPessoa));

const comCena = aplicarNaPagina(capa, 'https://a/c.jpg', 'cena');
conferir('cena vira página de foto de fundo', comCena.type === 'foto' && comCena.fundo === 'https://a/c.jpg');
conferir('cena não deixa pessoa sobrando', !('pessoa' in comCena));

const foto = { type: 'foto', title: 'x', body: 'y', fundo: 'velho' };
const fotoComPessoa = aplicarNaPagina(foto, 'https://a/p.png', 'pessoa');
conferir('pessoa numa página de foto troca para a padrão, que tem a coluna',
  fotoComPessoa.type === 'padrao' && !('fundo' in fotoComPessoa), JSON.stringify(fotoComPessoa));

const comparacao = aplicarNaPagina({ type: 'comparacao', title: 'x', body: 'y' }, 'u', 'pessoa');
conferir('comparação também troca para a padrão', comparacao.type === 'padrao');
conferir('a página original não é alterada', capa.imagemId === 'abc' && !('pessoa' in capa));

/* ── Quem pode usar ──────────────────────────────────────────── */
conferir('imagem pública serve para qualquer consultor',
  podeUsar({ status: 'aprovada', publica: true, consultorId: 'lbw' }, 'mariana'));
conferir('foto enviada serve para o dono',
  podeUsar({ status: 'aprovada', publica: false, consultorId: 'israel' }, 'israel'));
conferir('foto enviada NÃO serve para outro consultor',
  !podeUsar({ status: 'aprovada', publica: false, consultorId: 'israel' }, 'mariana'));
conferir('candidata pode ir para a página (é assim que a prévia sai)',
  podeUsar({ status: 'candidata', publica: false, consultorId: 'israel' }, 'israel'));
conferir('descartada não volta para página nenhuma',
  !podeUsar({ status: 'descartada', publica: true, consultorId: 'lbw' }, 'israel'));
conferir('ficha que não existe não quebra', !podeUsar(null, 'israel'));

/* ── Uso por página ──────────────────────────────────────────── */
const usos = new Map([['https://a/1', 'img-1'], ['https://a/2', 'img-2']]);
const porPagina = imagensPorPagina(['https://a/1', null, '04-explicando-homem-40', 'https://a/2'], usos);
conferir('cada página aponta a imagem da biblioteca que usou',
  JSON.stringify(porPagina) === JSON.stringify(['img-1', null, null, 'img-2']), JSON.stringify(porPagina));
conferir('resultado sem a lista de pessoas não quebra', imagensPorPagina(undefined, usos).length === 0);

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} TESTE(S) FALHARAM`}`);
process.exit(falhas === 0 ? 0 : 1);
