# Publicar o worker no Railway

O worker é quem produz as peças: recebe o pedido pela fila do Firestore, roda os
renderizadores (Chromium para os slides, ffmpeg para o vídeo) e sobe o resultado
para o Storage.

Ele roda **separado do site** de propósito. Renderizar consome memória e processador
por minutos seguidos; no mesmo container que serve a plataforma, um render pesado
derrubaria o site inteiro. Separado, o pior caso é a peça não sair.

## O que fazer no Railway, uma vez só

1. **New Project → Deploy from GitHub repo** → escolha `israelnz2018/lbw-content-engine`.

   O `railway.json` na raiz já manda usar `worker/Dockerfile`. Não precisa configurar
   build nem start command.

2. Em **Variables**, crie duas:

   | Nome | Valor |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | o conteúdo **inteiro** do JSON da conta de serviço, numa linha só |
   | `FIREBASE_STORAGE_BUCKET` | `senha-92ce1.firebasestorage.app` |

   O JSON é o mesmo arquivo que está em `secrets/` nesta máquina. Ele **não** está no
   GitHub (o `.gitignore` bloqueia `secrets/`), e é por isso que precisa ser colado aqui.

3. **Não** crie domínio público. O worker não atende requisição nenhuma — ele só ouve
   a fila. Expor porta seria abrir uma porta que não existe.

## Como saber se está funcionando

Nos logs do Railway, na subida:

```json
{"msg":"worker iniciado","modo":"ouvinte","batidaMs":60000}
```

Quando uma peça é pedida pela plataforma:

```json
{"msg":"tarefa iniciada","tipo":"gerar-campanha"}
{"msg":"tarefa concluida","segundos":33,"pecas":2}
```

## Por que "ouvinte" e não consulta em laço

A versão anterior perguntava à fila a cada 5 segundos. Isso custava ~17 mil leituras
por dia mesmo sem nenhum trabalho acontecer, e ainda demorava até 5 segundos para
pegar a tarefa.

Agora o worker abre um ouvinte do Firestore: acorda no instante em que a tarefa entra
(medido: ~2 segundos, quase tudo propagação do Firestore) e não gasta leitura quando
a fila está vazia. A consulta em laço continua existindo, a cada 60 segundos, só como
rede de segurança caso a conexão do ouvinte caia sem avisar.

Quem garante que dois workers não peguem a mesma tarefa continua sendo a transação em
`pegarProximaTarefa` — o ouvinte é só a campainha.

## Custo

O container fica quase todo o tempo parado, esperando. O gasto real acontece nos
minutos em que está renderizando. Não há banco de dados nem volume: o que o worker
gera vai para o Storage e a pasta temporária é apagada no fim de cada tarefa.
