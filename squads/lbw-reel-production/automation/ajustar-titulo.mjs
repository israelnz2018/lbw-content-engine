/** Mantém o título do vídeo dentro da área segura de 1080 px. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const LARGURA_TITULO = 780; // 150 px livres de cada lado.
const TAMANHO_PADRAO = 70;

/**
 * A FAIXA DO TÍTULO, medida no layout — não escolhida.
 *
 * A barra azul do topo termina em y=105 e o slide começa em `slideY`=330 (os dois
 * números vêm do bloco `layout` que a plataforma manda). Sobram 225px, e é só
 * dentro deles que o título pode existir sem encostar em nada.
 *
 * Isto existe porque a fonte estava parando num TETO INVENTADO, não no espaço:
 * um título de 9 palavras saía a 54px ocupando 503px de largura — com 780px
 * disponíveis e 277px sobrando sem uso. O teto de 3 linhas era 54 e pronto.
 * Agora o limite é a faixa: a fonte cresce até a largura ou a altura barrarem.
 *
 * Conferência de que os números estão certos: com ENTRELINHA 1,18 esta conta
 * devolve [126, 190, 254] para 3 linhas a 54px, contra os [123, 187, 251] que
 * estavam escritos à mão, e [140, 223] contra [135, 215] para 2 linhas a 70px.
 * Reproduz o desenho homologado — só deixa de travar antes da hora.
 */
const BANDA_TOPO = 112;
const BANDA_BASE = 322;
const ENTRELINHA = 1.18;

/** O maior corpo em que `linhas` linhas ainda cabem na faixa. */
function fonteQueCabeNaAltura(linhas) {
  if (linhas <= 1) return TAMANHO_PADRAO;
  return Math.floor((BANDA_BASE - BANDA_TOPO) / (ENTRELINHA * (linhas - 1) + 1));
}

/** Onde cada linha começa, centralizando o bloco na faixa. */
function posicoesNaBanda(fonte, linhas) {
  const passo = Math.round(fonte * ENTRELINHA);
  const alturaTotal = passo * (linhas - 1) + fonte;
  const topo = Math.round(BANDA_TOPO + Math.max(0, (BANDA_BASE - BANDA_TOPO - alturaTotal) / 2));
  return Array.from({ length: linhas }, (_, i) => topo + i * passo);
}
// Chão de segurança do laço de encolher (linha ~94), não um teto de palavras.
// Antes disto valia 42 e ainda existia uma rejeição ANTES do laço de verdade,
// baseada numa estimativa grosseira por palavra — um título comprido podia ser
// recusado mesmo cabendo perfeitamente depois de medido pixel a pixel. Agora só
// existe UMA trava, no fim, e só dispara se o texto realmente não couber nem a
// 22px — o que não acontece com título nenhum de tamanho normal.
const FONTE_MINIMA = 22;

export async function ajustarTitulo(linha1, linha2, fonte) {
  const originais = [linha1, linha2].map((s) => String(s || '').trim()).filter(Boolean);
  if (!originais.length) return { linhas: ['', ''], fonte: TAMANHO_PADRAO, posicoesY: [135, 215], larguras: [0, 0] };

  const medidas = new Map();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lbw-titulo-'));
  const arquivoTexto = path.join(temp, 'texto.txt');
  const caminhoFiltro = (s) => s.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  async function medir(texto, tamanho = TAMANHO_PADRAO) {
    if (!texto) return 0;
    const chave = `${tamanho}:${texto}`;
    if (!medidas.has(chave)) {
      // Mede com o MESMO drawtext e a MESMA fonte usados no vídeo. Medir por
      // quantidade de letras ou por outra biblioteca subestimava os acentos.
      fs.writeFileSync(arquivoTexto, texto, 'utf8');
      const largura = 4096;
      const altura = 120;
      const pixels = execFileSync('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
        '-i', `color=c=black:s=${largura}x${altura}:r=1`,
        '-vf', `drawtext=fontfile='${caminhoFiltro(fonte)}':textfile='${caminhoFiltro(arquivoTexto)}':fontcolor=white:fontsize=${tamanho}:x=0:y=0:expansion=none`,
        '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1',
      ], { maxBuffer: largura * altura + 1024 * 1024, timeout: 15_000 });
      let ultimaColuna = -1;
      for (let y = 0; y < altura; y++) {
        const inicio = y * largura;
        for (let x = largura - 1; x > ultimaColuna; x--) {
          if (pixels[inicio + x] > 50) { ultimaColuna = x; break; }
        }
      }
      medidas.set(chave, ultimaColuna + 1);
    }
    return medidas.get(chave);
  }

  async function avaliar(linhas, limiteFonte) {
    const larguras70 = await Promise.all(linhas.map((linha) => medir(linha)));
    const maior = Math.max(...larguras70);
    const fonteAjustada = Math.min(limiteFonte, Math.floor(TAMANHO_PADRAO * LARGURA_TITULO / Math.max(maior, 1)));
    return { linhas, fonte: fonteAjustada, larguras70, maior };
  }

  try {
  let escolhido;
  if (originais.length === 1 && await medir(originais[0]) <= LARGURA_TITULO) {
    escolhido = await avaliar([originais[0], ''], TAMANHO_PADRAO);
  } else if (originais.length === 1 && !originais[0].includes(' ')) {
    escolhido = await avaliar([originais[0], ''], TAMANHO_PADRAO);
  } else if (originais.length === 2 && (await Promise.all(originais.map((linha) => medir(linha)))).every((n) => n <= LARGURA_TITULO)) {
    escolhido = await avaliar(originais, TAMANHO_PADRAO);
  } else {
    const palavras = originais.join(' ').split(/\s+/).filter(Boolean);
    const opcoes2 = [];
    for (let i = 1; i < palavras.length; i++) {
      opcoes2.push(await avaliar([palavras.slice(0, i).join(' '), palavras.slice(i).join(' ')], TAMANHO_PADRAO));
    }
    opcoes2.sort((a, b) => b.fonte - a.fonte || a.maior - b.maior);
    escolhido = opcoes2[0];

    // Três linhas cabem acima do slide com o corpo que a faixa permitir — hoje
    // 62px, e não os 54 que estavam escritos à mão. Só são usadas quando duas
    // linhas tornariam o título pequeno demais.
    if (!escolhido || escolhido.fonte < 52) {
      const tetoDeTresLinhas = fonteQueCabeNaAltura(3);
      const opcoes3 = [];
      for (let i = 1; i < palavras.length - 1; i++) {
        for (let j = i + 1; j < palavras.length; j++) {
          opcoes3.push(await avaliar([
            palavras.slice(0, i).join(' '),
            palavras.slice(i, j).join(' '),
            palavras.slice(j).join(' '),
          ], tetoDeTresLinhas));
        }
      }
      opcoes3.sort((a, b) => b.fonte - a.fonte || a.maior - b.maior);
      if (opcoes3[0] && (!escolhido || opcoes3[0].fonte > escolhido.fonte)) escolhido = opcoes3[0];
    }
  }

  if (!escolhido) {
    // Não sobrou nenhuma combinação de linhas — normalmente uma palavra só,
    // comprida demais até em 3 linhas. Não rejeita de antemão: usa o texto como
    // veio e deixa o laço abaixo encolher pixel a pixel, igual a qualquer outro.
    escolhido = { linhas: originais.length === 1 ? [originais[0], ''] : originais, fonte: TAMANHO_PADRAO };
  }
  let larguras = await Promise.all(escolhido.linhas.map((linha) => medir(linha, escolhido.fonte)));
  while (larguras.some((n) => n > LARGURA_TITULO) && escolhido.fonte > FONTE_MINIMA) {
    escolhido.fonte--;
    larguras = await Promise.all(escolhido.linhas.map((linha) => medir(linha, escolhido.fonte)));
  }
  // As posições saem do corpo final, e não de uma tabela fixa: mudar a fonte sem
  // mover as linhas junto ou abria um buraco na faixa ou encavalava as linhas.
  const usadas = escolhido.linhas.filter((l) => String(l || '').trim()).length || 1;
  const posicoesY = posicoesNaBanda(escolhido.fonte, usadas);
  // Só dispara se o texto não couber nem no chão de segurança — título absurdamente
  // comprido numa palavra só que nem quebra de linha resolve. Não é limite de
  // palavra: é o piso físico de legibilidade.
  if (larguras.some((n) => n > LARGURA_TITULO)) throw new Error(`O título não coube nem na fonte mínima (${escolhido.fonte}px, larguras ${larguras.join(', ')}). Isso só acontece com uma palavra única e muito longa — encurte essa palavra.`);
  return { linhas: escolhido.linhas, fonte: escolhido.fonte, posicoesY, larguras };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [linha1, linha2, fonte] = process.argv.slice(2);
  console.log(JSON.stringify(await ajustarTitulo(linha1, linha2, fonte)));
}
