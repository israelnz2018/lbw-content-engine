# Squad Memory: LBW Reel Production

## Estilo de Escrita

- Português brasileiro claro, direto e educativo.

## Design Visual

- As capas dos Reels devem ser artes dedicadas em 1080 x 1920, nunca quadros completos extraídos do vídeo.
- Manter logo, curso, episódio, gancho e rosto dentro da área segura x=55 a 1025 e y=250 a 1660; gancho e rosto também devem funcionar no recorte central y=420 a 1500.
- Não comprimir a composição no centro nem usar faixas azuis altas no topo e no rodapé. White Belt deve parecer predominantemente branco, com conteúdo grande.
- Usar gancho de 3 a 6 palavras, rosto grande e identificação no formato `WHITE BELT 01`.
- White Belt usa fundo branco. Yellow Belt será amarelo, Green Belt será verde e Black Belt será preto.
- Usar a logo oficial uma única vez no topo.
- Escrever ao lado somente `EDUCAÇÃO PELO TRABALHO`.
- Usar apresentação em cima e Israel centralizado da cintura para cima embaixo.
- Legenda branca com palavra falada em amarelo, sem painel azul.
- Não colocar rodapé da LBW na parte inferior.

## Estrutura de Conteúdo

- Criar Reels de 25 a 45 segundos com raciocínio completo.
- Priorizar melhoria de processos e melhoria contínua para conquistar novos seguidores.
- Numerar os Reels em ordem e acompanhar cada MP4 com sua transcrição.
- Entregar em `ENTREGAS/REELS/AAAA-MM-DD__Videos WB - NN-tema/`, na raiz do projeto — mesma área do
  vídeo gerado a partir de carrossel. A raiz vem do `finalOutputDirectory` no
  `settings.json`; o script valida que a saída fica dentro dela.
- **A identidade fica na pasta, não no arquivo.** Dentro da pasta da campanha:
  `reel.mp4` e a transcrição. Não repetir data e tema em cada arquivo.
- Para carrosséis em vídeo, usar `AAAA-MM-DD__Reels - NN-tema`; para vídeos com o professor, usar `AAAA-MM-DD__Videos - NN-tema`.

## Proibições Explícitas

- Não alterar componentes originais do Opensquad.
- Não entregar arquivos técnicos ao usuário junto dos Reels.
- Não estimar tempos de legenda quando houver fonte palavra por palavra.
- Não cortar palavra no início ou no fim.
- Não deixar a frase seguinte entrar no final.
- Não duplicar professor, logo ou marca.

## Técnico (específico do squad)

- Usar JSON3 do YouTube como primeira opção de sincronismo palavra por palavra.
- Exigir tolerância máxima de 100 ms no início.
- Exigir pelo menos 100 ms depois da última palavra completa.
- Renderizar em H.264, 1080 x 1920, 30 fps, com áudio AAC.

## Defeitos já corrigidos — não reintroduzir

**Primeiro quadro pelado (2026-09-11).** O filtro `color` cria o fundo a partir do tempo
zero, mas a fonte entra com `-ss` antes do `-i` e só entrega o primeiro quadro alguns
milissegundos depois. Sem `setpts=PTS-STARTPTS` nas duas ramificações do `[0:v]`, o
`overlay` fica sem nada para sobrepor e o quadro zero sai com o fundo pelado — só o
retângulo cinza e a barra azul, sem slide e sem professor. Como o Reel roda em laço no
Instagram, esse quadro pisca a cada volta. Conferir extraindo `t=0`: se o PNG ficar ~4x
menor que os seguintes, o defeito voltou.

**Capa automática inadequada (2026-09-11).** Um quadro do Reel virou miniatura no Instagram
e mostrou uma composição ruim. A correção definitiva é gerar uma arte própria. Somente o
retrato vem do primeiro terço, com rosto visível e olhos abertos. A capa usa gancho curto,
curso, episódio e área segura central.

**Falso alarme registrado para não se repetir:** o `freezedetect` do ffmpeg dá falso
positivo neste formato. O slide ocupa ~91% da tela e é estático; o professor fica numa
bolha de ~9%. O movimento dele é diluído na média do quadro e reportado como
congelamento. Não usar esse filtro para julgar estes vídeos.

## Não regenerar

- `automation/render-reel.ps1` foi ajustado à mão em 2026-09-11 e 2026-09-12: escala da logo
  (`scale=60:60`, marca em `x=120`), `setpts=PTS-STARTPTS` nas ramificações do vídeo,
  geração de capa dedicada e cópia da `capa.jpg` para a pasta de entrega.
  **O Arquiteto não deve regenerá-lo** — isso devolveria a logo deformada, o quadro zero
  pelado e a capa sem validação.
- Logo e pessoas vêm de `assets/marca/` e `assets/pessoas/`, compartilhadas na raiz.
