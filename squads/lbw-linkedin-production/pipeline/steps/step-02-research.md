---
execution: subagent
agent: researcher
inputFile: _producao/lbw-linkedin-production/strategy.md
outputFile: _producao/lbw-linkedin-production/research.md
model_tier: powerful
---
# Step 02: Pesquisa e Verificação

## Context Loading
- Leia a estratégia, `company.md`, `research-brief.md` e `consolidated-patterns.md`.

## Instructions
1. Pesquise fatos atuais e exemplos necessários para a pauta.
2. Separe fatos, hipóteses, exemplos e ideias criativas.
3. Registre fonte e data para cada afirmação verificável.
4. Indique quais referências não puderam ser acessadas diretamente.

## Output Format
```markdown
# Brief de pesquisa
Fatos verificados:
Fontes:
Exemplos:
Cuidados:
Perguntas em aberto:
```

## Veto Conditions
1. Estatística ou afirmação relevante sem fonte.
2. Padrão atribuído a um perfil sem evidência acessível.

## Quality Criteria
- [ ] Fontes identificadas.
- [ ] Limitações explicitadas.
- [ ] Pesquisa útil para a pauta.
