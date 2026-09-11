# Padrão definitivo de capas dos Reels LBW

## Regra principal

A capa é uma arte própria em 1080 x 1920. Nunca usar um quadro completo do vídeo como capa. Somente o retrato do professor pode ser extraído de um quadro revisado no primeiro terço do Reel.

## Área segura

Todo elemento necessário para reconhecer e entender a capa deve ficar dentro destas coordenadas:

- x: 55 a 1025
- y: 250 a 1660

Isso inclui logo, nome da empresa, curso, episódio, gancho e rosto. O gancho e a parte principal do rosto também devem continuar legíveis no recorte central entre y=420 e y=1500. A área segura protege o conteúdo, mas não deve comprimir toda a composição no centro.

## Estrutura obrigatória

- Logo oficial usada uma única vez.
- Nome `LBW · EDUCAÇÃO PELO TRABALHO` completo.
- Identificação do curso e episódio, por exemplo `WHITE BELT 01`.
- Gancho de 3 a 6 palavras, em letras grandes e no máximo três linhas.
- Rosto grande, com expressão clara e sem deformação.
- Sem parágrafo de slide, legenda de karaokê ou captura da apresentação.
- Sem faixas decorativas altas ou rodapé com frase genérica. O fundo do White Belt deve ocupar quase toda a altura.

## Identidade por curso

| Curso | Fundo dominante | Contraste principal | Destaque |
|---|---|---|---|
| White Belt | Branco `#FFFFFF` | Azul-marinho `#062B61` | Azul `#0757FF` e amarelo `#F4C430` |
| Yellow Belt | Amarelo `#F4C430` | Azul-marinho `#062B61` | Branco e azul `#0757FF` |
| Green Belt | Verde `#178447` | Branco | Amarelo `#F4C430` |
| Black Belt | Preto `#111827` | Branco | Amarelo `#F4C430` e azul `#0757FF` |

Neste momento, o modelo homologado para produção é o White Belt. Os outros estilos estão registrados para desenvolvimento posterior.

As pastas dos vídeos White Belt usam o formato `AAAA-MM-DD__Videos WB - NN-tema`. A identificação do episódio na capa é independente do número histórico da pasta.

## Configuração obrigatória

Cada `video-config.json` deve conter:

```json
"cover": {
  "mode": "dedicated",
  "courseKey": "white-belt",
  "seriesLabel": "WHITE BELT",
  "episode": "01",
  "hookLines": ["GANCHO CURTO", "EM ATÉ 6 PALAVRAS"],
  "portraitTimeSeconds": 2.0
}
```

O script `automation/render-reel.ps1` extrai apenas o retrato e chama `automation/render-reel-cover.mjs`. A arte final é salva como `capa.jpg` junto de `reel.mp4` e `transcript.md`.

A numeração exibida na capa é independente do número histórico da pasta. Antes de criar uma capa, ler `cover-series.json`, usar `nextEpisode` do curso e, após a geração validada, atualizar `lastGeneratedEpisode` e `nextEpisode`. Assim, a nova série White Belt começa em `WHITE BELT 01`, mesmo que o conteúdo de teste esteja na antiga pasta de vídeo 07.

## Revisão obrigatória

Reprovar a capa quando:

- for apenas um quadro do vídeo;
- o gancho exceder 6 palavras;
- o rosto estiver pequeno, ausente, deformado ou com expressão ruim;
- houver informação essencial fora da área segura;
- o curso ou número estiver incorreto;
- a logo estiver duplicada;
- houver muito espaço vazio sem função visual;
- a cor dominante não corresponder ao curso.
