# Marketing para novos consultores

> Aba **Marketing** dentro da Área do Consultor, em `app.educacaopelotrabalho.com`.
> Transforma uma aula longa em Reel, carrossel de feed, carrossel em vídeo e PDF de LinkedIn,
> com a marca do próprio consultor, revisão peça a peça e publicação agendada.

Documento de plano. Escrito em 2026-09-12.

---

## 1. Objetivo e ordem das fases

**Fase 1 — Israel usando.** O produto precisa provar que, apertando poucos botões e
revisando, as publicações saem organizadas e agendadas. Usuário único: Israel.

**Fase 2 — outros consultores.** Mesma tela, mesmo fluxo, com o que falta para servir
gente com layout de vídeo diferente do nosso.

**Regra que vale nas duas:** modelar os dados como multi-tenant desde o começo — tudo
indexado por `consultorId`, nada cravado para um usuário só. Mas **não construir ainda**
calibração automática, planos e limites. A estrutura não precisa ser refeita depois, e não
se paga hoje por complexidade que só serve daqui a meses.

### Por que o Instagram vem primeiro

Tudo começa pelo vídeo, e o vídeo vai para o Instagram. Some-se a isso um detalhe que
resolve o cronograma: **na fase 1 a publicação no Instagram já funciona hoje**, porque a
conta do Israel tem papel no app da LBW. Apps em modo de desenvolvimento publicam em
contas que têm papel neles — não precisa de análise da Meta.

O App Review só vira obrigatório quando chegar o segundo consultor. Ou seja, é problema
de fase 2, e pode ser submetido em paralelo ao desenvolvimento.

**Recomendação de data:** submeter o App Review só depois de 10/10/2026, quando cair a
restrição atual da conta na Meta. Verificação de negócio amarra na entidade da empresa, e
submeter com restrição ativa no histórico é risco desnecessário.

---

## 2. Jornada do consultor

### 2.1 Configuração inicial

Lista simples na primeira entrada:

- Minha marca
- Meu público
- Minha área de atuação
- Meu dicionário técnico
- Instagram
- LinkedIn
- Página ou link principal
- Preferências de chamada para ação

**A marca não é cadastrada de novo.** `src/components/consultor/MinhaMarca.tsx` já guarda
logo, foto, nome e dados do consultor. Os criativos leem de lá.

**Dicionário técnico** é o item mais valioso desta tela. Hoje o `New-KaraokeCaptions.ps1`
tem uma correção cravada no código que conserta `LEAN SIGMA` para `LEAN SIX SIGMA`, porque
a legenda automática erra o termo. Isso serve só para nós. Virando tabela por consultor,
resolve para qualquer área: um médico protege nomes de medicamento e siglas do mesmo jeito
que protegemos DMAIC, White Belt e Green Belt.

### 2.2 Conexão das redes

O consultor não digita token nem mexe em arquivo de configuração. Ele vê dois botões,
**Conectar Instagram** e **Conectar LinkedIn**, é levado à autorização oficial da rede e
volta. O aplicativo guarda a autorização no servidor, vinculada ao `consultorId`.

**Instagram**
- A conta precisa ser **profissional** (Business ou Creator). Conta pessoal não publica por API.
  Isso vira passo de onboarding: se o consultor tem conta pessoal, converte antes.
- Publica imagem, vídeo, Reel e carrossel.
- A mídia precisa estar em URL pública temporária no momento da publicação.
- Para contas de terceiros, exige App Review e verificação de negócio. Fase 2.

**LinkedIn**
- Publica texto, imagem, vídeo e documento PDF.
- O carrossel orgânico é publicado tecnicamente como **documento PDF**. O formato
  "Carousel" oficial da API é apenas patrocinado.
- Perfil pessoal usa `w_member_social`, que é **self-serve e não exige aprovação**.
- Página de empresa usa `w_organization_social`, que exige aprovação e papel de admin na
  página. Fora do escopo por enquanto.

### 2.3 Biblioteca de vídeos

Área **Meus vídeos**, onde o consultor envia o arquivo, informa título, curso e série,
acompanha upload e processamento, e seleciona um vídeo para **Criar conteúdo**.

Os vídeos longos ficam no **Bunny**, que já está implementado no `server.ts` com uma
Video Library por consultor (`bunnyCreateLibrary`, coleção privada `bunny_libraries`).
Isso reduz bastante o desenvolvimento inicial.

**Transcrição: fase 2.** Na fase 1 o Israel já tem todas as transcrições dos seus vídeos,
então o assunto não bloqueia nada. A plataforma não gera nem pede transcrição por enquanto.

> **A resolver na fase 2 — sincronismo da legenda.**
> A legenda karaokê exige tempo **palavra a palavra**, não texto corrido. Hoje isso vem do
> YouTube em formato JSON3, via `yt-dlp`. Quando abrir para outros consultores, decidir entre:
> a) exigir que o vídeo esteja no YouTube; b) aceitar upload de arquivo de legenda
> temporizada; c) entregar o Reel sem karaokê; d) gerar transcrição com custo por minuto.

### 2.4 Produção automática

O consultor escolhe o objetivo — conseguir seguidores, gerar comentários, demonstrar
autoridade, ou divulgar curso e serviço — e a geração segue:

```
Vídeo longo
   ↓
Transcrição (fornecida pelo consultor)
   ↓
Correção pelo dicionário técnico
   ↓
Mapeamento dos assuntos
   ↓
Seleção dos melhores trechos
   ↓
Reel + PDF LinkedIn + carrossel em vídeo + carrossel de feed
   ↓
Revisão do consultor
   ↓
Aprovação e publicação
```

Cada produção é uma **campanha orgânica**, e dentro dela ficam todas as peças derivadas
daquele assunto.

### 2.5 Revisão e pedido de melhoria

Parte indispensável. O consultor não recebe só "gerar" e "publicar".

Cada peça tem prévia, texto da publicação, capa, status (gerando, pronto para revisão,
aprovado, publicado), botão **Aprovar**, botão **Solicitar melhoria**, campo de texto livre
e histórico de versões.

Exemplo de pedido: *"Aumente meu rosto, reduza o título e corrija a palavra Green Belt na legenda."*

**O sistema regenera apenas aquela peça.** A versão anterior fica guardada para comparação.
Isso evita refazer a campanha inteira por um ajuste pequeno, e é uma das decisões mais
importantes do desenho.

---

## 3. Onde o OpenSquad fica

Não fica no navegador, nem no Firestore, nem exposto ao consultor.

```
Aba Marketing
      ↓
Servidor cria tarefa no Firestore
      ↓
Worker privado consome a fila
      ↓
OpenSquad executa os squads da LBW
      ↓
ffmpeg e renderizadores produzem os arquivos
      ↓
Arquivos vão para o armazenamento
      ↓
Consultor recebe a prévia para revisar
```

**Por que worker separado:** o OpenSquad roda com sistema de arquivos, ffmpeg e Chromium
headless. Nada disso executa numa página React. Além disso, editar um vídeo leva minutos e
consome memória e processador — dentro da mesma requisição que serve o site, derrubaria a
plataforma. Pode começar como serviço separado no Railway.

O OpenSquad original permanece intacto. O aplicativo usa apenas squads próprios:
`lbw-reel-production`, `lbw-carousel-production` e um futuro `consultant-content-production`.

**O consultor nunca sabe que o OpenSquad existe.** Para ele há "Criar campanha" e
"Solicitar melhoria".

---

## 4. Armazenamento

```
marketing
└── consultorId
    └── campanhaId
        ├── fonte
        ├── transcricao
        ├── reels
        ├── linkedin-pdf
        ├── carrossel-video
        ├── carrossel-feed
        └── versoes
```

O Firestore guarda **apenas informações, estados e referências**. Vídeo e imagem não entram
no Firestore.

---

## 5. O que já existe e será reaproveitado

- Firebase Authentication
- Identificação do consultor e separação por `consultorId`
- Cadastro da marca (`MinhaMarca.tsx`)
- Firestore e Storage
- Bunny com biblioteca por consultor (`server.ts`, seção multi-tenant)
- Servidor Node/Express
- Controle de papéis: administrador, consultor, coordenador
- Motor de geração de Reels e carrosséis, já validado neste projeto

Arquivos relevantes:
- `src/App.tsx`
- `src/components/consultor/MinhaMarca.tsx`
- `src/components/MarketingView.tsx`
- `server.ts`

> **Atenção ao nome.** Já existe um `MarketingView.tsx`, mas é **outra coisa**: aba admin
> de e-mail marketing, que sincroniza leads com o Hostinger Reach e trata campanhas de
> cortesia. A aba nova é da **Área do Consultor** e não deve ser misturada com essa.

---

## 6. O que pode ser feito

- Aba exclusiva de Marketing na Área do Consultor
- Reaproveitar a marca do consultor automaticamente
- Envio de vídeos longos, guardados na biblioteca Bunny do consultor
- Correção de termos pelo dicionário técnico
- Gerar Reel, PDF de LinkedIn, carrossel em vídeo e carrossel de imagens
- Capas padronizadas
- Prévia dentro do aplicativo
- Pedido de melhoria em texto livre
- Versionamento por peça
- Aprovação peça a peça
- Calendário de publicações
- Publicar no Instagram (fase 1 para o Israel; demais consultores após App Review)
- Publicar no LinkedIn em perfil pessoal
- Controlar limites mensais por plano

## 7. O que não podemos prometer

- Publicar automaticamente em conta pessoal comum do Instagram
- Ignorar análise e permissões da Meta ou do LinkedIn
- Garantir que as redes não mudem suas APIs
- Garantir alcance, seguidores ou vendas
- Alterar o arquivo de uma publicação já publicada — em muitos casos é excluir e publicar de novo
- Processar vídeos pesados dentro do navegador
- Guardar tokens no código do site ou acessíveis no frontend
- Garantir criação perfeita sem revisão
- Publicar em nome de qualquer perfil sem autorização expressa
- Usar o carrossel nativo do LinkedIn como formato orgânico — para orgânico, é PDF

---

## 8. Riscos

**Calibração de layout — o maior risco do projeto.**
O `render-reel.ps1` usa `faceCropX`, `faceCropY`, `slideWidth` e outros parâmetros ajustados
à mão para a posição exata da webcam do Israel. O vídeo de outro consultor tem a webcam em
outro canto, slide de outro tamanho, ou nem slide tem. Na fase 1 isso não aparece, porque o
usuário já está calibrado. Quebra no segundo consultor.

Tratamento: **fase 2**, com detecção automática de onde está o rosto e o conteúdo, ou tela
de calibração manual no onboarding.

**Custo de processamento.** Vídeo consome processador, memória, armazenamento e banda.
Margem de SaaS com IA fica em 50–60%, contra 80–90% do SaaS tradicional. Precisa ser
modelado antes de abrir planos.

**Mudança de API.** Meta e LinkedIn mudam regras com frequência. O código de publicação
precisa isolar bem essa camada.

**Restrição ativa na Meta.** Até 10/10/2026. Não bloqueia a fase 1, mas define quando
submeter o App Review.

---

## 9. Decisões tomadas

| Data | Decisão |
|---|---|
| 2026-09-12 | Instagram antes do LinkedIn — o vídeo é o começo de tudo, e na fase 1 já funciona sem App Review |
| 2026-09-12 | Código multi-layout para outros consultores fica na **fase 2** |
| 2026-09-12 | Transcrição fica para a **fase 2** — o Israel já tem todas as dele |
| 2026-09-12 | A aba se chama **Marketing para Consultores**, para não confundir com a aba Marketing do admin (e-mail marketing) |
| 2026-09-12 | Modelar dados como multi-tenant desde já; não construir ainda calibração, planos e limites |
| 2026-09-12 | Worker separado do servidor principal, começando no Railway |
| 2026-09-12 | Fase 1 tem usuário único: Israel |

---

## 10. Primeiras entregas da fase 1

Quatro entregas. Só a primeira é pré-requisito das outras.

1. **Aba Marketing na Área do Consultor**, admin-only, com estrutura de dados por `consultorId`
2. **Biblioteca de vídeos** apontando para o Bunny existente
3. **Fila e worker** com o OpenSquad rodando fora do site
4. **Revisão com pedido de melhoria** e versionamento por peça

A primeira versão não precisa publicar automaticamente. Precisa provar que uma aula entra e
as quatro peças saem, com a marca certa. Quando a geração estiver estável, conectam-se as redes.
