---
execution: inline
agent: reviewer
inputFile: _producao/lbw-linkedin-production/linkedin-post.md
outputFile: _producao/lbw-linkedin-production/review.md
---
# Step 07: Revisão de Qualidade

## Context Loading
- Leia `linkedin-post.md`, a pesquisa, `company.md` e `quality-criteria.md`.

## Instructions
1. Revise a peça contra os critérios.
2. Confirme fontes, público, tom, originalidade, clareza e CTA.
3. Liste ajustes objetivos ou marque APPROVE.

## Output Format
```markdown
# Revisão
## LinkedIn
Status:
Pontos fortes:
Ajustes:
## Recomendação
```

## Veto Conditions
1. Existe promessa sem evidência.
2. A peça está confusa, genérica ou sem CTA.

## Quality Criteria
- [ ] Ajustes objetivos.
- [ ] Veredito APPROVE ou REJECT.
- [ ] Estratégia preservada.
