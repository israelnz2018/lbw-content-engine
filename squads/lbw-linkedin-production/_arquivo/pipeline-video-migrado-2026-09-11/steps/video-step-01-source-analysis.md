---
execution: inline
agent: video-editor
outputFile: squads/lbw-content-marketing/output/source-analysis.md
model_tier: powerful
---
# Etapa 1: Análise da fonte

## Instruções

1. Use o vídeo informado pelo usuário. Se nenhum caminho foi informado na execução, localize o MP4 mais recente na pasta Downloads.
2. Localize a transcrição correspondente em `Digital LBW/Base de Conhecimento/Transcripts`.
3. Leia a transcrição completa e obtenha duração, resolução, proporção, fps, codecs e áudio com `ffprobe`.
4. Extraia quadros de vários pontos da fonte, inclusive do trecho candidato.
5. Identifique as coordenadas reais da apresentação, do professor e da marca existente no vídeo.
6. Escolha um trecho de 25 a 45 segundos que comece com uma ideia clara e termine com o raciocínio completo.
7. Registre caminhos absolutos, tempo inicial, duração, transcrição literal do corte e medidas observadas.

## Veto Conditions

1. O corte foi escolhido somente pela transcrição, sem observar quadros.
2. O trecho termina no meio de uma frase.
3. As coordenadas foram copiadas de outro vídeo sem validação.
4. A fonte ou a transcrição não foi identificada.
