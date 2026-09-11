---
execution: inline
agent: video-editor
outputFile:
  - _producao/lbw-reel-production/video/video-config.json
  - _producao/lbw-reel-production/video/captions.ass
  - _producao/lbw-reel-production/video/transcript.md
model_tier: powerful
---
# Etapa 3: layout, marca e legendas sincronizadas

## Instruções

1. Leia a análise da fonte, o plano editorial, o prompt mestre, as configurações e o checklist.
2. Gere `captions.ass` com `automation/New-KaraokeCaptions.ps1`, usando JSON3 ou outra fonte com tempos reais palavra por palavra.
3. Confirme que a primeira e a última palavra geradas são as mesmas definidas no plano.
4. É proibido estimar tempos pela quantidade de palavras ou distribuir a duração igualmente.
5. Use a logo oficial em `automation/assets/logo-oficial-lw.png`, uma única vez no topo.
6. Preserve a apresentação em 16:9. Para fonte 1280 x 720, comece com 1000 x 562 e valide em quadros reais.
7. Cubra somente a área duplicada do professor e reconstrua faixas atravessadas.
8. Recorte Israel da cintura para cima, sem deformação, excluindo a marca azul inferior da fonte.
9. Gere `video-config.json` com `finalOutputDirectory`, `firstWordStart`, `lastWordEnd`, `nextWordStart`, `minimumTailMs: 100`, caminhos finais do MP4 e da transcrição.
10. Inclua `cover.mode: dedicated`, `courseKey`, série, episódio, gancho de 3 a 6 palavras e o tempo do retrato.
11. Para White Belt, use fundo branco, azul LBW e amarelo apenas como destaque. Mantenha tudo que importa entre x=55 e 1025 e y=250 e 1660; gancho e rosto também devem funcionar no recorte central y=420 a 1500.
12. Gere a transcrição final literal com o mesmo nome-base do MP4.

## Veto Conditions

1. Primeira ou última palavra diverge do plano.
2. Legenda não foi criada com tempos palavra por palavra.
3. O fim pode cortar a última palavra ou alcançar a frase seguinte.
4. Logo não oficial, professor duplicado, rodapé de marca ou apresentação deformada.
5. MP4 e transcrição não apontam para a pasta final configurada.
6. Capa configurada como quadro extraído, sem curso, sem episódio ou sem gancho curto.
