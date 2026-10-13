# Rotina diária e resumo semanal por e-mail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma rotina diária sincroniza em segundo plano as contas conectadas e, de segunda a quarta, envia o resumo semanal por e-mail a quem ligou a opção.

**Architecture:** `POST /jobs/diario` (protegida por segredo, chamada pelo `pg_cron`/`pg_net` do Supabase) dispara `services/dailyRoutine.js`, que recebe suas dependências por parâmetro para ser testável. O e-mail é montado por funções puras (`summaryEmail`, `summaryCopy`) e enviado pelo Resend. A tabela `rotina_envios` impede duplicidade; o token assinado de `unsubscribeToken` alimenta a página pública de cancelamento no frontend.

**Tech Stack:** Express, Prisma/Postgres (Supabase), zod, Resend, `node --test`; React 18, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-08-rotina-diaria-resumo-semanal-design.md`

## Global Constraints

- Idioma de interface e e-mail: pt-BR, linguagem simples. Texto vindo de fora (nome do usuário, nome de campanha) é escapado no HTML do e-mail e renderizado como texto no frontend.
- Constantes (em `services/dailyRoutine.js`): `MAX_USERS = 50`, `MAX_RUN_MS = 8 * 60 * 1000`, `SYNC_PERIOD = 'last_30d'`, `SUMMARY_DAYS = [1, 2, 3]` (segunda=1 … domingo=7, no fuso `REPORT_TIME_ZONE`, padrão `America/Sao_Paulo`), `SUMMARY_KIND = 'weekly_summary'`. Resumo usa `periodo: 'last_7d'`.
- Opt-in: `usuarios.preferences.summary.weekly === true` é a única condição para o job enviar. O envio de teste vai só ao e-mail da própria conta (`req.usuario.email`).
- Sem `JOBS_SECRET`: rota do job responde 503. Sem `UNSUBSCRIBE_SECRET`: nenhum resumo é enviado nem montado. Segredos comparados em tempo constante. Logs do job nunca contêm e-mail, nome, tokens nem segredos.
- O link de cancelamento só cancela com `POST` disparado por clique no botão; abrir o link (GET) nunca altera dados.
- `preferences` é mesclado de forma rasa em `PUT /auth/me` (`{...atual, ...novo}`): enviar `{ summary: { weekly } }` substitui só a chave `summary`.
- Mesmo padrão de segurança das tabelas existentes: RLS ligado e `REVOKE ALL ... FROM anon, authenticated`.
- **Nunca aplicar SQL, ativar extensão ou criar agendamento no Supabase real sem autorização expressa do usuário naquele momento.** As tarefas 1-4 só escrevem arquivos; a aplicação é um passo à parte da Tarefa 5.
- O projeto não é repositório git: passos de commit são ignorados; o ledger fica em `scratchpad/progress-routine.md`.
- Comandos: backend `cd eyesight-backend && npm test`; frontend `cd eyesight-front && npx vitest run`, `npm run lint`, `npm run build` (apagar `dist/` depois). Execuções longas podem passar de 2 minutos: rode em segundo plano e leia o resultado.

## Review Focus

1. E-mail duplicado ou perdido: duas rodadas simultâneas, repetição na mesma semana, envio que falha (a reserva é apagada e a próxima rodada tenta de novo), e usuário que liga o resumo no meio da semana.
2. Fronteira de semana e de dia no fuso do Brasil: às 02:00 UTC de uma segunda ainda é domingo em Brasília, e a rodada das 12:00 UTC é 09:00 em Brasília. A chave `2026-W41` e o dia da semana devem vir do fuso configurado (`REPORT_TIME_ZONE`), nunca do UTC nem do fuso do servidor.
3. Cancelamento: token adulterado, expirado ou de outro usuário nunca escreve; abrir o link sem clicar não cancela; cancelar duas vezes é inofensivo; outras preferências (tema, onboarding) sobrevivem.
4. Conteúdo do e-mail: nome de campanha ou de usuário com HTML/`&`, moeda `UNKNOWN`, período sem comparação, veredito `insufficient`.
5. Falha parcial da rotina: uma conta que exige reconexão, um usuário sem e-mail ou uma plataforma fora do ar não podem interromper a rodada nem vazar detalhes nos logs.

---

### Task 1: Peças puras do e-mail, token, relógio e preferências

**Files:**
- Create: `eyesight-backend/src/services/summaryCopy.js`, `summaryEmail.js`, `unsubscribeToken.js`, `routineClock.js`, `eyesight-backend/scripts/routine-additions.sql`
- Modify: `eyesight-backend/src/config/env.js`, `eyesight-backend/src/validators/authValidator.js`, `eyesight-backend/src/services/emailService.js`, `eyesight-backend/prisma/schema.prisma`
- Test: `eyesight-backend/src/test/summaryEmail.test.js`, `unsubscribeToken.test.js`, `routineClock.test.js`, `authValidator.test.js` (acrescentar), `emailService.test.js` (novo)

**Interfaces:**
- Produces em `env.js`: `env.jobsSecret`, `env.unsubscribeSecret`, `env.backendUrl` (`BACKEND_URL` ou `RENDER_EXTERNAL_URL`, sem barra final; pode ser `undefined`).
- Produces em `routineClock.js`: `weekdayOf(date, timeZone?): 1..7` (segunda=1) e `weekKey(date, timeZone?): string` no formato `AAAA-Wss` (semana ISO calculada na data local do fuso; padrão `process.env.REPORT_TIME_ZONE || 'America/Sao_Paulo'`).
- Produces em `unsubscribeToken.js`: `createUnsubscribeToken(userId: number, { now = new Date(), secret = env.unsubscribeSecret } = {}): string` (lança se não há segredo); `verifyUnsubscribeToken(token: unknown, { now, secret }): number | null`. Formato `v1.<base64url(userId.exp)>.<base64url(hmac)>`, HMAC-SHA256 sobre `unsubscribe:v1:<userId>.<exp>`, validade 400 dias, `timingSafeEqual`.
- Produces em `summaryEmail.js`: `buildSummaryEmail({ name: string, analytics, appUrl: string, unsubscribeUrl: string }): { subject: string, html: string, text: string }` (função pura; `analytics` é o resultado de `getAnalytics` com `verdict`).
- Produces em `emailService.js`: `enviarResumoSemanal({ to, subject, html, text, unsubscribeUrl, unsubscribePostUrl? }): Promise<void>` — envia pelo Resend com `headers: { 'List-Unsubscribe': '<url>' }` e, quando há `unsubscribePostUrl`, `'List-Unsubscribe': '<postUrl>'` e `'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'`; sem `RESEND_API_KEY` lança `Error('RESEND_API_KEY não configurada.')`. Para testar sem rede, o cliente Resend é criado por uma função `getResend()` exportada e substituível (`setResendClient(client)` apenas para testes).

- [ ] **Step 1: Escrever os testes que falham.**
  - `routineClock.test.js`: `weekdayOf(new Date('2026-10-05T12:00:00Z'))` = 1 (segunda 5/10/2026); `new Date('2026-10-05T02:00:00Z')` ainda é domingo 4/10 em Brasília (= 7) mas segunda em UTC; `weekKey` para 2026-10-05 = `'2026-W41'`; virada de ano (`2026-12-31` e `2027-01-01` → semana ISO correta, por exemplo `2026-W53`); `timeZone: 'UTC'` explícito muda o resultado do caso das 02:00Z.
  - `unsubscribeToken.test.js`: round-trip devolve o `userId`; um caractere alterado na assinatura, no payload, `v2.` no prefixo, partes a menos, `null`/número/string vazia → `null`; token vencido (`now` 401 dias depois) → `null`; válido 399 dias depois; outro segredo → `null`; `create` sem segredo lança.
  - `summaryEmail.test.js` (fixtures de `analytics` com `verdict`, `period`, `currency`, `totals`): assunto por status (`good`, `stable`, `attention`, `insufficient` conforme a spec); corpo traz saudação com o nome, status com texto, os 4 rótulos ("Você investiu", "Pessoas que clicaram", "Resultados", "Custo por resultado"), comparação "N% mais/menos que os 7 dias anteriores" só com `currentComplete && previousComplete`; até 3 ações; botão com `appUrl` + `/app`; link de cancelamento e o rodapé com o período; moeda `UNKNOWN` sem símbolo/valor em dinheiro e com aviso; `text` não contém `<`; nome `<img src=x onerror=alert(1)>` e campanha `A & B` aparecem escapados em `html` e crus em `text`; `unsubscribeUrl` com `&` é escapado no atributo.
  - `emailService.test.js`: com cliente falso, `enviarResumoSemanal` chama `emails.send` com `from`, `to`, `subject`, `html`, `text` e `headers` (com e sem `unsubscribePostUrl`); `error` retornado pelo Resend → lança; sem chave → lança a mensagem acima.
  - `authValidator.test.js`: `preferences: { summary: { weekly: true } }` aceito; `summary: { weekly: 'sim' }`, `summary: {}` com chave extra e `summary: { weekly: true, x: 1 }` rejeitados; `theme` e `onboarding` continuam aceitos.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `cd eyesight-backend && node --experimental-test-module-mocks --test src/test/routineClock.test.js src/test/unsubscribeToken.test.js src/test/summaryEmail.test.js src/test/emailService.test.js src/test/authValidator.test.js`
  Expected: FAIL (módulos inexistentes e casos novos do validador).

- [ ] **Step 3: Implementar.**
  - `env.js`: `jobsSecret: process.env.JOBS_SECRET`, `unsubscribeSecret: process.env.UNSUBSCRIBE_SECRET`, `backendUrl` conforme acima.
  - `routineClock.js`: usar `Intl.DateTimeFormat('sv-SE', { timeZone })` para a data local (como `dateRange.js`) e calcular a semana ISO sobre essa data, sem depender do fuso do servidor.
  - `unsubscribeToken.js` conforme a assinatura acima.
  - `summaryCopy.js`: frase por status, texto das 7 ações e rótulos dos 4 números, **copiados de** `eyesight-front/src/utils/verdictCopy.js` (frases com `previousLabel` de 7 dias); comentário no topo apontando para o arquivo do frontend e o inverso no `verdictCopy.js`.
  - `summaryEmail.js`: HTML em tabelas com estilos inline, texto escuro sobre fundo claro, sem imagens nem pixel de rastreio; função local `escapeHtml`; `text` em texto puro. Valores em dinheiro com `Intl.NumberFormat('pt-BR', { style: 'currency', currency })`.
  - `emailService.js`: `enviarResumoSemanal`, `getResend()`/`setResendClient()`; manter `enviarEmailVerificacao` como está.
  - `authValidator.js`: adicionar `summary: z.object({ weekly: z.boolean() }).strict().optional()` ao objeto estrito de `preferences`.
  - `routine-additions.sql` (exatamente):

```sql
CREATE TABLE IF NOT EXISTS public.rotina_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL,
  kind varchar(30) NOT NULL,
  period_key varchar(10) NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rotina_envios_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(pk_id_usuario) ON DELETE CASCADE,
  CONSTRAINT rotina_envios_user_kind_period_key UNIQUE (user_id, kind, period_key)
);
ALTER TABLE public.rotina_envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rotina_envios FROM anon, authenticated;
```

  Modelo Prisma `rotina_envios` equivalente (`@@unique([user_id, kind, period_key])`, relação `user usuarios ... onDelete: Cascade`, `rotinas rotina_envios[]` em `usuarios`); depois `npx prisma validate` e `npx prisma generate` (não tocam o banco).

- [ ] **Step 4: Rodar e ver passar**
  Run: o mesmo comando do Step 2.
  Expected: PASS.

- [ ] **Step 5: Suíte do backend**
  Run: `cd eyesight-backend && npm test`
  Expected: PASS sem falhas.

---

### Task 2: Rodada diária e rota do job

**Files:**
- Create: `eyesight-backend/src/services/dailyRoutine.js`, `eyesight-backend/src/services/userEmail.js`, `eyesight-backend/src/controllers/jobsController.js`, `eyesight-backend/src/routes/jobsRoutes.js`
- Modify: `eyesight-backend/src/server.js` (montar `/jobs`)
- Test: `eyesight-backend/src/test/dailyRoutine.test.js`, `eyesight-backend/src/test/jobsRoutes.test.js`

**Interfaces:**
- Consumes: `weekdayOf`, `weekKey` (Task 1); `buildSummaryEmail`, `createUnsubscribeToken`, `enviarResumoSemanal`; `syncMetaAccount`, `syncGoogleAccount` (`platformSyncService.js`); `getAnalytics`; `resolveDateRange`.
- Produces em `userEmail.js`: `findUserEmail(authUserId: string): Promise<string | null>` (`prisma.$queryRaw` em `auth.users`).
- Produces em `dailyRoutine.js`: `runDailyRoutine({ now?: Date, deps?: Deps }): Promise<{ synced: number, sent: number, skipped: number, errors: number }>` onde `Deps = { listUsersToSync(limit): Promise<{ id: number, platforms: ('meta'|'google')[] }[]>, syncAccount(userId, platform, range): Promise<unknown>, listOptedInUsers(): Promise<{ id: number, name: string, authUserId: string }[]>, claim(userId, kind, periodKey): Promise<boolean>, release(userId, kind, periodKey): Promise<void>, getAnalytics(userId, query): Promise<object>, findEmail(authUserId): Promise<string | null>, send(message): Promise<void>, now?: () => number }`; as dependências reais são o padrão. Exporta as constantes da seção Global Constraints.
- Produces em `jobsController.js`: `runDaily(req, res)`; em `jobsRoutes.js`: `POST /jobs/diario`.

- [ ] **Step 1: Escrever os testes que falham.**
  - `dailyRoutine.test.js` (todas as dependências falsas e `now` fixo):
    - **sync:** chama `syncAccount` para cada plataforma de cada usuário com `resolveDateRange({ periodo: 'last_30d' })`; um erro numa conta é contado em `errors` e a rodada continua com os demais; respeita `MAX_USERS` (pede `limit = 50` a `listUsersToSync`) e para quando `now()` ultrapassa `MAX_RUN_MS`; a ordem dada por `listUsersToSync` é respeitada.
    - **resumo:** em segunda-feira (`2026-10-05T12:00:00Z`) envia a cada usuário optado com `claim` verdadeiro; em quinta-feira não envia; terça e quarta enviam (reenvio); `claim` falso → não envia e conta como pulado; `send` falhando → `release` chamado e `errors` incrementado, sem interromper os demais; sem e-mail → `release` e pulado; `analytics.hasData` falso ou `verdict` nulo → `release` e pulado; o `period_key` passado a `claim` é o de `weekKey(now)` no fuso do Brasil (caso 2026-10-05T02:00:00Z ainda é domingo → não envia); a mensagem enviada leva `to` do `findEmail`, `subject` e `html` contendo o nome escapado e o link de cancelamento com token válido (`verifyUnsubscribeToken` devolve o `userId`); `getAnalytics` é chamado com `{ periodo: 'last_7d' }`; sem `UNSUBSCRIBE_SECRET` nada é enviado (pulado, com um aviso no log sem dados pessoais); o log da rodada não contém o e-mail nem o nome (capturar `console.log/warn/error`).
  - `jobsRoutes.test.js`: sem `JOBS_SECRET` → 503; sem cabeçalho ou valor errado → 401; correto → 202 `{ iniciado: true }` e `runDailyRoutine` chamado uma vez (módulo mockado); segunda chamada enquanto a primeira não terminou → 409; depois de terminar volta a aceitar; uma exceção em `runDailyRoutine` é capturada (não derruba o processo) e libera a flag.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `cd eyesight-backend && node --experimental-test-module-mocks --test src/test/dailyRoutine.test.js src/test/jobsRoutes.test.js`
  Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar.** `dailyRoutine.js` com as dependências reais como padrão:
  - `listUsersToSync(limit)`: `prisma.$queryRaw` com `usuarios JOIN contas_vinculadas LEFT JOIN campanhas`, `GROUP BY` usuário, `array_agg(DISTINCT plataforma)`, `ORDER BY MAX(c.sincronizado_em) ASC NULLS FIRST LIMIT limit`.
  - `listOptedInUsers()`: `prisma.usuarios.findMany({ where: { contas: { some: {} } } })` filtrando em JS por `preferences?.summary?.weekly === true`.
  - `claim` insere em `rotina_envios` ignorando conflito de unicidade (devolve `true` se inseriu); `release` apaga a linha.
  - `send` monta `unsubscribeUrl = ${env.frontendUrl}/cancelar-resumo?t=<token>` e, se `env.backendUrl`, `unsubscribePostUrl = ${env.backendUrl}/resumo/cancelar?t=<token>`.
  - `jobsController.js`: valida `Authorization: Bearer` com `crypto.timingSafeEqual` (comparando hashes SHA-256 dos dois valores para tamanhos iguais), flag `running` no módulo, responde `202` e executa `runDailyRoutine()` sem aguardar, capturando erros e liberando a flag; `server.js` monta `app.use('/jobs', jobsRoutes)`.

- [ ] **Step 4: Rodar e ver passar**
  Run: o mesmo comando do Step 2.
  Expected: PASS.

- [ ] **Step 5: Suíte do backend**
  Run: `cd eyesight-backend && npm test`
  Expected: PASS sem falhas.

---

### Task 3: Rotas do resumo (teste e cancelamento)

**Files:**
- Create: `eyesight-backend/src/controllers/resumoController.js`, `eyesight-backend/src/routes/resumoRoutes.js`
- Modify: `eyesight-backend/src/server.js` (montar `/resumo`)
- Test: `eyesight-backend/src/test/resumoRoutes.test.js`

**Interfaces:**
- Consumes: `buildSummaryEmail`, `createUnsubscribeToken`, `verifyUnsubscribeToken`, `enviarResumoSemanal` (Task 1); `getAnalytics`; `prisma`.
- Produces: `enviarTeste(req, res)` (`POST /resumo/teste`, autenticada, 3 por hora por usuário, `keyGenerator` pelo `id` do usuário) e `cancelar(req, res)` (`POST /resumo/cancelar`, pública, limitada por IP); respostas `{ mensagem }` ou `{ erro }`.

- [ ] **Step 1: Escrever os testes que falham.** Chamando os handlers diretamente com `getAnalytics`, `enviarResumoSemanal` e `prisma` mockados:
  - `enviarTeste`: envia para `req.usuario.email` (e para ninguém mais), com `getAnalytics(userId, { periodo: 'last_7d' })`; responde 200 `{ mensagem }`; não usa `rotina_envios`; funciona com o resumo desligado; sem `analytics.hasData` ou sem veredito → 409; `RESEND_API_KEY` ausente (erro do serviço) ou `UNSUBSCRIBE_SECRET` ausente → 503; falha do envio → 502.
  - `cancelar`: token válido no corpo (`{ token }`) → executa a atualização do JSON só do `userId` do token, responde 200; token na query `t` também funciona (cabeçalho de clique único); token adulterado, expirado, ausente, número → 400 e **nenhuma** escrita; chamado duas vezes → 200 nas duas; a atualização preserva as demais chaves de `preferences` (verificar o SQL/valor passado: usa `||` com `jsonb_build_object('summary', jsonb_build_object('weekly', false))` sobre `COALESCE(preferences, '{}'::jsonb)`).
  - Montagem em `resumoRoutes.js`: `POST /teste` passa por `authMiddleware` e por limite de 3/hora; `POST /cancelar` é pública (teste lendo a pilha do router).

- [ ] **Step 2: Rodar e ver falhar**
  Run: `cd eyesight-backend && node --experimental-test-module-mocks --test src/test/resumoRoutes.test.js`
  Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar** os dois handlers e as rotas; `cancelar` usa `prisma.$executeRaw` com `UPDATE usuarios SET preferences = COALESCE(preferences, '{}'::jsonb) || jsonb_build_object('summary', jsonb_build_object('weekly', false)) WHERE pk_id_usuario = ${userId}`. Erros retornam mensagens genéricas em pt-BR, sem vazar detalhes internos.

- [ ] **Step 4: Rodar e ver passar**
  Run: o mesmo comando do Step 2.
  Expected: PASS.

- [ ] **Step 5: Suíte do backend**
  Run: `cd eyesight-backend && npm test`
  Expected: PASS sem falhas.

---

### Task 4: Frontend

**Files:**
- Create: `eyesight-front/src/components/summary/SummarySettings.jsx`, `eyesight-front/src/pages/CancelSummary.jsx`, `eyesight-front/src/styles/Summary.css`
- Modify: `eyesight-front/src/pages/Profile.jsx`, `eyesight-front/src/components/OnboardingCard.jsx`, `eyesight-front/src/App.jsx` (rota pública `/cancelar-resumo`)
- Test: `eyesight-front/src/components/summary/__tests__/SummarySettings.test.jsx`, `eyesight-front/src/pages/__tests__/CancelSummary.test.jsx`, `eyesight-front/src/components/__tests__/OnboardingCard.test.jsx` e `eyesight-front/src/pages/__tests__/Profile.test.jsx` (acrescentar)

**Interfaces:**
- Consumes: `POST /resumo/teste`, `POST /resumo/cancelar` (Task 3); `PUT /auth/me` com `{ nome, preferences: { summary: { weekly } } }`; `profile.preferences.summary.weekly`.
- Produces: `<SummarySettings weekly={boolean} nome={string} onChange?={(boolean)=>void} />` e `CancelSummary` (página).

- [ ] **Step 1: Escrever os testes que falham.**
  - `SummarySettings` (mock de `api` com `put`/`post`): caixa "Receber o resumo semanal" reflete `weekly`; marcar chama `api.put('/auth/me', { nome, preferences: { summary: { weekly: true } } })` e mostra "Resumo semanal ligado." em `role="status"`; desmarcar mostra "desligado."; falha no `put` reverte a caixa e mostra uma mensagem de erro em `role="alert"`; "Enviar um exemplo para mim" chama `api.post('/resumo/teste')` e mostra "Enviamos um exemplo para o e-mail da sua conta."; 429 mostra o limite; 503 mostra "O envio de e-mail ainda não está configurado."; 409 mostra que ainda não há dados; outro erro mostra "Tentar de novo" que repete a chamada; durante o envio o botão fica com `aria-disabled`; no demo (`localStorage['eyesight-demo']='1'`) caixa e botão desabilitados com "Indisponível na demonstração" e nenhuma chamada.
  - `CancelSummary` (rota com `?t=abc`, mock de `api.post`): mostra "Parar de receber o resumo semanal?" e **não** chama a API ao montar; clicar em "Parar de receber" chama `api.post('/resumo/cancelar', { token: 'abc' })` e mostra "Pronto. Você não receberá mais o resumo semanal. Para voltar a receber, ligue em Meu perfil."; 400 ou erro de rede mostram "Este link não é válido ou expirou. Entre no app e desligue o resumo em Meu perfil."; sem `t` na URL mostra o mesmo aviso e nenhum botão de cancelar; existe `main` com `h1` e o link "Voltar ao início".
  - `OnboardingCard`: com o primeiro resultado e `summary.weekly` desligado aparece "Quer receber um resumo toda segunda-feira?" com "Ligar o resumo semanal"; clicar chama `api.put('/auth/me', { nome, preferences: { summary: { weekly: true } } })` e mostra "Resumo ligado. Você pode desligar em Meu perfil."; não aparece se já estiver ligado nem antes do primeiro resultado; o restante do cartão e os testes existentes não mudam.
  - `Profile`: a seção "Resumo semanal por e-mail" é renderizada com o valor do perfil.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `cd eyesight-front && npx vitest run src/components/summary src/pages/__tests__/CancelSummary.test.jsx src/components/__tests__/OnboardingCard.test.jsx src/pages/__tests__/Profile.test.jsx`
  Expected: FAIL nos casos novos; os existentes passam.

- [ ] **Step 3: Implementar** seguindo a spec: caixa nativa e botão de 44px com `aria-disabled` durante o envio; `Summary.css` com variantes para `body.light-mode`; página pública sem `RotaProtegida`, com `<main>`; textos exatamente como nos testes.

- [ ] **Step 4: Rodar e ver passar**
  Run: o mesmo comando do Step 2.
  Expected: PASS.

- [ ] **Step 5: Suíte e lint**
  Run: `cd eyesight-front && npx vitest run && npm run lint`
  Expected: sem falhas e sem erros de lint.

---

### Task 5: Verificação final, banco, agendamento e envio real

- [ ] **Step 1: Verificação do conjunto.**
  Run: `cd eyesight-backend && npm test`, depois `cd eyesight-front && npx vitest run && npm run lint && npm run build && rm -rf dist`
  Expected: backend e frontend sem falhas, lint limpo, build ok.

- [ ] **Step 2: Variáveis de ambiente (explicar ao usuário, não executar).** Gerar dois valores aleatórios (por exemplo `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) para `JOBS_SECRET` e `UNSUBSCRIBE_SECRET`, orientar o usuário a colocá-los no `.env` local e no painel do Render (sem imprimi-los no chat se o usuário preferir gerá-los sozinho), além de `RESEND_API_KEY` e, para enviar a outros destinatários, verificar um domínio no Resend e ajustar `EMAIL_FROM`. Atualizar `scripts/check-env.mjs` com o grupo "Rotina e resumo" (`JOBS_SECRET`, `UNSUBSCRIBE_SECRET`, `RESEND_API_KEY`).

- [ ] **Step 3: Banco (pedir ao usuário, não executar sozinho).** Mostrar `scripts/routine-additions.sql` e perguntar se pode aplicar. Só com "pode aplicar" expresso: `apply_migration` do plugin Supabase (projeto "Eyesight"), depois conferir com `list_tables` que `public.rotina_envios` existe com RLS ligado e `get_advisors` (segurança) sem alerta novo além do informativo de "RLS sem política".

- [ ] **Step 4: Teste de leitura da consulta de e-mail (somente leitura).** Com o plugin, rodar `SELECT count(*) FROM auth.users` ou equivalente somente leitura para confirmar que o esquema `auth` é legível pela conexão do backend (a consulta real do backend é a de `findUserEmail`); registrar o resultado.

- [ ] **Step 5: Agendamento (pedir ao usuário, não executar sozinho).** Mostrar o SQL que: ativa `pg_cron` e `pg_net`, guarda `JOBS_SECRET` no Vault e cria dois agendamentos diários em UTC — `GET <BACKEND_URL>/health` às 11:55 e `POST <BACKEND_URL>/jobs/diario` às 12:00 com `Authorization: Bearer <segredo do Vault>`. Precisa da URL pública do backend no Render (perguntar ao usuário). Só aplicar com "pode aplicar" expresso e sem imprimir o segredo.

- [ ] **Step 6: Envio real de teste.** Com `RESEND_API_KEY` e os segredos configurados, pedir ao usuário que use "Enviar um exemplo para mim" em Meu perfil (ou chamar `POST /resumo/teste` com a sessão dele) e conferir o e-mail: assunto, conteúdo, link de cancelar. Registrar no ledger como pendente caso falte alguma chave.

- [ ] **Step 7: Verificação manual (registrar no ledger como pendente para o usuário):** ligar e desligar o resumo, abrir o link de cancelamento sem clicar e depois clicando, temas claro e escuro, teclado e largura de 360px, e uma rodada real do job (`POST /jobs/diario` com o segredo) observando o log.
