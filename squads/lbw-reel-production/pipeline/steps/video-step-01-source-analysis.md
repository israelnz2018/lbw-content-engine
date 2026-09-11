---
execution: inline
agent: video-editor
outputFile: _producao/lbw-reel-production/source-analysis.md
model_tier: powerful
---
# Etapa 1: analisar a fonte e os Reels existentes

## Instruções

1. Leia `pipeline/data/settings.json`.
2. Conte os MP4 numerados na pasta final e defina o próximo número com dois dígitos. Nunca sobrescreva um Reel existente.
3. Leia as transcrições dos Reels existentes para não repetir o mesmo assunto.
4. Use o vídeo informado pelo usuário. Se não houver caminho, procure o MP4 mais recente em Downloads que corresponda à série solicitada.
5. Localize e leia a transcrição completa em `Digital LBW/Base de Conhecimento/Transcripts`.
6. Obtenha resolução, duração, fps, codecs e áudio com `ffprobe`.
7. Extraia e observe quadros do trecho candidato.
8. Se a transcrição informar uma URL do YouTube, baixe apenas a legenda automática em JSON3 usando `automation/Get-TimedCaptions.ps1`. Reutilize o cache quando já existir.
9. Registre o próximo número, fonte, transcrição, URL, legenda temporizada, tema candidato e coordenadas observadas.

## Veto Conditions

1. Próximo número conflita com um arquivo existente.
2. Fonte ou transcrição não foi localizada.
3. O trecho foi escolhido sem observar quadros.
4. Tema repete um dos Reels existentes.
5. Existe fonte temporizada disponível, mas ela não foi obtida.
