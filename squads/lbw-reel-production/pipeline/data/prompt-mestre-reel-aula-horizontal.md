# Prompt mestre para Reels de aulas horizontais da LBW

## Objetivo

Transformar uma aula horizontal em um Reel vertical claro, útil e visualmente consistente, com foco em atrair novos seguidores interessados em melhoria de processos e melhoria contínua.

## Conteúdo

- Escolher um trecho ainda não usado.
- Manter a fala literal.
- Começar na primeira palavra de uma ideia completa.
- Terminar somente depois da última palavra completa.
- Não deixar entrar o começo da frase seguinte.
- Usar de 25 a 45 segundos.

## Sincronismo obrigatório

- Usar tempos palavra por palavra de JSON3, VTT ou alinhamento local equivalente.
- É proibido distribuir a duração igualmente entre as palavras.
- A palavra ainda não falada permanece branca.
- A palavra falada muda para amarelo.
- Conferir início, meio e fim contra a fonte temporizada.
- Manter pelo menos 100 ms depois do final da última palavra.

## Visual

- Formato 1080 x 1920, proporção 9:16, 30 fps.
- Logo oficial uma única vez no topo.
- Ao lado da logo, escrever somente `EDUCAÇÃO PELO TRABALHO`.
- Título grande, em no máximo duas linhas.
- Apresentação original em 16:9 na parte superior.
- Israel centralizado, da cintura para cima, na parte inferior.
- Sem rodapé de marca na parte inferior.
- Cobrir somente o professor e a marca duplicados da apresentação.
- Legendas sem painel azul, com texto branco, palavra ativa amarela e contorno azul-marinho.

## Arquivos finais

- Salvar somente o MP4 e sua transcrição na pasta indicada por `pipeline/data/settings.json`.
- Numerar automaticamente: `01`, `02`, `03`, `04` e assim por diante.
- Os arquivos técnicos permanecem na pasta interna da execução e não são apresentados ao usuário.
- A legenda deve ser limitada à última palavra editorial definida no plano. Nunca incluir palavras do evento seguinte apenas porque pertencem ao mesmo bloco JSON3.
- O último áudio também deve terminar em pontuação final ou em uma pausa claramente concluída. É proibido encerrar após vírgula, conjunção ou frase interrompida.
- Quando o JSON3 trouxer apenas duração por bloco, usar a distribuição temporal interna do bloco como fallback documentado e conferir visualmente o início, meio e fim do Reel.

## Vocabulário técnico obrigatório

- Antes de gerar a legenda, aplicar `pipeline/data/technical-terms.json`.
- Usar sempre `LEAN SIX SIGMA`, `WHITE BELT`, `YELLOW BELT`, `GREEN BELT`, `BLACK BELT`, `ASQ`, `COUNCIL` e `DMAIC`.
- Corrigir variações do reconhecimento automático somente na legenda, sem alterar o áudio original.

## Capa dedicada

- Gerar `capa.jpg` como arte própria, nunca como quadro completo do vídeo.
- Usar gancho de 3 a 6 palavras, rosto grande e identificação do curso e episódio.
- Manter logo, curso, episódio, gancho e rosto entre x=55 e 1025 e y=250 e 1660; gancho e rosto também devem funcionar no recorte central y=420 a 1500.
- Para White Belt, usar fundo branco, azul LBW e amarelo apenas como destaque.
- Seguir integralmente `pipeline/data/cover-standard.md`.
