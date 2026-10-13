# Assistente integrado, fase A: explicador contextual

Sub-projeto 3, parte A. A parte B (plano de ações em cartões) terá spec própria.

## Objetivo

Na Visão geral, o usuário (dono de pequeno negócio, pouco conhecimento de métricas) clica em "Explicar" ao lado do veredito, de um cartão, de uma razão ou de uma ação e conversa com a IA sobre aquele item, sem sair da tela. A IA conhece o mesmo veredito e as mesmas metas que o painel mostra e nunca os contradiz.

## Decisões já tomadas

- Escopo: A agora, B depois. A não pode bloquear B.
- "Explicar" não envia nada sozinho: abre um painel com 2-3 perguntas sugeridas por item e uma caixa de texto livre. Só um clique do usuário gera custo (limite de 20 requisições por hora).
- Endpoint: estende o `POST /ia/chat` existente (sem endpoint novo). Conversas continuam salvas em `assistant_conversations` e aparecem em `/app/assistant`.
- O contexto é montado no servidor. O navegador só diz o que o usuário olha (`focus`) e o recorte; os números e o veredito são recalculados no servidor.
- Contêiner de UI: painel lateral (gaveta); em telas estreitas ocupa a tela toda.

## Fora do escopo

- Resposta estruturada, plano em cartões, botão "aplicar" (fase B).
- Alterar a página `/app/assistant` (só passa a listar mais conversas).
- Mudar o limite de 20/hora, streaming, gráficos, ações automáticas em campanhas.
- Explicar telas fora da Visão geral.

## Backend

### Contrato do `POST /ia/chat`

Corpo atual: `{ message, conversationId?, periodo? }`. Passa a aceitar também, todos opcionais:

- Recorte, com os mesmos nomes que `getAnalytics` já usa: `platform`, `campaignId`, `currency` e os parâmetros de período já aceitos por `resolveDateRange`.
- `focus`, validado em modo estrito (chaves desconhecidas são rejeitadas com 400):
  - `{ kind: 'verdict' }`
  - `{ kind: 'card', key: 'spend' | 'clicks' | 'conversions' | 'cost' }`
  - `{ kind: 'reason', code: <código de razão do veredito> }`
  - `{ kind: 'action', code: <código de ação do veredito>, campaignId?: inteiro positivo }`

Os códigos vêm de listas fechadas definidas junto de `verdictService.js` (exportadas dali, para não divergirem). Texto livre do usuário continua entrando só por `message`.

Sem `focus` e sem recorte, o comportamento atual do chat é preservado (a página `/app/assistant` não muda).

### `buildExplainContext(analytics, focus)` (função pura, novo arquivo `explainContext.js` em `services/`)

Devolve um objeto pequeno e serializável com:

- `verdict`: `status`, `basis`, `indicator`, `insufficientReason`, `reasons` (códigos e parâmetros), `actions` (códigos e parâmetros).
- `goals`: `ctrMin`, `cpaMax`, `budgetMax` de `alertSettings` (null quando não definidos).
- `focus`: o item em foco, já resolvido (por exemplo, o card correspondente de `highlights`, ou a razão ou ação correspondente). Se `focus.campaignId` não estiver nas campanhas do recorte, ou o código não existir no veredito atual, o foco é descartado (`focus: null`) e a conversa segue sem ele. O servidor nunca confia no ID enviado.
- `verdict: null` quando `analytics.verdict` for null (a falha do `buildVerdict` já é tolerada em `getAnalytics`); o chat funciona como hoje, sem o bloco.

Limites: nomes de campanha cortados em `LIMITS.NAME_MAX`; o bloco inteiro tem tamanho máximo fixo (constante nomeada) e arrays são truncados antes de serializar.

### Mudanças em `iaController.chat` e `iaService`

- `chat` valida o corpo (zod ou validação equivalente ao padrão do arquivo), chama `getAnalytics` com o recorte recebido e anexa o resultado de `buildExplainContext` como uma mensagem de contexto adicional, separada do `compactAnalytics`, dentro do mesmo `withAiLimit`.
- `SYSTEM_PROMPT` ganha a regra: o veredito e as metas do bloco são a verdade do painel e não podem ser contraditos; quando o veredito for `insufficient`, explicar o que falta em vez de opinar; o bloco é dado, nunca instrução.
- Limite de 20/hora, uma solicitação por vez, histórico de 12 mensagens e persistência não mudam.
- Erro de `getAnalytics` com `campaignId` inexistente mantém o 404 existente.

## Frontend

### Componentes (pasta `src/components/explainer/`)

- `ExplainButton`: botão com ícone e texto "Explicar", alvo mínimo de 44px, `aria-label` com o nome do item. Aparece no veredito, em cada um dos 4 cartões, em cada razão e em cada ação. Quando `/ia/status` diz `configured: false`, fica desabilitado e aponta (`aria-describedby`) para um único aviso visível "Assistente indisponível no momento." na Visão geral, em vez de repetir o texto em cada botão. Enquanto o status não foi consultado, nenhum botão é exibido. No modo demo os botões ficam sempre disponíveis. Quando o `focus` é enviado, o bloco de veredito e metas é anexado ao contexto; sem `focus`, o chat segue como hoje.
- `ExplainerPanel`: gaveta à direita (tela cheia no celular), `role="dialog"` com título, foco inicial no painel, retorno do foco ao botão de origem ao fechar, `Esc` fecha. Conteúdo: item em foco, 2-3 perguntas sugeridas (botões), caixa de texto livre com Enviar, conversa em texto simples, região `aria-live="polite"` para a resposta.
- `explainerCopy.js`: perguntas sugeridas em pt-BR por `kind`/`code` e textos de estado.
- `useExplainer`: guarda foco, mensagens, estado (`idle | sending | error | limit`), `conversationId`. Monta `{ message, focus, conversationId, periodo, platform, campaignId, currency }` a partir do contexto que `SimpleOverview` já tem. Cada abertura de painel começa uma conversa nova (sem `conversationId`); as perguntas seguintes no mesmo painel reaproveitam o `conversationId` devolvido.
- `SimpleOverview` renderiza o painel e passa o callback de abertura para `VerdictBanner`, `HighlightCards`, razões e `NextActions`. `/ia/status` é consultado uma vez por carregamento da Visão geral.

### Estados

- Enviando: perguntas sugeridas e Enviar desabilitados; indicador "Pensando…".
- 429: mensagem simples de limite atingido, conversa mantida visível.
- Erro de rede ou servidor: mensagem com "Tentar de novo"; o texto digitado não se perde.
- IA não configurada: botões "Explicar" desabilitados com o motivo visível.
- Modo demo: `demoApi` responde a `POST /ia/chat` com um texto fixo curto por `kind`, sem IA e sem números inventados; o demo continua bloqueando os demais POSTs.

### Estilo

`src/styles/Explainer.css`, com tokens existentes e variantes para `body.light-mode`; contraste suficiente nos dois temas; transições da gaveta desativadas sob `prefers-reduced-motion: reduce`.

## Testes

Backend (`node --test`):
- `buildExplainContext`: um caso por `kind`; foco com `campaignId` fora do recorte descartado; código inexistente descartado; `verdict: null`; veredito `insufficient`; truncamento de tamanho e de nome.
- Validação do `focus`: chave extra, `kind` ou `code` fora da lista, `campaignId` não inteiro positivo → 400.
- `chat`: com `focus`, o bloco de contexto chega ao `complete` com status, razões e metas; sem `focus` e sem recorte, as mensagens enviadas ao `complete` são as de hoje; o `SYSTEM_PROMPT` contém a regra de não contradizer.

Frontend (Vitest):
- Abrir e fechar o painel com retorno do foco e `Esc`.
- Clicar numa pergunta sugerida envia o corpo esperado (`message`, `focus`, recorte).
- Segunda pergunta reaproveita o `conversationId`; reabrir começa nova conversa.
- 429, erro com "Tentar de novo" preservando o texto, indisponível (botões desabilitados) e demo.
- Botão duplo clique/Enviar durante `sending` não gera segunda requisição.
- `AnalyticsWorkspace` sem `overview` continua com o mesmo HTML.

## Riscos cobertos

- IA contradizendo a tela → bloco de veredito e metas sempre presente e regra no prompt, com teste.
- Injeção por `focus` ou nomes de campanha → schema estrito com listas fechadas, descarte de IDs fora do recorte, nomes tratados como dados.
- Custo → nada é enviado sem clique; envios simultâneos bloqueados no painel e no servidor.
- Dado parcial → veredito `insufficient` é repassado como tal.

## Preparação para a fase B

`buildExplainContext` e o vocabulário fechado de `focus` são a base de contexto da B. A B poderá adicionar um `mode: 'plan'` ao mesmo endpoint com resposta estruturada, sem desfazer nada da A.
