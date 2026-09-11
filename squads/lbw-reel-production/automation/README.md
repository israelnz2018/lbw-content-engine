# Automação do LBW Reel Production

Comando normal:

`/opensquad run lbw-reel-production`

O squad identifica o próximo número, escolhe um trecho novo, obtém tempos reais das palavras, cria a legenda karaokê, renderiza, gera uma capa dedicada, revisa e salva o MP4, a transcrição e `capa.jpg` na pasta definida em `pipeline/data/settings.json`.

Regras técnicas incorporadas:

- Não estimar tempos quando existir JSON3 ou VTT.
- Iniciar na primeira palavra completa.
- Manter pelo menos 100 ms depois da última palavra completa.
- Cortar antes da primeira palavra da frase seguinte.
- Não sobrescrever Reels existentes.
- Mostrar ao usuário somente o MP4, a transcrição e a capa final.
- Nunca usar um quadro completo do vídeo como capa.
- Gerar a capa em 1080 x 1920 com gancho de 3 a 6 palavras, rosto grande e arte própria do curso.
- Manter logo, curso, episódio, gancho e rosto entre x=55 e 1025 e y=250 e 1660; gancho e rosto também devem funcionar no recorte central y=420 a 1500.
- White Belt usa fundo branco. As demais cores ficam registradas em `pipeline/data/settings.json`.
- Os nomes técnicos da legenda são normalizados por `pipeline/data/technical-terms.json` antes da criação do karaokê.
