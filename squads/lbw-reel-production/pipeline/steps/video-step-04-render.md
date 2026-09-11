---
execution: inline
agent: video-editor
outputFile: _producao/lbw-reel-production/render-report.md
model_tier: powerful
---
# Etapa 4: renderizar e validar tecnicamente

## Instruções

1. Execute `automation/render-reel.ps1 -ConfigPath <configuração desta execução>`.
2. O script deve validar início, margem após a última palavra, limite antes da frase seguinte, pasta final, vídeo e áudio.
3. Confirme a criação do MP4 final e da transcrição final na pasta configurada.
4. Confirme a criação temporária de `qc-inicio.jpg`, `qc-meio.jpg`, `qc-fim.jpg`, `cover-portrait.jpg`, `instagram-cover.jpg` e `ffprobe.json` na pasta interna da execução.
5. Confirme que `instagram-cover.jpg` foi produzido por `automation/render-reel-cover.mjs`, e não copiado de um quadro completo.
6. Registre caminhos, duração, resolução, codecs, fps, áudio, margem final, curso da capa e tempo escolhido para o retrato.
7. Depois que a capa passar nas validações, atualize em `pipeline/data/cover-series.json` o `lastGeneratedEpisode` e o `nextEpisode` do curso.

## Veto Conditions

1. MP4 ou transcrição final não existe.
2. Última palavra não possui a margem mínima configurada.
3. A frase seguinte pode entrar no corte.
4. Arquivo sem áudio ou fora de 1080 x 1920.
5. `instagram-cover.jpg` ausente ou fora de 1080 x 1920.
