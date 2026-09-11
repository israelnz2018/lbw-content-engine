# Critérios de qualidade

O Reel só pode ser entregue quando todos os itens estiverem corretos:

- Tema diferente dos Reels anteriores.
- Fala literal e raciocínio completo.
- Primeira palavra sincronizada com tolerância máxima de 100 ms.
- Legenda calculada palavra por palavra.
- Nomes técnicos normalizados pelo dicionário `technical-terms.json`, sem erros como `LINCIG`, `LINICO`, `SEIS SIGMA`, `WHITEBUILT` ou `COUNCIL` indevido.
- Última palavra audível por completo.
- Pelo menos 100 ms de margem depois da última palavra.
- Nenhuma palavra da frase seguinte no áudio.
- No máximo duas linhas por bloco de legenda.
- Logo oficial uma única vez.
- Nome `EDUCAÇÃO PELO TRABALHO` completo.
- Apresentação em 16:9.
- Sem professor duplicado ou marca inferior parcial.
- MP4 em H.264, 1080 x 1920, 30 fps, com áudio AAC.
- Capa JPG dedicada em 1080 x 1920, com identidade do curso, gancho curto e rosto grande.
- A publicação do Reel deve enviar a capa pelo parâmetro `cover_url`; nunca deixar a escolha automática para o Instagram.
- **Duração alvo de 45 segundos. Pode chegar a até 3 minutos quando for necessário para completar o raciocínio — nunca corte um argumento pela metade só por causa do tempo.**
- **REPROVAR se o primeiro quadro estiver pelado.** Extrair o quadro em `t=0` e confirmar que o slide e o professor aparecem. Se saírem apenas o fundo claro, o retângulo cinza e a barra azul, o `setpts=PTS-STARTPTS` foi removido do `render-reel.ps1`. Sintoma rápido: o PNG do quadro zero fica cerca de 4x menor que os seguintes. Como o Reel roda em laço no Instagram, esse quadro pisca a cada volta.
- **A capa nunca pode ser um quadro completo do Reel.** Somente o retrato pode vir do primeiro terço. A arte deve seguir `cover-standard.md`, manter as informações essenciais na área segura e exibir curso e episódio corretos.
- MP4 e transcrição numerados na pasta final.
