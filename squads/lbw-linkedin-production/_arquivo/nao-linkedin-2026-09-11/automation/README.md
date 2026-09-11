# Automação de Reels do LBW Content Marketing

## Uso normal

Execute:

```text
/opensquad run lbw-content-marketing
```

Se nenhum vídeo for informado junto ao comando, o squad procura o MP4 mais recente em Downloads e tenta localizar a transcrição correspondente na base de conhecimento.

## O que o squad faz

1. Analisa vídeo e transcrição.
2. Observa quadros da fonte e escolhe um corte completo de 25 a 45 segundos.
3. Cria título e legendas literais.
4. Mede apresentação, professor e elemento duplicado.
5. Usa a logo oficial da LBW.
6. Renderiza o Reel vertical.
7. Gera quadros do início, meio e fim.
8. Faz revisão visual e técnica.
9. Se houver reprovação, corrige e renderiza novamente, até três ciclos.
10. Entrega somente a versão que recebeu `PASS`.

## Limite de automação

A edição e a revisão funcionam automaticamente. A publicação no Instagram continua exigindo autorização explícita. Se a revisora reprovar três ciclos consecutivos pelo mesmo problema, o squad interrompe a execução e explica o bloqueio.

## Renderizador

O script `render-reel.ps1` recebe um arquivo JSON compatível com `reel-input.example.json`. Ele gera:

- MP4 final em `FINAL/`;
- `qc-inicio.jpg`;
- `qc-meio.jpg`;
- `qc-fim.jpg`;
- `ffprobe.json`.
