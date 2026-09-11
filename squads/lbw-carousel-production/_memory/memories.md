# Squad Memory: LBW Carousel Production

## Estilo de Escrita

- Português brasileiro claro, direto e educativo.

## Design Visual

- Logo oficial uma única vez no topo, com `EDUCAÇÃO PELO TRABALHO` ao lado.
- Usar azul-marinho, azul vivo, amarelo, branco e cinza claro.
- Letras grandes, imagens grandes e pouco espaço vazio.
- Pessoas fictícias preferencialmente da cintura para cima.
- Pessoas devem aparecer grandes nos carrosséis normais e em vídeo, ocupando cerca de 40% a 50% da largura e evitando áreas vazias sem função.
- Telas de passos ou camadas devem preencher o centro com três blocos quando possível; dois cartões não podem ficar separados por um grande espaço vazio.

## Estrutura de Conteúdo

- De 6 a 8 páginas e uma ideia principal por página.
- CTA final deve incentivar comentário específico.
- Criar PNGs para Instagram e PDF para LinkedIn.
- Nomear pastas de campanha como `AAAA-MM-DD__Tipo - NN-tema`, usando `Videos` ou `Reels`, número com dois dígitos e tema separado por hífens.

## Proibições Explícitas

- Não alterar componentes originais do Opensquad ou outros squads.
- Não inventar dados, histórias, clientes ou resultados.
- Não entregar arquivos técnicos na pasta final.

## Técnico (específico do squad)

- Renderizar em 1080 x 1350 para o Feed e 1080 x 1920 para o Reel.
- Manter cada tela dos Reels de carrossel visível por 5 segundos; 3,5 segundos foi considerado rápido demais.
- Entregar em `entregas/<produto>/<data>__<tema>/`, na raiz do projeto.
  Produtos: `Feed` (PNGs), `Reels` (MP4), `LinkedIn` (PDF).
- **A identidade fica na pasta, não no arquivo.** Dentro da pasta da campanha os nomes
  são simples: `slide-01.png`, `reel.mp4`, `documento.pdf`, `legenda.md`.
  Não repetir data e tema em cada arquivo — a pasta já diz.
- A `legenda.md` acompanha **toda** pasta que receber peça da campanha.

## Não regenerar

- `automation/render-carousel.mjs` e `pipeline/data/prompt-mestre-carrossel.md` foram
  reescritos à mão em 2026-09-11. **O Arquiteto não deve regenerá-los** — isso apagaria
  os 5 tipos de slide, o modo vídeo 9:16 e a integração com a biblioteca de pessoas.
- Logo e paleta vêm de `assets/marca/`. Pessoas vêm de `assets/pessoas/`.
  Não copiar esses arquivos para dentro do squad.
