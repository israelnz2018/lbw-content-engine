# Prompt mestre para carrosséis LBW

Crie um carrossel educativo para Instagram e LinkedIn a partir de material real da LBW.
Este documento é a referência definitiva de design e composição deste squad.

---

## 1. Identidade e paleta

Paleta oficial. Não usar cor fora desta lista.

| Uso | Cor | Hex |
|---|---|---|
| Fundo escuro, barras, títulos | Azul-marinho | `#0A2A5E` |
| Palavra-chave, chips, ícones, destaque | Azul vivo | `#1B4FD8` |
| Cartões e áreas de respiro | Branco | `#FFFFFF` |
| Fundo claro da página | Cinza-azulado claro | `#EEF3FA` |
| Bordas e divisores | Cinza claro | `#DCE6F2` |
| Texto de apoio | Azul acinzentado | `#3A5B80` |
| Acento pontual (opcional) | Amarelo | `#F2C94C` |

Regras de cor:

- A base é **azul-marinho + azul vivo + branco**. É essa a cara da LBW.
- Amarelo é acento **pontual**: no máximo um elemento por slide, e pode ser omitido.
- Em cada título, destacar **uma ou duas palavras** em azul vivo. Nunca o título inteiro.
- Cabeçalho: barra azul-marinho com a logo oficial à esquerda e `EDUCAÇÃO PELO TRABALHO` ao lado, uma única vez por slide.

## 2. Tipografia

- Títulos em **caixa alta, negrito, itálico**, bem grandes, ocupando 2 a 3 linhas.
- Corpo em negrito médio, tamanho grande, alto contraste.
- Rótulos de chip e legenda de ícone em caixa alta, pequenos.
- Nunca usar texto fino ou cinza sobre fundo claro.

## 3. Formato e grade

- 1080 x 1350 px, proporção 4:5, em todos os slides.
- Margens laterais generosas, mas **sem áreas vazias grandes**.
- Preencher a área útil: se sobrar espaço, aumentar imagem, cartão ou tipografia.
- Faixa inferior de processo presente em todos os slides (ver seção 6).

## 4. Sistema de slides

Escolher o tipo de página conforme a função. Um carrossel bom mistura tipos.

### Tipo A — Capa com pessoa (obrigatório no slide 1)

- Fundo **escuro** (azul-marinho), com imagem de contexto ao fundo escurecida.
- **Pessoa recortada, da cintura para cima, no lado direito**, grande, ocupando da base até pelo menos 70% da altura útil.
- **Texto grande à esquerda**, empilhado, com uma ou duas palavras em azul vivo.
- Linha divisória fina horizontal separando os blocos de texto.
- Sub-linha curta embaixo à esquerda, com ícone pequeno, no formato de pergunta.
- A expressão e o gesto da pessoa devem combinar com a mensagem do slide.

### Tipo B — Camadas em cartão

- Fundo claro.
- Cartões brancos arredondados empilhados, com borda `#DCE6F2` e sombra suave.
- Usar preferencialmente três cartões no formato em vídeo. Nunca separar dois cartões deixando o centro da tela vazio.
- Cada cartão com um **chip azul** no canto (`CAMADA 1`, `PASSO 1`, `ERRO 1`).
- Dentro do cartão: rótulo grande à esquerda e 2 a 3 ícones com legenda curta à direita.
- Conectores verticais (ponto e linha) ligando os cartões.

### Tipo C — Dado em destaque

- Fundo claro.
- O número ocupa papel de protagonista, enorme, em azul vivo.
- Texto de contexto ao lado ou abaixo, sempre com a fonte citada.
- Ícone ou gráfico simples relacionado ao dado.

### Tipo D — Comparação

- Dois blocos lado a lado ou empilhados.
- Bloco negativo em cinza-azulado, bloco positivo em azul vivo.
- Rótulos curtos em caixa alta, tipo `IMPROVISO` e `MÉTODO`.

### Tipo E — CTA final (obrigatório no último slide)

- Faixa azul-marinho ocupando boa parte do slide.
- Texto em itálico, com a **palavra do comentário destacada em azul vivo**.
- Padrão: `Comente 'PALAVRA' e ...`
- Pode trazer pessoa recortada menor, à direita.

## 5. Pessoas e imagens

**Biblioteca oficial:** `automation/assets/pessoas/recortadas/` — 12 personagens fictícios
com fundo transparente, prontos para composição. O índice com quem é cada um e quando usar
está em `automation/assets/pessoas/CATALOGO.md`. **Consultar o catálogo antes de gerar
qualquer pessoa nova** — o elenco existente cobre a maioria dos casos e tem custo zero.

- Usar pessoas em, no mínimo, o slide 1 e o slide final.
- Sempre **da cintura para cima**, recortadas, com fundo removido.
- Posição padrão: **lado direito**, texto à esquerda.
- A pessoa deve ocupar entre 40% e 50% da largura e preencher a área vertical disponível. Se houver espaço vazio, ampliar o personagem antes de aumentar margens.
- Profissionais variados e realistas. Evitar aparência de banco de imagens genérico.
- Expressão e gesto coerentes com a mensagem: dúvida, frustração, decisão, explicação.
- **Não representar pessoas reais sem autorização.**
- Todo slide precisa de apoio visual: pessoa, ícone, gráfico, cartão ou diagrama. Nenhum slide só de texto.

## 6. Faixa inferior de processo

Faixa fina no rodapé de todos os slides, sobre fundo azul-marinho:

- Sequência de 4 a 6 ícones com rótulo em caixa alta.
- Padrão LBW: `ENTENDER · MAPEAR · ANALISAR · MELHORAR · ENTREGAR VALOR`.
- À direita da faixa, assinatura curta em duas linhas, com a segunda palavra em destaque.
- A faixa é sempre a mesma no carrossel inteiro. Funciona como assinatura da marca.

## 7. Conteúdo

- De 6 a 8 páginas, uma ideia principal por página.
- A capa deve ter um gancho forte e específico, compreensível em dois segundos.
- Cada página avança o raciocínio.
- Máximo de 32 palavras por página.
- Terminar com pergunta concreta que incentive comentário específico.
- Citar a fonte quando usar dado externo.
- Escrever corretamente Lean, Six Sigma, Lean Six Sigma, DMAIC, PDCA, White Belt, Yellow Belt e Green Belt.
- Acentuação e ortografia do português brasileiro sempre corretas.

## 8. Proibições

- Não inventar estatísticas, resultados, clientes ou experiências.
- Não usar promessa de emprego, renda, salário ou resultado garantido.
- Não copiar texto, marca, logo ou arte de terceiros. Referências externas servem apenas como **linguagem de composição**, nunca como material a ser reproduzido.
- Não repetir logo ou rodapé mais de uma vez por slide.
- Não deixar slide sem apoio visual.
- Não deixar grandes espaços vazios.
- Reprovar a tela quando houver uma área vazia contínua maior que aproximadamente 25% da composição sem função visual.
- Não usar cor fora da paleta da seção 1.

## 9. Entrega

- Nomear a pasta da campanha como `AAAA-MM-DD__Tipo - NN-tema`. Exemplos: `2026-09-11__Videos - 01-white-belt-defeitos-viraram-normais` e `2026-09-11__Reels - 07-defeitos-viraram-normais`.
- Usar sempre `Videos` ou `Reels` com a grafia correta, número com dois dígitos e tema em letras minúsculas separado por hífens.
- PNGs numerados para Instagram, 1080 x 1350.
- Um PDF multipágina para LinkedIn, na mesma sequência.
- Arquivo `conteudo.md` com o texto de todas as páginas.
- Todos os nomes começam pela data de criação.
- Arquivos técnicos ficam fora da pasta final.
- No carrossel em vídeo, manter cada tela visível por 5 segundos.
