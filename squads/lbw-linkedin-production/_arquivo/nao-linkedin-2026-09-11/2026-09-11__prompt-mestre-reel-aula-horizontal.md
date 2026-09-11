# Prompt mestre: transformar aula horizontal da LBW em Reel

Use este prompt para transformar vídeos de cursos da LBW, gravados em formato horizontal com apresentação e rosto do professor no canto, em Reels verticais prontos para revisão ou publicação.

## Variáveis de entrada

Preencha antes de executar:

- `VIDEO_ORIGINAL`: caminho absoluto do vídeo.
- `TRANSCRICAO`: caminho da transcrição, quando existir.
- `TEMA`: assunto principal ou `AUTO` para descobrir pelo conteúdo.
- `OBJETIVO`: aumentar seguidores interessados em melhoria de processos.
- `DURACAO_PREFERIDA`: entre 25 e 45 segundos.
- `PUBLICAR`: `NAO` por padrão. Mudar para `SIM` somente quando Israel pedir publicação.
- `DATA`: data da criação no formato `YYYY-MM-DD`.

## Prompt de execução

Você faz parte do squad **LBW Content Marketing**. Transforme o vídeo informado em um Reel vertical, educativo e interessante para pessoas que ainda não seguem a conta. Execute o processo completo sem inventar falas, dados, imagens do vídeo ou experiências.

### 1. Analisar a fonte

1. Verifique duração, resolução, proporção, taxa de quadros, codecs e qualidade do áudio.
2. Leia a transcrição completa. Se não houver transcrição, produza uma antes de escolher o trecho.
3. Observe quadros em diferentes pontos do vídeo. Não escolha um corte apenas pelo texto.
4. Localize como a apresentação e o rosto do professor estão distribuídos na gravação.
5. Remova introduções musicais, cumprimentos longos, pausas, repetições e partes que dependam de muito contexto.

### 2. Escolher o corte

Escolha um trecho contínuo ou uma edição fiel de 25 a 45 segundos que contenha:

- uma situação reconhecível no trabalho;
- uma afirmação, pergunta ou contraste que funcione nos primeiros dois segundos;
- uma explicação completa, sem terminar no meio do raciocínio;
- oportunidade de comentário baseado na experiência de quem assiste.

Priorize melhoria de processos, rotina, desperdício, retrabalho, qualidade, produtividade e desenvolvimento profissional. Lean Six Sigma deve aparecer como apoio, e não como tema obrigatório do gancho.

Não use afirmações numéricas como garantia. Quando o vídeo citar um número geral, apresente-o como reflexão, estimativa ou citação atribuída à fonte correta.

### 3. Criar o gancho

Crie uma frase curta, específica e legível imediatamente. Use no máximo duas linhas.

Exemplo aprovado:

```text
3% DE DEFEITO
VIROU NORMAL?
```

Evite introduções como “Hoje vamos falar sobre” ou “Você sabia?”. O gancho deve entrar diretamente no problema.

### 4. Montar o layout vertical

Produza em `1080 x 1920 px`, proporção `9:16`.

Use esta estrutura:

1. Faixa superior azul-marinho com `LBW - EDUCAÇÃO PELO TRABALHO`.
2. Gancho grande logo abaixo da marca.
3. Apresentação original do vídeo ocupando a parte superior da área de conteúdo.
4. Rosto do professor recortado do vídeo, ampliado e centralizado na parte inferior.
5. Legendas sobre a camisa ou imediatamente abaixo do rosto, dentro da área segura.
6. Deixe a parte mais baixa da tela livre para os controles e a descrição do Instagram.

Paleta principal:

- azul-marinho: `#062B61`;
- azul vivo: `#0757FF`;
- amarelo de destaque: `#F4C430`;
- fundo claro: `#F3F7FC`;
- branco: `#FFFFFF`.

Use fonte sem serifa em negrito. O título precisa ser entendido em uma tela pequena.

### 5. Aproveitar a apresentação e o rosto

Use as imagens reais do vídeo na parte superior. Preserve o slide completo sempre que ele continuar legível.

Se o rosto já estiver sobreposto no canto da apresentação:

1. Separe o vídeo em duas cópias.
2. Use uma cópia para a apresentação.
3. Cubra a imagem duplicada do rosto na apresentação com elementos que acompanhem o fundo e as cores do slide.
4. Na segunda cópia, recorte o rosto e parte do tronco.
5. Amplie com interpolação de boa qualidade, sem exagerar a ponto de deixar o rosto borrado.
6. Centralize o professor na metade inferior.

Para vídeos com o mesmo layout do White Belt Parte 1, estes valores servem como ponto inicial:

- fonte: `1280 x 720`;
- apresentação no Reel: `1000 x 562`, posição aproximada `x=40, y=310`;
- rosto: recorte inicial aproximado `290 x 290`, em `x=990, y=390`;
- rosto ampliado: aproximadamente `680 x 680`, posição `x=200, y=965`.

Não aplique essas coordenadas cegamente. Extraia quadros de teste e ajuste para cada vídeo.

### 6. Criar as legendas

- Transcreva somente o que é realmente falado.
- Corrija erros claros de reconhecimento, mas não reescreva a fala como se o professor tivesse dito outra coisa.
- Use no máximo duas linhas por bloco.
- Destaque em amarelo apenas a expressão principal.
- Mantenha as legendas longe da boca e dos controles do Instagram.
- Para este layout, use como referência uma caixa entre `y=1370` e `y=1640`.
- Não deixe informações essenciais próximas das bordas direita ou inferior.

### 7. Regra de legenda aprovada

- Quando o áudio estiver claro, usar legenda estilo karaokê: texto em azul-marinho e a palavra falada mudando para amarelo no momento correspondente.
- Não usar um painel azul opaco grande atrás das legendas. Preferir texto sem fundo, com contorno ou sombra suficiente para manter a leitura.
- A legenda deve começar branca e mudar para amarelo conforme cada palavra é falada. Palavras futuras não podem aparecer amarelas antes da hora.
- A marca no topo deve conter um elemento visual LBW e o texto "LBW - Educação pelo Trabalho". Não substituir a marca por um texto cinza discreto.
- Antes da versão final, conferir visualmente se nenhum pedaço do rosto, do slide, da legenda ou da marca foi cortado.
- Usar o arquivo de logo oficial disponível nos materiais da LBW. Não recriar a marca com um retângulo amarelo e texto quando a logo oficial estiver disponível.
- Para apagar uma imagem duplicada do professor no slide, cobrir somente a área calculada a partir de um quadro da fonte. A correção deve acompanhar a cor do fundo do slide e não pode virar um grande bloco branco.
- Conferir o rodapé em um quadro final: o texto "LBW - Educação pelo Trabalho" deve aparecer completo, dentro da área segura e sem ser coberto pelos controles da plataforma.
- Conferir também a codificação dos textos renderizados: nunca entregar caracteres quebrados como "Ã‡" ou "Ãƒ". Se necessário, usar uma fonte UTF-8 ou uma grafia ASCII provisória até corrigir a codificação.

### 8. Tratar o áudio

Preserve a voz original. Remova apenas ruídos ou diferenças de volume quando necessário.

Padronize aproximadamente em:

- loudness integrado: `-16 LUFS`;
- pico verdadeiro máximo: `-1.5 dBTP`;
- codec: `AAC`;
- frequência: `48 kHz`;
- bitrate: `128 kbps`;
- dois canais.

Não acrescente música protegida por direitos autorais. Se houver música, use somente áudio autorizado para conta comercial e mantenha a voz claramente audível.

### 8. Exportar

Exporte o vídeo com:

- contêiner `MP4`;
- codec de vídeo `H.264`;
- formato de pixels `yuv420p`;
- resolução `1080 x 1920`;
- `30 fps`, salvo se houver motivo técnico para manter outra taxa entre 23 e 60 fps;
- áudio `AAC`, `48 kHz`, `128 kbps`;
- `faststart` habilitado;
- duração preferencial entre 25 e 45 segundos.

Use a data no nome:

```text
YYYY-MM-DD__tema__instagram-reel.mp4
YYYY-MM-DD__tema__capa.jpg
```

### 9. Organizar os arquivos

Crie esta estrutura:

```text
output/YYYY-MM-DD-tema/
  FINAL/
    YYYY-MM-DD__tema__instagram-reel.mp4
    YYYY-MM-DD__tema__capa.jpg
  _tecnico/
    filtros, scripts, quadros de inspeção e arquivos temporários
```

Ao entregar o resultado ao Israel, mostre primeiro apenas o link do MP4 em `FINAL`. Explique em uma frase que os demais arquivos são técnicos.

### 10. Fazer a revisão obrigatória

Antes de entregar:

1. Extraia e observe quadros no início, meio e final do Reel.
2. Confirme que nenhum título ou legenda está cortado.
3. Confirme que o rosto está nítido, centralizado e não duplicado na apresentação.
4. Confirme que as legendas não cobrem a boca.
5. Confirme que o layout não muda de posição nos últimos segundos.
6. Confira o arquivo final com `ffprobe`.
7. Valide resolução, duração, codecs, taxa de quadros, frequência e bitrate do áudio.
8. Abra o MP4 no reprodutor do Windows quando Israel pedir para assistir.

Se encontrar qualquer problema visual ou técnico, corrija e renderize novamente antes de apresentar o arquivo.

### 10.1. Gate visual obrigatório

O render técnico não equivale à aprovação visual. Antes da entrega:

1. Abra de verdade os quadros do início, meio e fim.
2. Compare a composição com o primeiro Reel aprovado em `output/2026-09-11-video-white-belt-01`.
3. Para fonte 1280 x 720, preserve 16:9. Use 1000 x 562 como ponto inicial; não use 1000 x 750 com preenchimento branco.
4. Use a logo oficial L&W extraída dos materiais da LBW. Não desenhe uma marca substituta.
5. Calcule a caixa que remove o professor duplicado depois da escala. A caixa deve cobrir somente o círculo original e usar a cor real do slide.
6. Se a caixa atravessar a faixa inferior do slide, reconstrua a faixa depois da cobertura.
7. Mantenha o rodapé completo acima de `y=1650`.
8. Posicione a legenda sobre a parte inferior do tronco, sem cobrir a boca nem o rodapé.
9. Rejeite caracteres quebrados como `Ã`, `Â` ou `�`.
10. Qualquer falha gera novo render e nova revisão completa, com no máximo três ciclos automáticos.

### 11. Preparar o texto e a estratégia

Crie uma legenda curta, sem endereço web e sem oferta comercial. Termine com uma pergunta concreta que incentive comentários.

Não publique o mesmo vídeo como dois posts separados. Quando `PUBLICAR=SIM`, publique como Reel com `share_to_feed=true`, para que a mesma publicação apareça no Feed e na aba Reels.

Depois de aproximadamente 48 horas, pode ser criado um carrossel complementar. O carrossel deve aprofundar o tema e não repetir o vídeo ou a legenda.

### 12. Condição de publicação

- Se `PUBLICAR=NAO`, apenas produza, revise e entregue o MP4.
- Se `PUBLICAR=SIM`, verifique primeiro as restrições da conta e a autorização dada por Israel naquele pedido.
- Nunca tente contornar restrições do Instagram.
- Depois da publicação, salve o endereço real do post e acompanhe alcance de não seguidores, tempo médio assistido, compartilhamentos, comentários, visitas ao perfil e novos seguidores.
