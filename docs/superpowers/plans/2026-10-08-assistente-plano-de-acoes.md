# Assistente, fase B: plano de ações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada ação de "O que fazer agora" ganha um passo a passo de 3 a 5 passos escrito pela IA, que o usuário marca como feitos, com o progresso salvo por ação.

**Architecture:** Tabela nova `planos_acao` (SQL aditivo). O backend ganha `services/aiScope.js` (recorte compartilhado), `services/planService.js` (validação e regras) e três rotas em `/ia/planos`; `complete()` aceita um esquema de saída por chamada. O frontend ganha `usePlans` e `ActionPlan`, plugados em `NextActions` por uma prop `plans`.

**Tech Stack:** Express, Prisma/Postgres (Supabase), zod, `node --test`; React 18, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-08-assistente-plano-de-acoes-design.md` (depende da fase A: `2026-10-08-assistente-explicador-design.md`).

## Global Constraints

- Idioma da interface e dos prompts: pt-BR. Texto da IA é dado, renderizado como texto, nunca HTML.
- Elegíveis a plano: `PLAN_ACTION_CODES = ['budget_exceeded','campaign_over_goal','campaign_low_ctr','campaign_without_results','enable_conversion_tracking']`. `nothing_urgent` e `refresh_data` nunca têm plano.
- `action_key` = `<código>:<campaignId>` ou `<código>:-`, montada só pelo servidor. Passos: 3 a 5, texto aparado, 1 a 200 caracteres, ids `s1..sN`, `done` falso ao criar.
- Limite de IA: 20 por hora e uma por vez (`withAiLimit`), sem alteração. A IA só é chamada em `POST /ia/planos` sem plano existente ou com `regenerate: true`.
- Plano visível só se a ação estiver no veredito atual; planos com `last_seen_at` com mais de 30 dias são apagados (só do usuário da requisição).
- Toda consulta de plano filtra por `user_id`; plano de outro usuário responde 404.
- Alvos de toque ≥ 44px; ícone + texto; `aria-live`/`role="alert"` nos erros; contraste nos dois temas (`body.light-mode`); sem animação sob `prefers-reduced-motion: reduce`.
- Sem a prop `plans`, o HTML de `NextActions` é idêntico ao atual.
- **Nunca aplicar SQL no banco real sem autorização expressa do usuário naquele momento.** Tarefa 1 só escreve o arquivo; a aplicação é um passo separado, pedido ao usuário.
- O projeto não é repositório git: passos de commit são ignorados; o ledger fica em `scratchpad/progress-plans.md`.
- Comandos: backend `cd eyesight-backend && npm test`; frontend `cd eyesight-front && npx vitest run`, `npm run lint`, `npm run build` (apagar `dist/` depois).

## Review Focus

1. Dois cliques rápidos em passos diferentes do mesmo plano: a alteração roda numa transação com a linha travada (`FOR UPDATE`) antes de gravar.
2. Resposta da IA com HTML, markdown, passos vazios, repetidos demais ou fora de 3 a 5: rejeitada com 502 e nada gravado.
3. Ação que sumiu do veredito: `GET` não devolve o plano, `POST` responde 404, e a limpeza de 30 dias nunca apaga planos de outro usuário.
4. Tabela ainda inexistente no banco: o `GET /ia/planos` falha com erro genérico e a Visão geral continua mostrando tudo menos a área de planos.
5. Mudança de recorte ou fechamento durante uma geração ou marcação: resposta antiga não altera o estado novo (lição da fase A).

---

### Task 1: Banco, escopo compartilhado e regras do plano

**Files:**
- Create: `eyesight-backend/scripts/plans-additions.sql`, `eyesight-backend/src/services/aiScope.js`, `eyesight-backend/src/services/planService.js`
- Modify: `eyesight-backend/prisma/schema.prisma` (modelo `planos_acao` e relação em `usuarios`), `eyesight-backend/src/controllers/iaController.js` (usar `aiScope.js`)
- Test: `eyesight-backend/src/test/planService.test.js`; os testes do chat em `iaController.test.js` devem continuar passando

**Interfaces:**
- Produces em `aiScope.js`: `export function analyticsQuery(body): { periodo, startDate?, endDate?, platform?, campaignId?, currency? }` — a mesma lógica hoje em `iaController.js` (lança `aiError(..., 400)`; valida com `resolveDateRange`). O controller passa a importá-la.
- Produces em `planService.js`: `PLAN_ACTION_CODES`; `actionKey({ code, campaignId })`; `parsePlanAction(raw): { code, campaignId? }` (estrito, 400); `validateSteps(raw): Step[]` (502); `findCurrentAction(analytics, action): object | null`; tipo `Step = { id: string, text: string, done: boolean }`.

- [ ] **Step 1: Escrever os testes que falham** em `planService.test.js`:
  - `actionKey({code:'campaign_over_goal', campaignId:7})` = `'campaign_over_goal:7'`; sem `campaignId` = `'budget_exceeded:-'`; código fora da lista (`nothing_urgent`, `refresh_data`, `x`) → erro com `status 400`; `campaignId` `0`, `-1`, `1.5`, `'7'` → 400.
  - `parsePlanAction`: aceita `{code}` e `{code, campaignId}`; chave extra, código inválido, `campaignId` inválido → 400; entrada não objeto → 400.
  - `validateSteps({ passos: [...] })`: com 3, 4 e 5 textos devolve `[{id:'s1',text,done:false},...]` com texto aparado; com 2, 6, item vazio ou só espaços, item com 201 caracteres, item que não é string, `passos` ausente, entrada `null` → erro com `status 502`.
  - `findCurrentAction`: acha pelo código e `campaignId` em `analytics.verdict.actions`; `null` quando falta o veredito, o código ou o `campaignId` difere.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `cd eyesight-backend && node --experimental-test-module-mocks --test src/test/planService.test.js`
  Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar** `planService.js` (zod estrito para `parsePlanAction`; erros via `aiError` de `iaService.js`) e extrair `analyticsQuery` (mais as constantes `PLATFORMS` e a validação de `numericId` que ela usa) de `iaController.js` para `aiScope.js`, trocando o controller para importá-la. Escrever `plans-additions.sql` exatamente assim:

```sql
CREATE TABLE IF NOT EXISTS public.planos_acao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL,
  action_key varchar(80) NOT NULL,
  action_code varchar(50) NOT NULL,
  campaign_id integer,
  steps jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planos_acao_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(pk_id_usuario) ON DELETE CASCADE,
  CONSTRAINT planos_acao_user_action_key UNIQUE (user_id, action_key)
);
CREATE INDEX IF NOT EXISTS planos_acao_user_id_last_seen_at_idx ON public.planos_acao(user_id, last_seen_at);
ALTER TABLE public.planos_acao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.planos_acao FROM anon, authenticated;
```

  Modelo Prisma `planos_acao` com os mesmos campos (`@@unique([user_id, action_key])`, `@@index([user_id, last_seen_at])`, relação `user usuarios ... onDelete: Cascade`) e `planos planos_acao[]` em `usuarios`. Depois `cd eyesight-backend && npx prisma generate` (não toca o banco).

- [ ] **Step 4: Rodar e ver passar**
  Run: `cd eyesight-backend && node --experimental-test-module-mocks --test src/test/planService.test.js`
  Expected: PASS.

- [ ] **Step 5: Suíte do backend**
  Run: `cd eyesight-backend && npm test`
  Expected: PASS sem falhas (os testes do chat provam que a extração não mudou nada).

---

### Task 2: Geração dos passos e rotas

**Files:**
- Modify: `eyesight-backend/src/services/iaService.js` (`complete` com esquema por chamada; `gerarPassos`), `eyesight-backend/src/services/planService.js` (funções de dados), `eyesight-backend/src/controllers/iaController.js` (3 handlers), `eyesight-backend/src/routes/iaRoutes.js`
- Test: `eyesight-backend/src/test/iaService.test.js`, `eyesight-backend/src/test/planRoutes.test.js` (novo, mesmo estilo de mocks de `iaController.test.js`)

**Interfaces:**
- Consumes: `analyticsQuery` (aiScope), `parsePlanAction`, `actionKey`, `validateSteps`, `findCurrentAction`, `PLAN_ACTION_CODES` (Task 1); `buildExplainContext` (fase A); `withAiLimit`.
- Produces em `iaService.js`: `complete(messages, { structured })` onde `structured` é `true` (análise atual, inalterada) ou `{ name: string, schema: object, instruction: string }`; com objeto devolve `{ data: <JSON parseado>, modelo }` (sem validar); `gerarPassos({ context }): Promise<{ passos: unknown }>`.
- Produces nas rotas: `GET /ia/planos`, `POST /ia/planos`, `PATCH /ia/planos/:id/passos/:stepId`, com respostas `{ planos }`, `{ plano }` e `{ plano }` onde `plano = { id, actionKey, actionCode, campaignId, steps, generatedAt }`.

- [ ] **Step 1: Escrever os testes que falham.**
  - `iaService.test.js`: `complete` com `structured = { name, schema, instruction }` — na OpenAI envia `response_format.json_schema` com esse `name` e `schema` e devolve `{ data, modelo }`; em outro provedor envia `json_object` com a `instruction` como última mensagem; JSON inválido → 502; `structured: true` continua devolvendo a análise como antes (testes existentes).
  - `planRoutes.test.js` (mocks de `prisma` com `planos_acao.findMany/findUnique/upsert/update/deleteMany`, `$transaction(fn) => fn(prisma)`, `$queryRaw`; mock de `getAnalytics` com veredito contendo as ações `campaign_over_goal` (campaignId 7) e `refresh_data`; mock de `gerarPassos`; mock de `withAiLimit` que executa a ação):
    - `POST`: ação nova → 201, `gerarPassos` chamado uma vez, upsert com `action_key` `campaign_over_goal:7` e `user_id` do usuário; plano já existente sem `regenerate` → 200, `gerarPassos` **não** chamado; `regenerate: true` → 200 e passos novos todos `done:false`; ação ausente do veredito → 404 e IA não chamada; `refresh_data` → 400; corpo inválido, recorte inválido → 400 e `getAnalytics` não chamado; `gerarPassos` devolvendo 2 passos → 502 e `upsert` **não** chamado; `withAiLimit` lançando 429 → 429.
    - `GET`: devolve só planos das ações atuais, chama `update` de `last_seen_at` apenas para os devolvidos, chama `deleteMany` com `where` contendo o `user_id` e `last_seen_at < agora-30 dias`; não devolve plano de ação que não está no veredito; sem veredito → `{ planos: [] }`.
    - `PATCH`: dentro de `$transaction`, executa `$queryRaw` (trava) **antes** de `update`; marca e desmarca um passo mantendo os outros; plano de outro usuário, id inválido e `stepId` inexistente → 404; `done` não booleano → 400.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `cd eyesight-backend && node --experimental-test-module-mocks --test src/test/iaService.test.js src/test/planRoutes.test.js`
  Expected: FAIL nos casos novos; os existentes passam.

- [ ] **Step 3: Implementar.** `complete`: ramo `structured` objeto reaproveitando `providerEndpoint` e o tratamento de erros atual. `gerarPassos` usa `SYSTEM_PROMPT` e um pedido em pt-BR: de 3 a 5 passos curtos em linguagem simples que o dono do negócio faz na própria plataforma (Meta ou Google), usando só os números do bloco do painel, sem prometer resultado e sem comparar com o mercado; se o veredito for `insufficient`, o primeiro passo explica o que falta; esquema `{ passos: string[] }`, nome `action_plan`. Handlers em `iaController.js` seguindo o padrão `try/catch` + `failure(res, err)`; rotas em `iaRoutes.js` com o mesmo middleware das demais rotas de IA. A alteração de passo usa `prisma.$transaction(async tx => { await tx.$queryRaw\`SELECT id FROM planos_acao WHERE id = ${id}::uuid AND user_id = ${userId} FOR UPDATE\`; ... tx.planos_acao.update(...) })`. Id de plano que não é UUID → 404.

- [ ] **Step 4: Rodar e ver passar**
  Run: `cd eyesight-backend && node --experimental-test-module-mocks --test src/test/iaService.test.js src/test/planRoutes.test.js`
  Expected: PASS.

- [ ] **Step 5: Suíte do backend**
  Run: `cd eyesight-backend && npm test`
  Expected: PASS sem falhas.

---

### Task 3: Hook e componente do plano

**Files:**
- Create: `eyesight-front/src/components/plans/usePlans.js`, `eyesight-front/src/components/plans/ActionPlan.jsx`, `eyesight-front/src/styles/Plans.css`
- Modify: `eyesight-front/src/services/demoApi.js` (rotas de plano do demo)
- Test: `eyesight-front/src/components/plans/__tests__/usePlans.test.jsx`, `ActionPlan.test.jsx`, `eyesight-front/src/services/__tests__/demoApi.test.js` (acrescentar)

**Interfaces:**
- Consumes: as rotas da Task 2; `filters` do `SimpleOverview` (mesmas chaves de recorte do `useExplainer`).
- Produces: `usePlans(filters): { ready: boolean, planFor(action): Plan | null, stateFor(action): 'idle'|'generating'|'error'|'limit', errorFor(action): string, busy: boolean, generate(action, { regenerate? }): Promise<boolean>, toggle(planId, stepId, done): Promise<boolean>, reload(): void }`. `action` = `{ code, campaignId? }`. `<ActionPlan action plans available describedBy />` onde `plans` é o retorno de `usePlans` e `available` é o booleano do `useExplainer`.

- [ ] **Step 1: Escrever os testes que falham.**
  - `usePlans` (mock de `api`): carrega `GET /ia/planos` com só as chaves de recorte definidas; falha no `GET` deixa `ready` verdadeiro e `planFor` nulo; `generate` posta `{ action, regenerate }` com o recorte e `{ timeout: 55000 }` e guarda o plano; 429 → `stateFor` `'limit'` com o texto do servidor; outros erros → `'error'`; segunda geração enquanto uma roda não faz nova requisição (`busy`); `toggle` altera na hora, chama o `PATCH` e, em falha, reverte e define o erro "Não foi possível salvar. Tente de novo."; dois `toggle` seguidos no mesmo passo terminam com o último valor; mudar o recorte descarta planos e respostas atrasadas (resposta antiga não aparece); demo: usa o mesmo caminho sem tratamento especial (o `demoApi` responde).
  - `ActionPlan`: sem plano mostra "Ver passo a passo" (botão habilitado); `generating` mostra "Preparando os passos…" com `aria-disabled`; com plano mostra "2 de 4 passos feitos", caixas `checkbox` com rótulo igual ao texto, "Gerado em 08/10" e "Gerar de novo"; marcar chama `toggle(plan.id, step.id, true)`; todos marcados mostra "Tudo feito. Veja nos próximos dias se o resultado melhorou."; erro mostra a mensagem em `role="alert"` com "Tentar de novo"; limite mostra a mensagem sem "Tentar de novo"; `available=false` desabilita o botão de gerar com `aria-describedby`, mas as caixas de um plano existente continuam habilitadas; texto de passo com `<img src=x onerror=alert(1)>` não cria `img`; nada é renderizado para `refresh_data` e `nothing_urgent`.
  - `demoApi`: `GET /ia/planos` → `{ planos: [] }`; `POST /ia/planos` → plano com 3 passos fixos sem dígitos e `demo: true`; `PATCH /ia/planos/demo/passos/s1` → devolve o plano com o passo alterado e **não** escreve em `localStorage`; outros POST/PUT continuam bloqueados.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `cd eyesight-front && npx vitest run src/components/plans src/services/__tests__/demoApi.test.js`
  Expected: FAIL (módulos inexistentes e casos novos do demo).

- [ ] **Step 3: Implementar.** `usePlans` segue os padrões do `useExplainer` (identificador por requisição para ignorar respostas antigas, guarda de envio simultâneo por ref lida só em handlers, recorte serializado como chave, descarte ao mudar o recorte sem `setState` síncrono em efeito). `ActionPlan` usa `<input type="checkbox">` nativo e `aria-disabled` (não `disabled`) nos botões durante a geração para não perder o foco do teclado; datas formatadas em pt-BR (`dd/mm`). Estilos `.pl-*` em `Plans.css` com variantes `body.light-mode`. No `demoApi`, os planos de exemplo vivem em memória do módulo.

- [ ] **Step 4: Rodar e ver passar**
  Run: `cd eyesight-front && npx vitest run src/components/plans src/services/__tests__/demoApi.test.js`
  Expected: PASS.

- [ ] **Step 5: Suíte e lint**
  Run: `cd eyesight-front && npx vitest run && npm run lint`
  Expected: sem falhas e sem erros de lint.

---

### Task 4: Integração na Visão geral e verificação final

**Files:**
- Modify: `eyesight-front/src/components/overview/NextActions.jsx`, `eyesight-front/src/components/overview/SimpleOverview.jsx`
- Test: `eyesight-front/src/components/overview/__tests__/NextActions.test.jsx`, `SimpleOverview.test.jsx`, `eyesight-front/src/pages/__tests__/DashboardDemo.test.jsx`

**Interfaces:**
- Consumes: `usePlans`, `ActionPlan` (Task 3); `useExplainer().available` (fase A).
- Produces: prop opcional `plans` (retorno de `usePlans`) e `aiAvailable` em `NextActions`.

- [ ] **Step 1: Escrever os testes que falham.**
  - `NextActions`: sem a prop `plans` não há nenhum botão de plano (HTML igual ao atual); com `plans`, as ações elegíveis mostram "Ver passo a passo" e `refresh_data`/`nothing_urgent` não; o botão "Explicar" continua presente quando `explain` é passado.
  - `SimpleOverview` (mock de `api` com `get` roteado por URL: `/ia/status`, `/ia/planos`): ação elegível mostra "Ver passo a passo"; clicar posta `/ia/planos` com a ação e o recorte e mostra os passos; marcar um passo chama o `PATCH`; com `/ia/planos` falhando a Visão geral continua com veredito, cartões e ações, sem área de planos; mudar `filters` recarrega `GET /ia/planos`.
  - `DashboardDemo`: no demo é possível gerar o passo a passo de exemplo e marcar um passo sem erro.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `cd eyesight-front && npx vitest run src/components/overview src/pages/__tests__/DashboardDemo.test.jsx`
  Expected: FAIL nos casos novos; os existentes passam.

- [ ] **Step 3: Implementar.** `SimpleOverview` cria `usePlans(filters)` ao lado de `useExplainer(filters)` e repassa `plans` e `aiAvailable` a `NextActions`; `NextActions` renderiza `<ActionPlan>` abaixo do texto das ações elegíveis. Importar `Plans.css`.

- [ ] **Step 4: Rodar e ver passar**
  Run: `cd eyesight-front && npx vitest run src/components/overview src/pages/__tests__/DashboardDemo.test.jsx`
  Expected: PASS.

- [ ] **Step 5: Verificação final do conjunto**
  Run: `cd eyesight-backend && npm test`, depois `cd eyesight-front && npx vitest run && npm run lint && npm run build && rm -rf dist`
  Expected: backend e frontend sem falhas, lint limpo, build ok; `AnalyticsWorkspace.test.jsx` continua provando que o modo sem `overview` não mudou.

- [ ] **Step 6: Banco (pedir ao usuário, não executar sozinho).** Mostrar o conteúdo de `scripts/plans-additions.sql` ao usuário e perguntar se pode aplicá-lo. Só com "pode aplicar" expresso: aplicar com a ferramenta `apply_migration` do plugin Supabase (projeto "Eyesight"), depois conferir com `list_tables` que `public.planos_acao` existe com RLS ligado e `get_advisors` sem novo alerta de segurança. Registrar no ledger se foi aplicado ou ficou pendente.

- [ ] **Step 7: Verificação manual (registrar no ledger como pendente para o usuário):** gerar um plano real com a chave do Gemini, marcar passos, recarregar a página, trocar o filtro de período e voltar, temas claro e escuro, teclado e largura de 360px.
