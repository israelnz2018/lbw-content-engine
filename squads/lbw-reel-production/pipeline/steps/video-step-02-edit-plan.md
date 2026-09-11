---
execution: inline
agent: reels-writer
outputFile: _producao/lbw-reel-production/edit-plan.json
model_tier: powerful
format: instagram-reels
---
# Etapa 2: escolher o corte completo

## Instruções

1. Leia a análise da fonte e a legenda temporizada completa.
2. Escolha um trecho de 25 a 180 segundos com assunto novo e raciocínio completo. A duração deve servir ao assunto; não encurte uma explicação apenas para chegar a 40 segundos.
3. Defina a primeira palavra exata e seu tempo absoluto.
4. Defina a última palavra exata, início e fim estimado pela próxima marca temporal.
5. Defina a primeira palavra da frase seguinte e seu tempo. Prefira um limite de frase com pelo menos 250 ms entre o início da última palavra e o início da próxima palavra.
6. O início do corte deve coincidir com a primeira palavra, admitindo no máximo 100 ms de diferença.
7. O fim deve ficar pelo menos 100 ms depois da última palavra completa e entre 20 e 100 ms antes da próxima frase.
8. Crie título de no máximo duas linhas e nomeie a pasta final como `AAAA-MM-DD__Videos WB - NN-tema`, com número de dois dígitos e tema em letras minúsculas separado por hífens.
9. Crie um gancho de capa com 3 a 6 palavras. Ele deve despertar curiosidade e não repetir um parágrafo do slide.
10. Leia `pipeline/data/cover-series.json` e use `nextEpisode` do curso. A numeração da capa é independente do número histórico da pasta.
11. Configure a capa dedicada com `courseKey`, nome da série, episódio, `hookLines` e `portraitTimeSeconds`. Escolha o retrato no primeiro terço, com rosto visível, olhos abertos e expressão clara.
12. Salve JSON válido contendo: número, fonte, transcrição, timedCaptions, clipStart, firstWordStart, lastWord, lastWordEnd, clipEnd, nextWordStart, bloco `cover`, título, nome-base e transcrição literal.

## Veto Conditions

1. Tempos foram estimados sem usar a fonte palavra por palavra disponível.
2. O corte inicia ou termina no meio de uma frase.
3. Não existe espaço de pelo menos 100 ms depois da última palavra.
4. A frase seguinte entra no corte.
5. Duração fora de 25 a 180 segundos.
6. O gancho da capa excede 6 palavras ou o retrato está vazio, em transição ou sem o rosto do professor.
7. JSON inválido ou fala reescrita.
