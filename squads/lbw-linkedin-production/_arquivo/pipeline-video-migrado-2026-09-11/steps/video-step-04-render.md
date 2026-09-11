---
execution: inline
agent: video-editor
outputFile: squads/lbw-content-marketing/output/render-report.md
model_tier: powerful
---
# Etapa 4: Renderização

## Instruções

1. Localize `video-config.json` e `captions.ass` mais recentes na pasta desta execução.
2. Execute `automation/render-reel.ps1 -ConfigPath <caminho-do-config>`.
3. Confirme que foram gerados o MP4, `qc-inicio.jpg`, `qc-meio.jpg`, `qc-fim.jpg` e `ffprobe.json`.
4. Registre no relatório os caminhos completos, duração, resolução, codecs, fps e áudio.
5. Não declare aprovação visual nesta etapa.

## Veto Conditions

1. Algum artefato obrigatório não foi criado.
2. O MP4 não tem áudio.
3. A resolução não é 1080 x 1920.
