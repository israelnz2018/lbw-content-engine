---
name: pessoa-generator
description: >
  Generates fictional professional character images for LBW content and removes
  their background, producing transparent PNGs ready for composition.
  Uses DeepInfra (FLUX) for generation and a local Node cutout — no Python needed.
description_pt-BR: >
  Gera personagens fictícios profissionais para o conteúdo da LBW e remove o fundo,
  entregando PNGs transparentes prontos para composição.
  Usa a DeepInfra (FLUX) para gerar e um recorte local em Node — sem depender de Python.
type: script
version: "1.0.0"
env:
  - DEEPINFRA_API_KEY
categories: [assets, images, ai, generation, brand]
---

# Gerador de Pessoas LBW

## Quando usar

Use quando precisar de uma pessoa para um carrossel, Reel, post de LinkedIn ou capa,
e **o elenco existente não cobrir a expressão necessária**.

**Antes de gerar, consulte sempre `assets/pessoas/CATALOGO.md`.** São 12 personagens
prontos, com fundo transparente e custo zero. A maioria das peças se resolve ali.
Gerar é o último recurso, não o primeiro.

## Custo

Cerca de **US$ 0,011 por imagem** com `black-forest-labs/FLUX-1-dev`.
O recorte é gratuito e roda local.

## Como usar

**1. Gerar a pessoa** (sai com fundo cinza liso de estúdio):

```
node skills/pessoa-generator/scripts/gerar.mjs "<descrição em inglês>" "<arquivo-saida.png>"
```

**2. Recortar o fundo** (gera a versão transparente):

```
node skills/pessoa-generator/scripts/recortar.mjs "<pasta-ou-arquivo>"
```

**3. Registrar no catálogo:** adicione a linha nova em `assets/pessoas/CATALOGO.md`
com quem é a pessoa, a expressão e quando usar. Sem isso, ninguém acha depois.

## Padrão obrigatório do prompt

Para o personagem combinar com o elenco existente, o prompt precisa manter:

- Enquadramento **da cintura para cima**
- **Fundo cinza liso de estúdio** (é o que permite o recorte limpo)
- Luz suave e uniforme, foto realista, textura de pele natural
- **Sem texto, sem logo, sem marca d'água**
- Gesto e expressão **coerentes com a mensagem** da peça

O script já acrescenta essa base — descreva apenas a pessoa, a roupa, o gesto e a emoção.

Exemplo de descrição:

```
A Brazilian woman in her forties, industrial engineer, high visibility safety vest,
white hard hat, pointing decisively with one arm extended, focused expression
```

## Regras

- **Sempre pessoas fictícias.** Nunca representar pessoa real sem autorização.
- Variar idade, gênero e etnia. O elenco precisa parecer gente de verdade,
  não banco de imagens genérico.
- Ambientes coerentes com o público da LBW: escritório e chão de fábrica.
- Gerar **uma imagem por vez** e olhar o resultado. Não gerar lotes de variação.

## Configuração

Requer `DEEPINFRA_API_KEY` no `.env` da raiz do projeto.
O recorte usa `@imgly/background-removal-node`, declarado no `package.json`.

## Onde ficam os arquivos

```
assets/pessoas/
├── CATALOGO.md      ← índice: quem é cada um e quando usar
├── originais/       ← saída bruta, fundo cinza (backup)
└── recortadas/      ← fundo transparente — é o que as peças usam
```
