# Publicar o worker no Railway

O worker é quem produz as peças: recebe o pedido pela fila do Firestore, roda os
renderizadores (Chromium para os slides, ffmpeg para o vídeo) e sobe o resultado
para o Storage.

Ele roda **separado do site** de propósito. Renderizar consome memória e processador
por minutos seguidos; no mesmo container que serve a plataforma, um render pesado
derrubaria o site inteiro. Separado, o pior caso é a peça não sair.

## Onde ele deve ficar

**No mesmo projeto do Railway onde já está a plataforma**, como um serviço a mais.

Não é só organização. As variáveis de um projeto do Railway podem ser compartilhadas
entre os serviços, e a plataforma já tem a credencial do Firebase lá. O worker foi
feito para aceitar exatamente o mesmo nome de variável que ela usa
(`FIREBASE_ADMIN_KEY_JSON`) — então, no mesmo projeto, **não é preciso colar a chave
de novo**.

No Railway: abra o projeto da plataforma → **New** → **GitHub Repo** →
`israelnz2018/lbw-content-engine`.

O `railway.json` na raiz do repositório já manda usar `worker/Dockerfile`. Não precisa
configurar build nem start command.

## As variáveis

| Nome | Valor | Precisa colar? |
|---|---|---|
| `FIREBASE_ADMIN_KEY_JSON` | o JSON da conta de serviço | **Não, se já existir no projeto** |
| `FIREBASE_STORAGE_BUCKET` | `senha-92ce1.firebasestorage.app` | Sim |

Se a variável do Firebase não estiver visível para o novo serviço, marque-a como
**Shared Variable** no projeto, ou cole o conteúdo de
`secrets/firebase-service-account.json` (o arquivo inteiro, das chaves `{` a `}`).

O worker também aceita `FIREBASE_SERVICE_ACCOUNT`, para o caso de rodar num projeto
separado.

## Não crie domínio público

O worker não atende requisição nenhuma — ele só ouve a fila. Expor porta seria abrir
uma porta que não existe.

## Como saber se está funcionando

Nos logs do Railway, na subida:

```json
{"msg":"worker iniciado","modo":"ouvinte","batidaMs":60000}
```

Quando uma peça é pedida pela plataforma:

```json
{"msg":"tarefa iniciada","tipo":"gerar-campanha"}
{"msg":"tarefa concluida","segundos":44,"pecas":3}
```

Se a credencial estiver faltando, o worker diz o nome das duas variáveis que aceita e
para — não fica em silêncio.

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
