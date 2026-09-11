---
execution: inline
agent: visual-reviewer
outputFile: _producao/lbw-reel-production/visual-review.md
model_tier: powerful
on_reject: video-step-03-layout-assets
max_review_cycles: 3
---
# Etapa 5: revisão visual, técnica e de sincronismo

## Instruções

1. Abra e observe `qc-inicio.jpg`, `qc-meio.jpg`, `qc-fim.jpg` e `instagram-cover.jpg`.
2. **Extraia o quadro em `t=0` e confirme que o slide e o professor aparecem.**
   Se saírem só o fundo claro, o retângulo cinza e a barra azul, o primeiro quadro está
   pelado e o `setpts=PTS-STARTPTS` sumiu do `render-reel.ps1`. Esse quadro pisca a cada
   laço do Reel no Instagram. Atalho: o PNG do quadro zero fica ~4x menor que os seguintes.
3. **Confirme que a capa é uma arte dedicada.** Somente o retrato pode vir do primeiro terço do Reel, com rosto visível e olhos abertos.
4. Compare com os Reels aprovados na pasta final.
5. Confira no mínimo três pontos entre a legenda ASS e a fonte temporizada, incluindo início e fim.
6. Confirme que a primeira palavra aparece quando é falada.
7. Confirme que a última palavra é ouvida inteira, possui pelo menos 100 ms de margem e que a frase seguinte não entrou.
8. Verifique logo oficial, nome completo, título, proporção da apresentação, ausência de professor duplicado, recorte inferior, caracteres e legenda branca com karaokê amarelo.
9. Confirme que `instagram-cover.jpg` tem gancho de 3 a 6 palavras, rosto grande, logo, curso e episódio. Tudo que importa deve ficar entre x=55 e 1025 e y=250 e 1660; gancho e rosto também devem funcionar no recorte central y=420 a 1500.
10. Para White Belt, confirme fundo branco com azul LBW e amarelo apenas como destaque.
11. Leia `ffprobe.json` e valide resolução, codecs, fps e áudio.
12. Emita `PASS` somente quando não existir correção pendente.

## Veto Conditions

1. A revisão foi feita sem abrir os três quadros.
2. O sincronismo não foi comparado com a fonte palavra por palavra.
3. A última palavra ou a frase seguinte não foi verificada.
4. O status é `PASS` apesar de existir problema visual, técnico ou de sincronismo.
5. A capa não foi aberta ou contém transição, grande espaço vazio, título cortado ou professor ausente.
6. O status é `PASS` apesar de o quadro em `t=0` sair sem o slide e sem o professor.
7. O status é `PASS` apesar de a capa ser um quadro completo do vídeo, estar fora da área segura ou usar a cor errada do curso.
