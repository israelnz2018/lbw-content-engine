/**
 * O retrato da capa do Reel: o círculo da câmera, recortado exatamente, do
 * quadro mais nítido, na melhor fonte que existe.
 *
 * O Israel, depois de várias rodadas: "de uma vez por todas... eu não aceito
 * que minha imagem não ocupe 100 por cento do espaço destinado a ele. A
 * qualidade da imagem precisa melhorar... padronize... se for necessário,
 * deixe um círculo perfeito para ficar exatamente igual a minha foto".
 *
 * Medido antes de escrever uma linha (seis vídeos, de cursos e anos
 * diferentes), eram três defeitos independentes:
 *
 * 1. POSIÇÃO. O recorte era um QUADRADO fixo (x:990 y:390 290x260 em
 *    1280x720), maior que a bolha redonda da câmera. Pegava o slide em volta —
 *    o "ea de" que apareceu numa capa — e os cantos cinza fora do círculo.
 *    A bolha, essa, está SEMPRE no mesmo lugar em todos os vídeos: é a bolha
 *    fixa do programa de gravação. Aqui o recorte é o próprio círculo.
 *
 * 2. FONTE. O quadro saía da versão MP4 comprimida do Bunny (no máximo
 *    720p). Dos 60 vídeos do Israel conferidos, 46 têm o ORIGINAL em
 *    1920x1080 — 1,5x mais detalhe em cada eixo, nunca usado. Aqui o quadro
 *    vem do original, e só cai para o MP4 se o original não abrir.
 *
 * 3. INSTANTE. Um horário fixo pega o que estiver lá — mãos na frente do
 *    rosto, movimento borrado. Aqui são lidos vários quadros em volta desse
 *    horário e fica o mais nítido.
 *
 * O que NÃO se resolve aqui: 13 dos 60 vídeos foram enviados ao Bunny em
 * 640x360, e o original deles também é 640x360. O círculo da câmera ali tem
 * ~96 pixels úteis. Nenhum programa cria detalhe que a gravação não tem — a
 * correção desses é reenviar o arquivo em alta resolução, se ele existir.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * A bolha da câmera, em FRAÇÕES do quadro — vale para qualquer resolução.
 * `cx` e `r` são frações da LARGURA; `cy`, da ALTURA.
 *
 * Medida pixel a pixel em 640x360 e em 1280x720 (os dois deram o mesmo, a
 * menos de um pixel), e conferida visualmente em mais quatro vídeos Full HD.
 */
export const CIRCULO_DA_CAMERA = Object.freeze({ cx: 0.909, cy: 0.767, r: 0.0887 });

/**
 * Quanto do raio da bolha é usado. Não é 100%: a borda da bolha encosta na
 * faixa azul do rodapé do slide e num triângulo decorativo à direita, e a
 * posição varia um ou dois pixels de vídeo para vídeo. 86% deixa uma margem
 * que nunca pega nada disso — e o que sobra é só câmera, sem nenhum pixel de
 * slide, que é a exigência "sem gaps" do Israel.
 */
export const MARGEM_DO_CIRCULO = 0.86;

/** Lado, em pixels, do retrato que sai para a capa. Espelha .portrait-shell. */
export const LADO_DO_RETRATO = 800;

/**
 * Quantos quadros disputam a vaga: 6 segundos em volta do instante escolhido,
 * 5 por segundo = 30 candidatos. Janela curta demais não tem um momento
 * parado para escolher; longa demais pode sair do assunto do corte.
 */
const JANELA_SEGUNDOS = 6;
const QUADROS_POR_SEGUNDO = 5;

function par(n) {
  const v = Math.round(n);
  return v % 2 === 0 ? v : v - 1;
}

/**
 * O quadrado que contém exatamente o círculo útil da câmera, nas dimensões
 * reais da fonte. Os cantos desse quadrado (fora do círculo) têm slide, mas a
 * capa mostra o retrato numa moldura REDONDA do mesmo círculo — então eles
 * nunca aparecem.
 */
export function quadradoDaCamera(dimensoes, circulo = CIRCULO_DA_CAMERA, margem = MARGEM_DO_CIRCULO) {
  const { width, height } = dimensoes || {};
  if (!(width > 0 && height > 0)) throw new Error('Dimensões da fonte inválidas para recortar o retrato.');
  const raio = circulo.r * width * margem;
  const lado = Math.min(par(2 * raio), par(width), par(height));
  const x = par(Math.max(0, Math.min(circulo.cx * width - lado / 2, width - lado)));
  const y = par(Math.max(0, Math.min(circulo.cy * height - lado / 2, height - lado)));
  return { x, y, width: lado, height: lado };
}

/**
 * A região do ROSTO dentro do quadrado da câmera, em frações do lado.
 *
 * A bolha enquadra o apresentador sentado: o rosto fica no terço superior
 * central. A nitidez é medida SÓ aqui — o primeiro teste mediu o círculo
 * inteiro e escolheu um quadro com a mão borrada na frente do peito, porque
 * braço e mão têm contornos fortes e "ganharam" do rosto.
 */
const REGIAO_DO_ROSTO = { x0: 0.28, x1: 0.72, y0: 0.12, y1: 0.62 };

/** Nitidez: variância do laplaciano na região do rosto. */
export function nitidezDoQuadro(cinza, lado) {
  const x0 = Math.max(1, Math.floor(lado * REGIAO_DO_ROSTO.x0));
  const x1 = Math.min(lado - 1, Math.ceil(lado * REGIAO_DO_ROSTO.x1));
  const y0 = Math.max(1, Math.floor(lado * REGIAO_DO_ROSTO.y0));
  const y1 = Math.min(lado - 1, Math.ceil(lado * REGIAO_DO_ROSTO.y1));
  let soma = 0;
  let somaQuadrados = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * lado + x;
      const lap = cinza[i - 1] + cinza[i + 1] + cinza[i - lado] + cinza[i + lado] - 4 * cinza[i];
      soma += lap;
      somaQuadrados += lap * lap;
      n++;
    }
  }
  if (!n) return 0;
  const media = soma / n;
  return somaQuadrados / n - media * media;
}

/**
 * Movimento entre dois quadros: diferença média, só dentro do círculo.
 *
 * Os cantos do quadrado são slide — parado, mas às vezes trocando de página —
 * e não dizem nada sobre o apresentador.
 */
export function movimentoEntre(a, b, lado, soNoRosto = false) {
  const c = (lado - 1) / 2;
  const raio2 = (lado * 0.5 * 0.92) ** 2;
  const x0 = soNoRosto ? Math.floor(lado * REGIAO_DO_ROSTO.x0) : 0;
  const x1 = soNoRosto ? Math.ceil(lado * REGIAO_DO_ROSTO.x1) : lado;
  const y0 = soNoRosto ? Math.floor(lado * REGIAO_DO_ROSTO.y0) : 0;
  const y1 = soNoRosto ? Math.ceil(lado * REGIAO_DO_ROSTO.y1) : lado;
  let soma = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if ((x - c) ** 2 + (y - c) ** 2 > raio2) continue;
      const i = y * lado + x;
      soma += Math.abs(a[i] - b[i]);
      n++;
    }
  }
  return n ? soma / n : 0;
}

/**
 * Qual quadro vira retrato.
 *
 * Três notas, por POSIÇÃO no ranking (para não depender da escala de cada
 * medida):
 *  - ROSTO PARADO (peso 2): movimento no rosto com o quadro anterior e o
 *    seguinte. Falar mexe boca e queixo; a pausa entre frases é o momento em
 *    que a boca está fechada. O segundo teste escolheu um quadro nítido de
 *    boca escancarada porque só o corpo era medido — a boca é área pequena.
 *  - CORPO PARADO (peso 1): o círculo todo. Pega mão na frente e braço
 *    borrado, o defeito da primeira capa ruim.
 *  - ROSTO NÍTIDO (peso 1): desempate entre momentos igualmente calmos.
 */
export function escolherQuadro(quadros, lado) {
  const total = quadros.length;
  if (!total) throw new Error('Nenhum quadro para escolher o retrato.');
  if (total === 1) return 0;
  const vizinhanca = (soNoRosto) => quadros.map((q, i) => {
    const vizinhos = [];
    if (i > 0) vizinhos.push(movimentoEntre(q, quadros[i - 1], lado, soNoRosto));
    if (i < total - 1) vizinhos.push(movimentoEntre(q, quadros[i + 1], lado, soNoRosto));
    return vizinhos.reduce((s, v) => s + v, 0) / vizinhos.length;
  });
  const posicao = (valores, maiorEhMelhor) => {
    const ordem = valores.map((v, i) => [v, i]).sort((p, q) => (maiorEhMelhor ? q[0] - p[0] : p[0] - q[0]));
    const nota = new Array(total);
    ordem.forEach(([, i], pos) => { nota[i] = pos; });
    return nota;
  };
  const rostoParado = posicao(vizinhanca(true), false);
  const corpoParado = posicao(vizinhanca(false), false);
  const rostoNitido = posicao(quadros.map((q) => nitidezDoQuadro(q, lado)), true);
  let melhor = 0;
  let melhorNota = Infinity;
  for (let i = 0; i < total; i++) {
    const nota = rostoParado[i] * 2 + corpoParado[i] + rostoNitido[i];
    if (nota < melhorNota) { melhorNota = nota; melhor = i; }
  }
  return melhor;
}

/** "00:01:43.190" (ou segundos) -> segundos. */
export function segundosDe(instante) {
  if (typeof instante === 'number') return instante;
  const partes = String(instante || '0').split(':').map(Number);
  if (partes.some((p) => !Number.isFinite(p))) throw new Error(`Instante do retrato inválido: ${instante}`);
  return partes.reduce((acc, p) => acc * 60 + p, 0);
}

/**
 * O endereço do ORIGINAL no Bunny, a partir de uma versão MP4 dele.
 * Outras origens (Storage, arquivo local) voltam como vieram.
 */
export function fonteOriginal(url) {
  const texto = String(url || '');
  return /\.b-cdn\.net\/[0-9a-f-]{36}\/play_\d+p\.mp4(\?.*)?$/i.test(texto)
    ? texto.replace(/\/play_\d+p\.mp4(\?.*)?$/i, '/original')
    : texto;
}

function argsDeCabecalhos(cabecalhos) {
  if (!cabecalhos || !Object.keys(cabecalhos).length) return [];
  return ['-headers', `${Object.entries(cabecalhos).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n`];
}

async function dimensoes(url, cabecalhos) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', ...argsDeCabecalhos(cabecalhos),
    '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', url,
  ], { timeout: 60 * 1000 });
  const [width, height] = stdout.trim().split('\n')[0].split(',').map(Number);
  if (!(width > 0 && height > 0)) throw new Error(`Não consegui ler as dimensões de ${url}`);
  return { width, height };
}

/**
 * Tira o retrato: melhor fonte, círculo exato, quadro mais nítido, e
 * ampliação cuidadosa até LADO_DO_RETRATO.
 *
 * Devolve também o que foi usado — fonte, lado real em pixels, nitidez —
 * para ficar registrado na campanha: quando uma capa sair fraca, dá para ver
 * na hora se foi o vídeo (360p) e não adivinhar.
 */
export async function extrairRetrato({ sourceVideo, cabecalhos, instante, saida, temp }) {
  const original = fonteOriginal(sourceVideo);
  let fonte = original;
  let dims;
  try {
    dims = await dimensoes(original, cabecalhos);
  } catch {
    fonte = sourceVideo;
    dims = await dimensoes(sourceVideo, cabecalhos);
  }

  const q = quadradoDaCamera(dims);
  const centro = segundosDe(instante);
  const inicio = Math.max(0, centro - JANELA_SEGUNDOS / 2);
  const pasta = path.join(temp, 'retrato-quadros');
  fs.mkdirSync(pasta, { recursive: true });
  const cinzaPath = path.join(pasta, 'cinza.raw');

  // UMA passada pela rede, só em cor. O cinza (para medir) sai depois, dos
  // PNGs locais: fazer os dois no mesmo filtro com `split` deixou o retrato
  // em PRETO E BRANCO no primeiro teste — o ffmpeg negocia um formato só para
  // os dois ramos do split, e o cinza ganhou.
  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', ...argsDeCabecalhos(cabecalhos),
    '-ss', String(inicio), '-t', String(JANELA_SEGUNDOS), '-i', fonte,
    '-vf', `crop=${q.width}:${q.height}:${q.x}:${q.y},fps=${QUADROS_POR_SEGUNDO}`,
    path.join(pasta, 'q-%02d.png'),
  ], { timeout: 3 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 });
  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-i', path.join(pasta, 'q-%02d.png'),
    '-vf', 'format=gray', '-f', 'rawvideo', cinzaPath,
  ], { timeout: 60 * 1000 });

  const cinza = fs.readFileSync(cinzaPath);
  const porQuadro = q.width * q.height;
  const total = Math.floor(cinza.length / porQuadro);
  if (!total) throw new Error('Não consegui ler nenhum quadro do vídeo para o retrato.');
  const quadros = Array.from({ length: total }, (_, i) => cinza.subarray(i * porQuadro, (i + 1) * porQuadro));
  const melhor = escolherQuadro(quadros, q.width);
  const escolhido = path.join(pasta, `q-${String(melhor + 1).padStart(2, '0')}.png`);
  if (!fs.existsSync(escolhido)) throw new Error('O quadro escolhido para o retrato não foi gravado.');

  // Quanto mais a imagem precisa crescer, mais ruído de compressão aparece —
  // o filtro de ruído acompanha. O lanczos amplia, e o unsharp devolve a
  // definição que toda ampliação tira.
  const ampliacao = LADO_DO_RETRATO / q.width;
  const ruido = ampliacao > 5 ? '3:3:0:0' : ampliacao > 2.5 ? '2:2:0:0' : '1:1:0:0';
  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-i', escolhido,
    '-vf', `hqdn3d=${ruido},scale=${LADO_DO_RETRATO}:${LADO_DO_RETRATO}:flags=lanczos,unsharp=5:5:0.7:5:5:0`,
    '-update', '1', saida,
  ], { timeout: 60 * 1000 });
  if (!fs.existsSync(saida)) throw new Error('Não consegui gravar o retrato.');

  return {
    fonte: fonte === original ? 'original' : 'mp4',
    resolucao: `${dims.width}x${dims.height}`,
    ladoReal: q.width,
    ampliacao: Number(ampliacao.toFixed(2)),
    quadrosLidos: total,
    quadroEscolhido: melhor,
  };
}
