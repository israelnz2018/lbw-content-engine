---
execution: inline
agent: visual-reviewer
outputFile: squads/lbw-content-marketing/output/visual-review.md
model_tier: powerful
on_reject: video-step-03-layout-assets
max_review_cycles: 3
---
# Etapa 5: Revisão visual e técnica

## Instruções

1. Abra e observe `qc-inicio.jpg`, `qc-meio.jpg` e `qc-fim.jpg`.
2. Compare com o primeiro Reel aprovado em `output/2026-09-11-video-white-belt-01`.
3. Aplique todos os itens de `automation/review-checklist.md`.
4. Verifique especialmente: logo oficial, nome completo, título, proporção da apresentação, ausência do rosto duplicado, remendos visíveis, recorte inferior, caracteres, legenda branca e karaokê amarelo.
5. Leia `ffprobe.json` e valide os requisitos técnicos.
6. Emita `PASS` somente quando não existir nenhuma correção pendente.
7. Se emitir `REJECT`, liste coordenadas e correções objetivas. O pipeline deve voltar ao layout e renderizar novamente.

## Veto Conditions

1. A revisão foi feita sem abrir os três quadros.
2. Algum item do checklist ficou sem resposta.
3. O status é PASS apesar de existir problema visual ou técnico.
