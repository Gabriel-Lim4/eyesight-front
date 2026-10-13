# Dashboard em linguagem simples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Visão geral mostra um veredito, 4 números em linguagem simples, recomendações e metas; a análise atual fica recolhida em "Ver análise completa".

**Architecture:** Um módulo puro `verdictService.js` (back) calcula `verdict` a partir do resultado de `getAnalytics` e o devolve como campo aditivo, em códigos+parâmetros. O front transforma códigos em frases (`verdictCopy.js`) e renderiza componentes pequenos, plugados no `AnalyticsWorkspace` por uma prop opcional `overview` (sem a prop, nada muda). O modo demo ganha um `demoVerdict` reduzido.

**Tech Stack:** Express + `node --test` (back, `eyesight-backend`); React 18 + Vite + Vitest/Testing Library + lucide-react (front, `eyesight-front`).

**Spec:** `docs/superpowers/specs/2026-10-08-dashboard-linguagem-simples-design.md`

## Global Constraints

- Textos de interface em **pt-BR**, exatamente os da seção 4.2 da spec (os testes usam as frases literais).
- Constantes do veredito (exportadas de `verdictService.js` como `LIMITS`): `STABLE_BAND_PCT: 5`, `MIN_CLICKS: 30`, `MIN_IMPRESSIONS_FOR_CTR: 100`, `BUDGET_NEAR_RATIO: 0.8`, `WASTED_SPEND_SHARE: 0.2`, `STALE_HOURS: 24`, `MAX_ACTIONS: 3`, `NAME_MAX: 80`. Fronteiras de ±5% **inclusivas** para melhor/pior (`<= -5` bom, `>= 5` atenção, entre eles estável).
- **Sem benchmarks de mercado**: nenhuma faixa genérica de CTR/CPC/CPM.
- O back só **acrescenta** `verdict` à resposta de `/metricas/analytics`; nenhum campo existente muda. Nenhuma alteração em rotas, controllers, `schema.prisma`, validadores ou rate limits.
- Sem a prop `overview`, `AnalyticsWorkspace` mantém DOM e comportamento atuais (os testes de `Meta.test.jsx` e `AnalyticsWorkspace.test.jsx` seguem passando sem edição).
- Acessibilidade: estado sempre com **ícone + texto** (nunca só cor); região do veredito com título e `aria-live="polite"`; contraste ≥ 4,5:1 do texto sobre o fundo do cartão nos temas escuro e claro (definir cores de status em `Overview.css` com valores para `body.light-mode`); áreas de toque ≥ 44 px; `<details>` nativo.
- Textos de dados vindos das plataformas (nomes de campanha) são renderizados **sempre como texto** (nunca HTML) e cortados em 80 caracteres no back.
- ESLint do front tem `react-hooks/set-state-in-effect` e `react-hooks/refs`: siga o padrão de `Account.jsx` (comentário `eslint-disable-next-line` em efeitos de carga) e não leia/escreva `ref.current` durante o render.
- Este diretório **não é um repositório git**; os passos "Commit" só valem após um `git init`, senão pule-os. Dependências já instaladas (`npm ci`) em ambos os projetos.
- Comandos de teste: back `cd eyesight-backend && node --experimental-test-module-mocks --test src/test/<arquivo>` (suíte: `npm test`); front `cd eyesight-front && npx vitest run <arquivo>` (suíte: `npx vitest run`; lint: `npm run lint`).

## Review Focus

Condições que a spec implica e que um usuário real pode encontrar (cada uma tem teste na tarefa dona):

1. Poucos cliques (< 30) **não** gera julgamento de custo, mas orçamento estourado ainda vira `attention` (Task 1).
2. Conversões `null` (não medidas) e `0` (medidas, sem resultado) têm tratamento e texto diferentes (Task 1, Task 5).
3. Campos ausentes/`NaN` nunca produzem "NaN" na tela nem derrubam a resposta: falha vira `verdict: null` (Task 3, Task 9).
4. Nome de campanha com HTML aparece como texto e cortado em 80 caracteres (Task 2, Task 7).
5. Salvar metas recarrega o veredito; na demo o formulário fica desabilitado e a Visão geral funciona (Task 7, Task 10).

---

### Task 1: Back — motor de status do veredito

**Files:**
- Create: `eyesight-backend/src/services/verdictService.js`
- Test: `eyesight-backend/src/test/verdictService.test.js` (novo; `node:test` + `node:assert/strict`)

**Interfaces:**
- Produces:
  - `export const LIMITS` (constantes acima).
  - `export function buildVerdict(analytics, { now = new Date() } = {}): Verdict`, com `Verdict = { status, basis, indicator, insufficientReason, reasons: [{ code, params }], highlights: [], actions: [] }` (`highlights`/`actions` ficam `[]` até a Task 2).
  - `status ∈ 'good'|'stable'|'attention'|'insufficient'`; `basis ∈ 'goal'|'comparison'|'none'`; `indicator ∈ 'cpa'|'cpc'`; `insufficientReason ∈ null|'no_data'|'incomplete_period'|'zero_spend'|'low_volume'|'no_baseline'`.
  - Códigos de `reasons` e seus `params`: `cost_within_goal {value, goal}`, `cost_above_goal {value, goal}`, `cost_better|cost_worse|cost_stable {indicator, change, value}`, `budget_exceeded {spend, limit}`, `budget_near {spend, limit, percent}`, `ctr_below_min {ctr, min}`, `no_conversion_tracking {}`, `no_results_yet {}`.
- Entrada esperada (campos de `getAnalytics`): `totals`, `changes`, `currency`, `period`, `hasData`, `currentComplete`, `previousComplete`, `alertSettings`, `campaigns`, `lastSyncedAt`.

- [ ] **Step 1: Testes que falham.** No arquivo, um helper `analytics(overrides)` com base: `hasData: true, currentComplete: true, previousComplete: true, currency: 'BRL', period: { period: 'last_30d', days: 30 }, totals: { spend: 1000, clicks: 500, impressions: 50000, ctr: 1, conversions: 25, cpa: 40, cpc: 2, revenue: null }, changes: { cpa: -15, cpc: 0, clicks: 10, conversions: 5, spend: 2 }, campaigns: [], alertSettings: {}, lastSyncedAt: <1 h antes de now>` (mesclando `totals`, `changes` e `alertSettings` de forma rasa por chave). Casos:
  - **Comparação:** `changes.cpa = -15` → `status 'good'`, `basis 'comparison'`, `indicator 'cpa'`, `reasons[0]` deep-equal `{ code: 'cost_better', params: { indicator: 'cpa', change: -15, value: 40 } }`. Fronteiras: `-5` → `good`; `-4.99` → `stable` (`cost_stable`); `5` → `attention` (`cost_worse`); `4.99` → `stable`.
  - **Meta:** `cpaMax 50` (cpa 40) → `good`, `basis 'goal'`, razão `cost_within_goal {value:40, goal:50}`; `cpaMax 30` → `attention`, `cost_above_goal {value:40, goal:30}`; com meta e `changes.cpa -15`, a lista de `reasons` também contém `cost_better`, mas o `status` segue a meta (tanto com `cpaMax 50` quanto com `cpaMax 30`, este último continua `attention` mesmo com a comparação boa).
  - **Moeda `UNKNOWN`** com `cpaMax 30` e `changes.cpa -15` → `good`, `basis 'comparison'` (meta ignorada).
  - **Indicador `cpc`:** `totals.conversions null` (e `cpa null`) → `indicator 'cpc'`, `reasons` contém `{ code: 'no_conversion_tracking', params: {} }`, avaliação por `changes.cpc`; `conversions 0` → `no_results_yet`; `cpaMax` é ignorada quando o indicador é `cpc`.
  - **Insuficiente** (sempre `basis 'none'`): `hasData false` → `no_data`; `currentComplete false` → `incomplete_period`; `spend 0` → `zero_spend`; `clicks 29` → `low_volume` e `clicks 30` → avaliado normalmente; `previousComplete false` e `changes {}` sem meta → `no_baseline`; com `previousComplete false` mas **com** meta aplicável → `basis 'goal'` avalia normalmente.
  - **Orçamento:** `budgetMax 900`, `spend 1000` → `attention` com `budget_exceeded {spend:1000, limit:900}` **mesmo com `clicks: 10`** (baixo volume); `budgetMax 1250` (80%) → `budget_near {spend:1000, limit:1250, percent:80}` sem mudar o status; `budgetMax 1260` (79,4%) → sem `budget_near`; moeda `UNKNOWN` ignora orçamento.
  - **CTR:** `ctrMin 2` com `ctr 1`, `impressions 50000` → `attention` + `ctr_below_min {ctr:1, min:2}`; `impressions 99` → ignorado.
  - **Pior vence:** comparação boa (`cpa -15`) + `ctrMin 2` com `ctr 1` → `attention`; as razões de atenção vêm antes das demais na lista.
- [ ] **Step 2: Rodar e ver falhar.** Run (em `eyesight-backend`): `node --experimental-test-module-mocks --test src/test/verdictService.test.js` — Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar** `verdictService.js` seguindo as regras (a)–(d) da seção 3.2 da spec; funções pequenas e puras (`pickIndicator`, `attentionSignals`, `evaluateIndicator`) dentro do mesmo arquivo. Entrada malformada (por exemplo `totals` ausente) deve **lançar** (a captura é responsabilidade da Task 3).
- [ ] **Step 4: Rodar o teste** — Expected: PASS; depois `npm test` (suíte do back) — Expected: tudo verde.
- [ ] **Step 5: Commit** — `feat(back): motor de status do veredito`

---

### Task 2: Back — highlights e ações do veredito

**Files:**
- Modify: `eyesight-backend/src/services/verdictService.js`
- Test: `eyesight-backend/src/test/verdictService.test.js`

**Interfaces:**
- Consumes: `buildVerdict`, `LIMITS`, helper `analytics()` da Task 1.
- Produces (preenche campos que a Task 1 deixou vazios):
  - `verdict.highlights`: sempre 4 itens, nesta ordem, `{ key: 'spend'|'clicks'|'conversions'|'cost', value, change, trend, available }`; `trend ∈ 'better'|'worse'|'stable'|'neutral'|'unknown'`.
  - `verdict.actions`: 1 a `MAX_ACTIONS` itens `{ code, params, campaignId? }` com os códigos e params: `budget_exceeded {spend, limit}`, `campaign_over_goal {campaign, value, goal}`, `campaign_low_ctr {campaign, ctr, min}`, `campaign_without_results {campaign, spend}`, `enable_conversion_tracking {}`, `refresh_data {lastSyncedAt}`, `nothing_urgent {}`.
- Campanhas na entrada: `campaigns[i] = { id, name, metrics: { spend, impressions, clicks, ctr, conversions, cpa } }`.

- [ ] **Step 1: Testes que falham.**
  - **Highlights:** sempre 4, na ordem `spend, clicks, conversions, cost`; `spend.trend === 'neutral'` com qualquer `change`; `change null` → `unknown`; `|change| 4.99` → `stable`; `clicks +10` → `better`, `clicks -10` → `worse`; `conversions` idem; `cost` com `change -15` → `better` e `+15` → `worse`; `conversions.available === false` quando `totals.conversions` é `null`, `true` caso contrário; com indicador `cpc`, `cost.value === totals.cpc`; com `cpa`, `cost.value === totals.cpa`.
  - **Ações:** (i) `budget_exceeded` vem primeiro; (ii) `campaign_over_goal` escolhe a campanha com maior razão `cpa/cpaMax` e traz seu `campaignId`; `campaign_low_ctr` escolhe o menor CTR abaixo do mínimo com ≥ 100 impressões; (iii) `campaign_without_results` só quando `totals.conversions > 0`, a campanha tem `metrics.conversions === 0` e `spend >= 0.2 × totals.spend`, e escolhe a de maior gasto; (iv) `enable_conversion_tracking` só com `currentComplete` e `totals.conversions == null`; (v) `refresh_data` com `lastSyncedAt` 25 h antes do `now` injetado e **não** com 23 h; também quando `lastSyncedAt` é `null` e `hasData`; (vi) `nothing_urgent` quando nada se aplica (lista nunca vazia); (vii) com 4+ candidatas, devolve só as 3 de maior prioridade, na ordem acima; (viii) moeda `UNKNOWN` descarta `budget_exceeded` e `campaign_over_goal` (dependem de meta em dinheiro) e mantém `campaign_without_results`; (ix) nome de campanha com 120 caracteres vira exatamente 80 em `params.campaign`, e um nome `<img src=x onerror=alert(1)>` é preservado como texto bruto (a renderização segura é testada na Task 7).
- [ ] **Step 2: Rodar e ver falhar** — `node --experimental-test-module-mocks --test src/test/verdictService.test.js` — Expected: FAIL nos casos novos.
- [ ] **Step 3: Implementar** `buildHighlights(analytics, indicator)` e `buildActions(analytics, ctx)` no mesmo módulo; `buildVerdict` passa a preenchê-los.
- [ ] **Step 4: Rodar o teste e a suíte do back** — Expected: PASS / verde.
- [ ] **Step 5: Commit** — `feat(back): highlights e acoes do veredito`

---

### Task 3: Back — `verdict` na resposta de `getAnalytics`

**Files:**
- Modify: `eyesight-backend/src/services/analyticsService.js` (objeto retornado ao final de `getAnalytics`)
- Test: `eyesight-backend/src/test/analyticsService.test.js` (estender, reaproveitando os mocks existentes)
- Test: `eyesight-backend/src/test/analyticsVerdictFailure.test.js` (novo; mocka `../services/verdictService.js` para lançar)

**Interfaces:**
- Consumes: `buildVerdict(analytics)` (Tasks 1–2).
- Produces: `getAnalytics(...)` retorna os campos atuais **mais** `verdict: Verdict | null`.

- [ ] **Step 1: Testes que falham.**
  - Em `analyticsService.test.js`: com dados diários completos para o período e o anterior, `result.verdict` existe, `typeof result.verdict.status === 'string'`, `result.verdict.highlights` tem 4 itens; todos os campos pré-existentes (`totals`, `changes`, `alerts`, etc.) continuam presentes.
  - `analyticsVerdictFailure.test.js`: copia os mocks de banco do teste existente e faz `mock.module('../services/verdictService.js', { namedExports: { buildVerdict: () => { throw new Error('boom'); } } })`; `getAnalytics` **resolve** (não rejeita), `result.verdict === null` e `result.totals` etc. continuam corretos.
- [ ] **Step 2: Rodar e ver falhar** — `node --experimental-test-module-mocks --test src/test/analyticsService.test.js src/test/analyticsVerdictFailure.test.js` — Expected: FAIL.
- [ ] **Step 3: Implementar:** montar o objeto de retorno numa constante, calcular `verdict` em `try { buildVerdict(result) } catch { null }` e devolver `{ ...result, verdict }`.
- [ ] **Step 4: Rodar os dois arquivos e `npm test`** — Expected: verde.
- [ ] **Step 5: Commit** — `feat(back): verdict em /metricas/analytics`

---

### Task 4: Front — utilitários de formatação

**Files:**
- Create: `eyesight-front/src/utils/format.js`
- Modify: `eyesight-front/src/components/AnalyticsWorkspace.jsx` (remover a `format` local, importar)
- Test: `eyesight-front/src/utils/__tests__/format.test.js` (novo)

**Interfaces:**
- Produces (em `utils/format.js`):
  - `format(value, type = 'number', currency = 'BRL'): string` — a função atual, **movida sem alterar saída** (inclui o sufixo ` (moeda desconhecida)` para `money` + `UNKNOWN`).
  - `formatMoney(value, currency): string` — `null`/não finito → `'—'`; moeda `UNKNOWN` → número com 2 casas em pt-BR **sem sufixo**; demais moedas via `Intl` (`style: 'currency'`).
  - `formatPercent(value, digits = 1): string` — pt-BR com no máximo `digits` casas decimais e sufixo `%` (`maximumFractionDigits: digits`, sem zeros à direita); `null`/não finito → `'—'`.

- [ ] **Step 1: Testes que falham:** `format(1234.5, 'money', 'BRL')` → `'R$ 1.234,50'`; `format(10, 'money', 'UNKNOWN')` → `'10,00 (moeda desconhecida)'`; `format(null)` → `'—'`; `formatMoney(1234.5, 'BRL')` → `'R$ 1.234,50'`; `formatMoney(10, 'UNKNOWN')` → `'10,00'`; `formatMoney(undefined, 'BRL')` → `'—'`; `formatPercent(15)` → `'15%'`, `formatPercent(4.96)` → `'5%'`, `formatPercent(12.34)` → `'12,3%'`, `formatPercent(4.96, 0)` → `'5%'`, `formatPercent(NaN)` → `'—'`. (Espaço entre `R$` e o número é U+00A0: compare com `.replace(/\s/g, ' ')`.)
- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/utils/__tests__/format.test.js` — Expected: FAIL.
- [ ] **Step 3: Implementar** `format.js` (mover a lógica existente para `format`; novas funções com `toLocaleString('pt-BR')`) e trocar a definição local em `AnalyticsWorkspace.jsx` por `import { format } from '../utils/format'`.
- [ ] **Step 4: Rodar a suíte do front e o lint** — `npx vitest run` e `npm run lint` — Expected: tudo verde (os testes de Meta provam que a saída do `format` não mudou).
- [ ] **Step 5: Commit** — `refactor(front): extrai utilitarios de formatacao`

---

### Task 5: Front — textos do veredito (`verdictCopy.js`)

**Files:**
- Create: `eyesight-front/src/utils/verdictCopy.js`
- Test: `eyesight-front/src/utils/__tests__/verdictCopy.test.js` (novo)

**Interfaces:**
- Consumes: `formatMoney`, `formatPercent` (Task 4).
- Produces: `ctx = { currency: string, period: { period: string, days: number } }`.
  - `previousLabel(period): string` — `last_7d|last_30d|last_90d` → `` `os ${period.days} dias anteriores` ``; qualquer outro → `'o período anterior'` (usado em "melhores que …" e "15% menos que …").
  - `previousLabelTo(period): string` — mesmas regras, com contração: `` `aos ${period.days} dias anteriores` `` / `'ao período anterior'` (usado em "em relação …").
  - `costNoun(indicator): 'resultado' | 'clique'`.
  - `headline(verdict, ctx): string` — manchetes da spec 4.2 (com a gramática de `previousLabel`/`previousLabelTo`), escolhidas só a partir de `status`, `basis`, `insufficientReason` e dos códigos em `verdict.reasons` (prioridade de `attention`: `budget_exceeded` > `cost_above_goal` > `cost_worse` > `ctr_below_min`).
  - `reasonText(reason, ctx): string` e `actionText(action, ctx): string` — todos os códigos da spec 4.2; código desconhecido → string vazia (nunca lança).
  - `CARD_COPY`: `{ spend, clicks, conversions, conversionsMissing, costCpa, costCpc }` com `{ title, hint }` conforme a spec.

- [ ] **Step 1: Testes que falham** (frases literais, `BRL`, período `{ period: 'last_30d', days: 30 }`):
  - `previousLabel`: `last_30d` → `'os 30 dias anteriores'`; `custom:2026-09-01:2026-09-10` e `today` → `'o período anterior'`. `previousLabelTo`: `last_30d` → `'aos 30 dias anteriores'`; `custom:…` → `'ao período anterior'`.
  - `headline`: `good/goal` → `'Seus anúncios estão dentro da sua meta.'`; `good/comparison` → `'Seus anúncios estão melhores que os 30 dias anteriores.'`; `stable` → `'Seus anúncios estão estáveis em relação aos 30 dias anteriores.'`; `attention/comparison` → `'Atenção: seus anúncios pioraram em relação aos 30 dias anteriores.'`; `attention` com `budget_exceeded` e `cost_worse` juntos → manchete do orçamento; cada `insufficientReason` → sua frase.
  - `reasonText`: `cost_above_goal {value:52, goal:40}` → `'Cada resultado custa R$ 52,00, acima da sua meta de R$ 40,00.'`; `cost_better {indicator:'cpc', change:-15, value:2}` → `'O custo por clique caiu 15%, para R$ 2,00.'`; `cost_worse {indicator:'cpa', change:35, value:52}` → `'O custo por resultado subiu 35%, para R$ 52,00.'`; `ctr_below_min {ctr:1, min:2}` → `'Só 1% de quem viu seus anúncios clicou; sua meta é 2%.'`; `no_conversion_tracking` e `no_results_yet` literais da spec.
  - `actionText`: `campaign_over_goal {campaign:'Natal', value:52, goal:40}` → `"A campanha 'Natal' está custando R$ 52,00 por resultado, acima da sua meta de R$ 40,00."`; `refresh_data {lastSyncedAt:'2026-10-06T12:00:00Z'}` inclui `06/10`; `nothing_urgent` literal.
  - Moeda `UNKNOWN`: nenhuma saída contém `'(moeda desconhecida)'` nem `'NaN'`.
  - Todo código de `reasons`/`actions` listado em Task 1/2 devolve texto não vazio; código desconhecido devolve `''`.
- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/utils/__tests__/verdictCopy.test.js` — Expected: FAIL.
- [ ] **Step 3: Implementar** com tabelas código→função (sem `switch` gigante); formatação só via `utils/format.js`.
- [ ] **Step 4: Rodar o teste e o lint** — Expected: verde.
- [ ] **Step 5: Commit** — `feat(front): textos do veredito em pt-BR`

---

### Task 6: Front — `VerdictBanner` e `HighlightCards` (+ `Overview.css`)

**Files:**
- Create: `eyesight-front/src/components/overview/VerdictBanner.jsx`
- Create: `eyesight-front/src/components/overview/HighlightCards.jsx`
- Create: `eyesight-front/src/styles/Overview.css`
- Test: `eyesight-front/src/components/overview/__tests__/VerdictBanner.test.jsx`, `.../HighlightCards.test.jsx`

**Interfaces:**
- Consumes: `headline`, `reasonText`, `previousLabel`, `CARD_COPY`, `costNoun` (Task 5); `formatMoney`, `format` (Task 4).
- Produces:
  - `VerdictBanner({ verdict, scopeLabel, ctx })` → `<section role="region" aria-label="Como estão seus anúncios" aria-live="polite">` com ícone por status (`CircleCheck`, `Minus`, `TriangleAlert`, `CircleHelp`), manchete, subtítulo `scopeLabel` e a lista de razões (`reasonText`).
  - `HighlightCards({ highlights, ctx, goals })` → `<ul>` de 4 `<li>`: título, valor, comparação com ícone de seta e palavras "melhorou|piorou|igual" + `"{n}% menos|mais que {previousLabel}"` (ex.: `15% menos que os 30 dias anteriores`), e a explicação sempre visível. `goals = { cpaMax }`: no cartão de custo com indicador `cpa` e `cpaMax > 0`, linha `Sua meta: {formatMoney}` e o estado "dentro da meta"/"acima da meta".
  - Cores de status em variáveis CSS definidas em `Overview.css` (`--ov-good`, `--ov-stable`, `--ov-attention`, `--ov-unknown`) com valores para `body.light-mode`; grade 2×2 e, abaixo de 600 px, 1 coluna.

- [ ] **Step 1: Testes que falham.**
  - `VerdictBanner`: para cada status renderiza a região com nome `Como estão seus anúncios`, a manchete esperada e um ícone `aria-hidden`; mostra `scopeLabel` ("Meta Ads · todas as campanhas"); lista as razões; `verdict.status` `insufficient` mostra a frase do motivo.
  - `HighlightCards`: 4 itens na ordem dos títulos `Você investiu`, `Pessoas que clicaram`, `Resultados`, `Custo por resultado`; gasto com `trend 'neutral'` não mostra "melhorou"/"piorou"; `trend 'better'` com `change -15` no custo mostra `15% menos que os 30 dias anteriores` e `melhorou`; `trend 'unknown'` mostra `Ainda sem período anterior para comparar` e nenhuma seta; `conversions.available false` mostra `Não registrado` e a explicação "Sua conta ainda não mede vendas ou contatos…"; indicador `cpc` troca o título para `Custo por clique`; meta `cpaMax 40` com custo 52 mostra `Sua meta: R$ 40,00` e `acima da meta`; com moeda `UNKNOWN` os valores não contêm `(moeda desconhecida)`.
- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/components/overview` — Expected: FAIL.
- [ ] **Step 3: Implementar** os dois componentes e `Overview.css` (importar o CSS em cada componente), usando os tokens de `variables.css`.
- [ ] **Step 4: Rodar os testes e o lint** — Expected: verde.
- [ ] **Step 5: Commit** — `feat(front): VerdictBanner e HighlightCards`

---

### Task 7: Front — `NextActions` e `GoalsForm`

**Files:**
- Create: `eyesight-front/src/components/overview/NextActions.jsx`, `GoalsForm.jsx`
- Modify: `eyesight-front/src/styles/Overview.css`
- Test: `eyesight-front/src/components/overview/__tests__/NextActions.test.jsx`, `GoalsForm.test.jsx`

**Interfaces:**
- Consumes: `actionText`, `ctx` (Task 5); `api` (`PUT /metricas/alertas`).
- Produces:
  - `NextActions({ actions, ctx })` → seção com título `O que fazer agora` e `<ul>`; ações com `campaignId` trazem um link `Perguntar ao assistente` para `/app/assistant`.
  - `GoalsForm({ alertSettings, currency, disabled, onSaved })` → `<details>` com summary `Suas metas`; campos (labels associados): `Quero pagar, no máximo, por cada resultado` (`cpaMax`), `Quero gastar, no máximo, no período` (`budgetMax`), `Quero que pelo menos esta % de quem vê meu anúncio clique` (`ctrMin`); botão `Salvar metas`. Vazio → `null`, senão `Number`. Envia `api.put('/metricas/alertas', { ctrMin, cpaMax, budgetMax })`; sucesso chama `onSaved()` e mostra "Metas salvas." em `role="status"`; erro mostra `err.response?.data?.erro || 'Não foi possível salvar as metas.'` em `role="alert"` mantendo os valores digitados; `disabled` desabilita campos/botão e mostra "Na demonstração as metas não podem ser alteradas.".

- [ ] **Step 1: Testes que falham.**
  - `NextActions`: renderiza o texto de cada ação; ação de campanha tem link `Perguntar ao assistente` com `href="/app/assistant"` e `nothing_urgent` não tem link; um nome de campanha `<img src=x onerror=alert(1)>` aparece como **texto** (`getByText`) e `container.querySelector('img')` é `null`.
  - `GoalsForm` (mock de `api`): campos iniciais vêm de `alertSettings`; salvar com `cpaMax '40'` e demais vazios chama `api.put('/metricas/alertas', { ctrMin: null, cpaMax: 40, budgetMax: null })` e depois `onSaved`; rejeição mantém os valores digitados e mostra o alerta com a mensagem do back; `disabled` impede o envio e mostra a nota da demo.
- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/components/overview/__tests__/NextActions.test.jsx src/components/overview/__tests__/GoalsForm.test.jsx` — Expected: FAIL.
- [ ] **Step 3: Implementar** os componentes e acrescentar os estilos a `Overview.css`.
- [ ] **Step 4: Rodar os testes e o lint** — Expected: verde.
- [ ] **Step 5: Commit** — `feat(front): NextActions e GoalsForm`

---

### Task 8: Front — `demoVerdict` no modo demo

**Files:**
- Modify: `eyesight-front/src/services/demoApi.js` (retorno de `demoAnalytics`)
- Test: `eyesight-front/src/services/__tests__/demoApi.test.js` (estender)

**Interfaces:**
- Produces: `export function demoVerdict(analytics): Verdict` e `demoAnalytics(...)` passa a incluir `verdict: demoVerdict(result)`. Mesma **forma** do back (`status, basis, indicator, insufficientReason, reasons, highlights[4], actions`), com lógica reduzida: indicador sempre `cpa`; `insufficient` se `!hasData`, `!currentComplete` ou `clicks < 30`; meta via `alertSettings.cpaMax`; senão comparação ±5%; ações `[{ code: 'nothing_urgent', params: {} }]`. Sem `Date.now()` (a saída deve continuar determinística, pois o teste atual compara duas chamadas com `toEqual`).

- [ ] **Step 1: Testes que falham:** (i) `demoAnalytics({ periodo: 'last_7d' }).verdict` tem exatamente as chaves `['status','basis','indicator','insufficientReason','reasons','highlights','actions']` e `highlights.map(h => h.key)` igual a `['spend','clicks','conversions','cost']`; (ii) para o período padrão (dados completos e comparação disponível) `status` é um de `good|stable|attention` e `basis` não é `'none'`; (iii) período sem cobertura (`custom 2026-01-01..2026-02-01`) → `status 'insufficient'`; (iv) a saída é determinística (duas chamadas iguais); (v) o teste existente "blocks every unknown read and mutation" continua passando (inclui `put /auth/me`; `PUT /metricas/alertas` segue bloqueado).
- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/services/__tests__/demoApi.test.js` — Expected: FAIL.
- [ ] **Step 3: Implementar** `demoVerdict` reutilizando `analytics.changes`, `totals` e `alertSettings` que o `demoAnalytics` já calcula.
- [ ] **Step 4: Rodar a suíte do front** — Expected: verde.
- [ ] **Step 5: Commit** — `feat(front): veredito simplificado no modo demo`

---

### Task 9: Front — prop `overview` no `AnalyticsWorkspace`

**Files:**
- Modify: `eyesight-front/src/components/AnalyticsWorkspace.jsx`
- Modify: `eyesight-front/src/styles/AnalyticsWorkspace.css` (estilo do bloco `analytics-advanced`)
- Test: `eyesight-front/src/components/__tests__/AnalyticsWorkspace.test.jsx` (estender)

**Interfaces:**
- Produces: prop opcional `overview?: (ctx: { data, filters, alertSettings, reload }) => ReactNode` (`reload()` incrementa `revision`; `filters` é o estado atual; `alertSettings` o estado atual).
- Comportamento **com** `overview` e `data.hasData`: ordem = cabeçalho (título; **apenas** o botão `Atualizar dados`/`Atualizando…`, sem exportar) → seletor `Período` (e o formulário de datas personalizadas) → avisos (`notice`/`error`) → linha de período atual (`analytics-period`, inalterada) → `overview(ctx)` → `<details className="analytics-advanced" open={persistido}>` com summary `Ver análise completa` contendo: filtros de plataforma/campanha/moeda (em seu próprio `<fieldset disabled={syncing}>`), botão `Exportar CSV`, KPIs, gráfico, alertas, tabela e avisos. O botão/painel `Limites de alerta` **não** aparece. Sem dados/erro/carregando: exatamente o comportamento atual. Estado aberto lembrado em `localStorage['eyesight-advanced-open']` (`'1'`/`'0'`, `try/catch`, padrão fechado).
- Sem a prop: nenhuma mudança de DOM.

- [ ] **Step 1: Testes que falham** (mesmos mocks/fixture do arquivo; `overview={ctx => <p>resumo {String(ctx.data.hasData)}</p>}`):
  - Com `overview`: aparece `resumo true`; o botão `Atualizar dados` existe e `Sincronizar dados`/`Limites de alerta` não; `Período` está visível fora do bloco; o `<details>` `Ver análise completa` existe e **fechado** (`open` ausente); dentro dele estão `Plataforma`, `Campanha`, `Exportar CSV` e a tabela de campanhas; clicar em `Atualizar dados` chama `api.post('/metricas/sincronizar', ...)` e depois recarrega.
  - Abrir o bloco grava `'1'` em `localStorage['eyesight-advanced-open']`; remontar com `'1'` mostra o bloco aberto; `localStorage` indisponível (lançando) não quebra a tela.
  - `ctx.reload()` (guardado de dentro do `overview`) provoca nova chamada `GET /metricas/analytics`.
  - Sem dados (`hasData false`): não renderiza `overview` nem o bloco; mostra o estado vazio atual (`Seus resultados começam aqui`).
  - Sem `overview`: os testes existentes deste arquivo e `Meta.test.jsx` seguem passando sem edição.
- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/components/__tests__/AnalyticsWorkspace.test.jsx` — Expected: FAIL nos casos novos.
- [ ] **Step 3: Implementar:** extrair o JSX dos filtros em duas constantes (`periodField` e `otherFields`) renderizadas juntas, no mesmo `<fieldset>`, quando não há `overview` (DOM idêntico ao atual); aplicar a estrutura nova só quando `overview` é passada.
- [ ] **Step 4: Rodar a suíte do front e o lint** — Expected: verde, incluindo `Meta.test.jsx` e `Dashboard.test.jsx` sem edição.
- [ ] **Step 5: Commit** — `feat(front): AnalyticsWorkspace aceita visao geral simples`

---

### Task 10: Front — `SimpleOverview` e ligação no Dashboard

**Files:**
- Create: `eyesight-front/src/components/overview/SimpleOverview.jsx`
- Modify: `eyesight-front/src/pages/Dashboard.jsx`
- Test: `eyesight-front/src/components/overview/__tests__/SimpleOverview.test.jsx` (novo); `eyesight-front/src/pages/__tests__/Dashboard.test.jsx` (estender); `eyesight-front/src/pages/__tests__/DashboardDemo.test.jsx` (novo)

**Interfaces:**
- Consumes: `VerdictBanner`, `HighlightCards`, `NextActions`, `GoalsForm` (Tasks 6–7); ctx do `overview` (Task 9); `data.verdict`.
- Produces: `SimpleOverview({ data, filters, alertSettings, reload })`:
  - `ctx = { currency: data.currency, period: data.period }`; `scopeLabel` = `` `${plataforma} · ${campanha ou 'todas as campanhas'}` `` (plataforma: `Meta Ads`/`Google Ads`/`Todas as plataformas`; campanha: nome em `data.availableCampaigns` para `filters.campaignId`).
  - `data.verdict === null`/ausente → `<p role="status">Não foi possível montar o resumo agora.</p>` e nada mais (o bloco avançado continua disponível).
  - Moeda `UNKNOWN`: um aviso único `Não conseguimos identificar a moeda da sua conta.` acima dos cartões.
  - `GoalsForm` recebe `disabled = localStorage['eyesight-demo'] === '1'` e `onSaved = reload`.
  - `Dashboard.jsx` passa `overview={ctx => <SimpleOverview {...ctx} />}` ao `AnalyticsWorkspace` (mantendo `OnboardingCard`, `onData`, `onError`, `reloadToken` já existentes).

- [ ] **Step 1: Testes que falham.**
  - `SimpleOverview`: com um `verdict` completo renderiza região do veredito, 4 cartões, `O que fazer agora` e `Suas metas`, com o subtítulo `Todas as plataformas · todas as campanhas`; com `filters.platform 'meta'` e `campaignId` de uma campanha conhecida o subtítulo vira `Meta Ads · <nome>`; `verdict: null` mostra `Não foi possível montar o resumo agora.` e não mostra cartões; moeda `UNKNOWN` mostra o aviso uma única vez; salvar metas chama `reload`; em modo demo (`eyesight-demo` = `'1'`) o formulário está desabilitado.
  - `Dashboard.test.jsx` (estender; as respostas de `/metricas/analytics` do arquivo ganham um `verdict` fixo): a Visão geral mostra a manchete do veredito e os 4 cartões; `Ver análise completa` fechado; o fluxo existente do sub-projeto 1 (sync automático com `?conectado=meta`, cartão "Primeiros passos") continua passando; **modo demo** num arquivo separado `eyesight-front/src/pages/__tests__/DashboardDemo.test.jsx` que **não** mocka `api` (mocka apenas `recharts`), define `localStorage['eyesight-demo'] = '1'` e relógio fixo (`vi.useFakeTimers` + `vi.setSystemTime(new Date('2026-10-04T15:00:00Z'))`, como em `demoApi.test.js`): a Visão geral mostra a região `Como estão seus anúncios` e os 4 cartões, o formulário `Suas metas` está desabilitado e o cartão `Primeiros passos` não aparece.
- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/components/overview/__tests__/SimpleOverview.test.jsx src/pages/__tests__/Dashboard.test.jsx` — Expected: FAIL.
- [ ] **Step 3: Implementar** `SimpleOverview` e a mudança no `Dashboard.jsx`.
- [ ] **Step 4: Rodar a suíte completa do front, o lint e o build** — `npx vitest run`, `npm run lint`, `npm run build` (depois `rm -rf dist`) — Expected: verde.
- [ ] **Step 5: Commit** — `feat(front): visao geral em linguagem simples no dashboard`

---

### Task 11: Verificação final

**Files:** nenhum novo.

- [ ] **Step 1: Back** — `cd eyesight-backend && npm test` — Expected: tudo verde.
- [ ] **Step 2: Front** — `cd eyesight-front && npx vitest run && npm run lint && npm run build && rm -rf dist` — Expected: tudo verde.
- [ ] **Step 3: Verificação manual** (backend e front rodando; precisa de conta com dados): Visão geral mostra veredito, 4 cartões, ações e metas; definir `cpaMax` abaixo e acima do custo atual muda o veredito após salvar; conta sem conversões mostra "Não registrado" e "Custo por clique"; usuário novo (sem período anterior) mostra "Ainda não dá para avaliar…"; "ver análise completa" lembra o estado ao recarregar; páginas Meta e Google idênticas às anteriores; `/demo` mostra a Visão geral e bloqueia as metas; tema claro e escuro, só teclado e 360 px de largura.
- [ ] **Step 4: Reportar** o resultado de cada comando, e o que não pôde ser verificado (por exemplo, conta real).
