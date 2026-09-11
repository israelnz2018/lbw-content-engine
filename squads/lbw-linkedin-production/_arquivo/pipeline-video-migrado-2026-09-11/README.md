# Pipeline de vídeo — arquivado em 2026-09-11

Estes arquivos são **sobras da separação** do squad de vídeo. Foram movidos para cá,
não apagados, e podem ser restaurados a qualquer momento.

## Por que saíram

Quando o `lbw-reel-production` foi criado como squad independente, o pipeline de vídeo
foi copiado para lá — mas as cópias antigas ficaram aqui dentro do `lbw-content-marketing`,
sem nada apontando para elas.

- O `squad.yaml` do `lbw-content-marketing` aponta para `pipeline/pipeline.yaml`,
  que lista apenas `step-01` a `step-08`. Nenhum destes arquivos era carregado.
- O `video-reel.pipeline.yaml` era **cópia idêntica** do pipeline do `lbw-reel-production`.
- Os 6 `video-step-*.md` eram versões **antigas e menores**. As versões vivas, já evoluídas,
  estão em `squads/lbw-reel-production/pipeline/steps/`.

## Onde está a versão viva

`squads/lbw-reel-production/` — é o squad de vídeo em produção. **Não foi tocado.**

## O que NÃO foi mexido

- `pipeline/pipeline.yaml` — o pipeline ativo do squad.
- `pipeline/content-original.pipeline.yaml` — backup deliberado, marcado como
  "preservado para uso futuro".
- Os 8 `step-*.md` do pipeline ativo.
