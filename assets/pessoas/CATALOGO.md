# Elenco LBW — biblioteca de pessoas

Personagens fictícios gerados por IA. Nenhuma pessoa real. Reutilizáveis sem custo.

**Biblioteca compartilhada:** fica em `assets/pessoas/`, na raiz do projeto, e serve
os três squads — carrossel, Reel e LinkedIn. Não duplicar dentro de squad nenhum.

- **Usar sempre a versão recortada** (`recortadas/*-recortada.png`), com fundo transparente.
- Os arquivos em `originais/` têm fundo cinza de estúdio. Servem de backup.
- Posição padrão no slide: **lado direito**, da cintura para cima, texto à esquerda.
- Para criar personagem novo, use a skill `pessoa-generator` — e registre aqui depois.

## Personagens

| Arquivo | Quem é | Expressão | Usar quando |
|---|---|---|---|
| `pessoa-01-frustracao-mulher-30` | Analista, 30 anos, blazer marinho | Mãos na cabeça, frustração intensa | Capa de problema, retrabalho, caos |
| `pessoa-02-decisao-mulher-30` | Analista, 30 anos, blazer marinho | Braços cruzados, confiança | Solução, método, conclusão |
| `pessoa-03-duvida-homem-40` | Gestor de operações, 40 anos, polo | Mão no queixo, dúvida | Pergunta, diagnóstico, "por quê?" |
| `pessoa-04-explicando-homem-40` | Gestor de operações, 40 anos, polo | Palmas abertas, explicando | Passo a passo, ensino |
| `pessoa-05-sobrecarga-homem-20` | Profissional júnior, 20 anos | Pilha de pastas, sobrecarregado | Excesso de trabalho, desorganização |
| `pessoa-06-insight-homem-20` | Profissional júnior, 20 anos | Dedo erguido, descoberta | Virada, "a causa era outra" |
| `pessoa-07-apontando-mulher-40` | Engenheira, 40 anos, colete e capacete | Apontando, autoridade | Chão de fábrica, indicar causa |
| `pessoa-08-foco-mulher-40` | Engenheira, 40 anos, colete e capacete | Prancheta, concentração | Medição, auditoria, coleta de dado |
| `pessoa-09-ceticismo-homem-50` | Diretor sênior, 50 anos, camisa branca | Braços cruzados, cético | Resistência, stakeholder difícil |
| `pessoa-10-confusao-mulher-20` | Analista júnior, 20 anos | Ombros erguidos, confusão | Processo não documentado, falta de clareza |
| `pessoa-11-explicando-homem-30` | Analista de dados, 30 anos | Gesto de explicação | Análise, apresentar número |
| `pessoa-12-lideranca-mulher-30` | Líder de time, 30 anos, blazer azul | Gesto de apresentação | Liderança, engajar equipe, CTA |

## Como ampliar

O elenco foi gerado pela DeepInfra com o modelo `black-forest-labs/FLUX-1-dev`
(US$ 0,0108 por imagem) e recortado com `@imgly/background-removal-node`.

Para novos personagens, manter o padrão: enquadramento da cintura para cima,
fundo cinza liso de estúdio, luz suave, foto realista, sem texto e sem logo.
