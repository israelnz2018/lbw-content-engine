---
execution: inline
agent: carousel-designer
outputFile: _producao/lbw-carousel-production/render-report.md
model_tier: powerful
---
# Etapa 4: renderização

1. Complete o JSON do carrossel com roteiro, imagens e diretório final.
2. Execute `node automation/render-carousel.mjs <caminho-do-json>`.
3. Confirme PNGs 1080 x 1350, PDF multipágina e nomes iniciados pela data de criação.
4. Salve somente os arquivos finais na pasta `Carrosseis finais`; arquivos técnicos ficam no diretório da execução.
5. Registre quantidade de páginas, dimensões e caminhos no relatório.

## Veto Conditions

1. Falta página, imagem ou PDF.
2. Arquivo final sem data no nome.
3. Dimensão diferente de 1080 x 1350.
