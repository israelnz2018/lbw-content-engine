---
execution: inline
agent: video-editor
outputFile:
  - squads/lbw-content-marketing/output/video/video-config.json
  - squads/lbw-content-marketing/output/video/captions.ass
model_tier: powerful
---
# Etapa 3: Layout, marca e legendas

## Instruções

1. Leia a análise da fonte, o plano editorial, o prompt mestre e `automation/review-checklist.md`.
2. Use a logo oficial extraída dos materiais da LBW. Não desenhe uma marca substituta.
3. Preserve a apresentação em 16:9. Para fonte 1280 x 720, comece com 1000 x 562, mas valide o quadro.
4. Calcule a posição do rosto duplicado depois da escala. Cubra somente essa área, usando a cor real do fundo, e reconstrua faixas do slide que forem atravessadas.
5. Recorte o professor da cintura para cima, sem deformação, e mantenha-o dentro da área segura.
6. Coloque o nome completo da marca no topo e no rodapé, com o rodapé acima da área de controles.
7. Gere `captions.ass` em UTF-8: texto branco, palavra ativa amarela, contorno azul-marinho e sem painel de fundo.
8. Gere `video-config.json` compatível com `automation/render-reel.ps1`.

## Veto Conditions

1. A logo não é a oficial.
2. O bloco de correção é visivelmente maior que o rosto duplicado.
3. O rodapé está abaixo de y=1650.
4. A apresentação perdeu a proporção 16:9.
5. Há caracteres quebrados.
