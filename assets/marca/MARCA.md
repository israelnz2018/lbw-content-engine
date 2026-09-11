# Marca LBW — fonte única

Este é o **único lugar** onde as regras visuais da LBW ficam definidas.
Se a marca mudar, muda aqui. Nenhum squad deve guardar paleta própria.

## Logo

`assets/marca/logo-lbw-branca.png` — ícone oficial (gráfico ascendente no círculo),
branco, com fundo transparente, 512x512.

Origem: extraído do favicon da plataforma e convertido para branco, para funcionar
sobre o azul-marinho do cabeçalho.

- Usar **uma única vez por peça**, no topo.
- Ao lado, sempre `EDUCAÇÃO PELO TRABALHO`.
- Nunca deformar. O ícone é quadrado — escalar 1:1.

## Paleta

| Uso | Cor | Hex |
|---|---|---|
| Fundo escuro, barras, títulos | Azul-marinho | `#0A2A5E` |
| Palavra-chave, chips, ícones, destaque | Azul vivo | `#1B4FD8` |
| Cartões e áreas de respiro | Branco | `#FFFFFF` |
| Fundo claro da página | Cinza-azulado claro | `#EEF3FA` |
| Bordas e divisores | Cinza claro | `#DCE6F2` |
| Texto de apoio | Azul acinzentado | `#3A5B80` |
| Acento pontual (opcional) | Amarelo | `#F2C94C` |

**Regras de cor:**

- A base é **azul-marinho + azul vivo + branco**.
- Amarelo é acento pontual: no máximo um elemento por peça, e pode ser omitido.
- Em cada título, destacar **uma ou duas palavras** em azul vivo. Nunca o título inteiro.

## Tipografia

- Títulos em caixa alta, negrito, itálico, grandes.
- Corpo em negrito médio, alto contraste.
- Nunca texto fino ou cinza claro sobre fundo claro.

## Pessoas

Elenco fictício compartilhado em `assets/pessoas/`. Ver `CATALOGO.md`.
Nunca representar pessoa real sem autorização.

## Proibições de marca

- Não prometer emprego, renda, salário ou resultado garantido.
- Não inventar estatística, resultado, cliente ou depoimento.
- Não copiar texto, marca, logo ou arte de terceiros. Referência externa serve como
  linguagem de composição, nunca como material a reproduzir.

## Onde isto é consumido

| Squad | Consome |
|---|---|
| `lbw-carousel-production` | logo e pessoas por caminho compartilhado; paleta no prompt-mestre |
| `lbw-reel-production` | mantém cópia local da logo em `automation/assets/` — **atualizar junto** |
| `lbw-linkedin-production` | tom e proibições |

**Pendência conhecida:** o squad de Reel ainda tem cópia própria da logo, porque o
caminho dela vem do JSON de configuração de cada execução. Enquanto isso não for
unificado, uma troca de marca exige atualizar os dois lugares.
