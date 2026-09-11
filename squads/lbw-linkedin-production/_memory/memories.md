# Squad Memory: LBW LinkedIn Production

## Formato de vídeo aprovado em 2026-09-11

- Para transformar aulas horizontais em Reels, aproveitar a apresentação original na parte superior e colocar o rosto de Israel ampliado, centralizado e da cintura para cima na parte inferior.

## Direção visual aprovada em 2026-09-11

- Usar como referência estrutural o criativo enviado pelo Israel: fundo branco, azul-marinho e azul vivo, contraste alto, blocos bem delimitados e aparência de infográfico.
- Preencher melhor a área útil. Evitar grandes espaços vazios.
- Usar títulos muito grandes e curtos, com as palavras principais destacadas em azul vivo.
- Manter “LBW - Educação pelo Trabalho” visível no topo de todos os slides.
- Incluir em cada slide uma imagem principal forte relacionada ao assunto. Sempre que combinar com a mensagem, usar personagens fictícios mostrados da cintura para cima, com expressão e gesto coerentes com a situação.
- Os personagens devem representar profissionais reais e variados, sem parecer banco de imagens genérico. Não representar pessoas reais sem autorização.
- Combinar pessoas, ícones, diagramas simples, cartões e setas para explicar a ideia visualmente.
- O carrossel deve parecer rico em informação, mas continuar legível na tela do celular.
- Preservar a identidade LBW. Usar a referência como linguagem de composição, sem copiar texto, marca ou desenho de terceiros.
- Formato principal do Feed: 1080 x 1350 px.

## Estilo de Escrita

- Português brasileiro claro, direto e educativo.

## Design Visual

- Sempre incluir “LBW - Educação pelo Trabalho” no topo.
- Usar as cores da empresa, letras grandes e imagens relacionadas ao assunto.

## Estrutura de Conteúdo

- Cada tema do Instagram deve gerar carrossel para o Feed e Reel em vídeo.
- O CTA deve provocar comentários sobre a experiência da pessoa no trabalho.
- O foco principal é conquistar novos seguidores interessados em melhoria de processos.

## Proibições Explícitas

- Não usar imagens aleatórias ou inventar trechos de vídeos.
- Usar vídeos reais somente quando os arquivos estiverem disponíveis.
- Não colocar Lean Six Sigma acima da melhoria de processos.

## Técnico (específico do squad)

- Quando solicitado, executar sem checkpoints até a publicação.
- Salvar todos os arquivos com a data no nome.

## Correção validada no vídeo 02 em 2026-09-11

- O vídeo deve usar fundo claro limpo na área do título, sem gradiente ou desfoque roxo/azul.
- O topo deve usar a logo oficial L&W encontrada nos materiais da LBW, acompanhada do nome completo `LBW - Educação pelo Trabalho`.
- A imagem duplicada do professor no lado direito da apresentação deve ser coberta por completo.
- As legendas devem ser brancas, com apenas a palavra falada em amarelo, sem painel de fundo.
- Reduzir e reposicionar o recorte inferior quando necessário para não cortar o professor nem elementos do enquadramento.
- Sempre extrair e observar quadros do início, meio e final antes de chamar o arquivo de final.
- O primeiro Reel aprovado em `output/2026-09-11-video-white-belt-01` é a referência de proporção, hierarquia e ocupação do quadro.
- Para aulas em 1280 x 720, preservar a apresentação em 16:9; 1000 x 562 é o ponto inicial correto, nunca 1000 x 750 com preenchimento artificial.
- O rodapé deve ficar acima de y=1650 para permanecer legível mesmo com controles sobrepostos.

## Linguagem visual do LinkedIn

Deliberadamente **diferente do Instagram**. O LinkedIn é o canal do melhor cliente e
pede sobriedade, não gancho de rolagem.

- Fundo **claro**, texto azul-marinho, azul vivo só no destaque. Nada de fundo escuro.
- Título grande mas **sem caixa alta gritada nem itálico**.
- Muito respiro. Pouco texto na arte — o argumento vai no post, não na imagem.
- Pessoa opcional, à direita, da biblioteca compartilhada.

## Técnico (específico do squad)

- `automation/render-linkedin.mjs` gera a imagem do post.
  Formatos: `paisagem` 1200x627 (padrão) e `quadrado` 1080x1080.
- Entrega em `entregas/LinkedIn/<data>__<tema>/` — `imagem.png` e `post.md`.
  É a mesma pasta onde o squad de carrossel deposita o `documento.pdf`.
- Imagem única e documento PDF servem ao **mesmo propósito**: o visual de um post.
  Escolher um por publicação, nunca os dois.
- A identidade fica na pasta, não no arquivo.

## Não regenerar

- `automation/render-linkedin.mjs` foi escrito à mão em 2026-09-11.
