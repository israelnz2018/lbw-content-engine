# Worker de producao de conteudo da LBW.
#
# Precisa de tres coisas que a imagem padrao do Node nao traz:
#   - ffmpeg      corta e monta os videos
#   - Chromium    o Playwright vira HTML em PNG nos carrosseis
#   - fontes      sem elas o texto sai como retangulo vazio
#
# A imagem do Playwright ja vem com o Chromium e as dependencias de sistema
# resolvidas. Sai mais pesada, mas evita a lista de pacotes que costuma quebrar
# a cada atualizacao.
#
# ATENCAO: esta versao tem que ser IGUAL a do playwright nos dois package.json,
# e la a versao e fixa (sem o ^). A imagem traz o Chromium de UMA versao; se o npm
# instalar outra, o Playwright procura um binario que nao existe e o render morre
# com "Executable doesn't exist at /ms-playwright/chromium_headless_shell-...".
# Foi o que aconteceu: imagem 1.58.2 e o ^ deixando o npm subir pra 1.63.0.
# Pra atualizar, mude a imagem E os dois package.json na mesma tacada.
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

ENV NODE_ENV=production \
    DEBIAN_FRONTEND=noninteractive

# ffmpeg e as fontes. fonts-liberation traz a Arial Bold que os renderizadores usam.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-liberation fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencias do worker primeiro, para aproveitar o cache quando so o codigo muda.
COPY worker/package.json ./worker/
RUN cd worker && npm install --omit=dev

# Os renderizadores tambem tem dependencias proprias (Playwright, recorte de fundo).
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

# O motor: squads, renderizadores e marca.
COPY squads/ ./squads/
COPY assets/ ./assets/
COPY skills/ ./skills/
COPY worker/ ./worker/

# Sem estado local: tudo que o worker gera vai para o Storage e a pasta temporaria
# e apagada no fim de cada tarefa.
WORKDIR /app/worker

CMD ["node", "index.mjs"]
