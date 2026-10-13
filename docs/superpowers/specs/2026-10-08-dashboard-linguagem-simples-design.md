# Dashboard em linguagem simples (Visão geral) — Design

Data: 2026-10-08
Sub-projeto 2 de 3 da iniciativa "Eyesight para donos de pequenas empresas"
(1 = Primeiros passos, já implementado; 3 = Assistente integrado).

## 1. Contexto e objetivo

**Usuário-alvo:** dono de pequena empresa que roda os próprios anúncios (Meta Ads e/ou Google Ads), com pouca familiaridade com métricas.

**Problema hoje:** a Visão geral (`/app`, `AnalyticsWorkspace`) mostra 8 KPIs (investimento, impressões, cliques, CTR, CPC, CPM, conversões, ROAS), gráfico, tabela e alertas de uma vez. Cada KPI traz só "+12% vs. período anterior", sem dizer se isso é bom ou ruim. Os limites de alerta pedem termos técnicos ("CPA máximo"), e valores em moeda não identificada exibem "(moeda desconhecida)" ao lado de cada número.

**Objetivo:** em menos de 10 segundos o usuário entende **"meus anúncios estão indo bem?"** e **"o que devo fazer?"**, sem conhecer CTR, CPM ou ROAS. Nada é removido: a análise completa continua disponível.

**Critérios de sucesso**
- A Visão geral abre com um veredito (`good` / `stable` / `attention` / `insufficient`), 4 números em linguagem simples e de 1 a 3 recomendações.
- O veredito usa a meta do usuário quando existe e, caso contrário, a comparação com o período anterior. Quando não há base honesta, diz que não dá para avaliar.
- Não há julgamento baseado em "benchmarks de mercado" inventados.
- As páginas Meta e Google, o CSV, o assistente e os testes atuais continuam funcionando sem alteração de comportamento.

**Fora do escopo:** tela para configurar as constantes (5%, 30 cliques, 80%); veredito por campanha; resumo por e-mail e sync periódico (sub-projeto 4); integração com a IA e abertura do assistente já com a campanha escolhida (sub-projeto 3); unificar o nome "Limites de alerta" nas páginas Meta/Google (sub-projeto 5); meta de ROAS.

## 2. Decisões tomadas

| Decisão | Escolha |
|---|---|
| Régua do veredito | **Meta do usuário** (quando aplicável) tem precedência; padrão é a **comparação com o período anterior** |
| Metas | As 3 que já existem em `preferences.alerts` (`cpaMax`, `budgetMax`, `ctrMin`), em linguagem simples; sem campo novo nem migração |
| Onde calcular | **Back**, módulo puro `verdictService.js`, campo novo `verdict` em `/metricas/analytics` (aditivo) |
| O que o back devolve | **Códigos e parâmetros**, não frases; o front monta os textos e formata moeda |
| Escopo da mudança | Só a Visão geral; Meta e Google ficam idênticas (prop `overview` opcional) |
| Modo demo | `demoApi.js` ganha um `demoVerdict` reduzido (lógica duplicada, coberta por teste de formato) |
| Análise completa | Recolhida por padrão dentro de `<details>`; escolha lembrada em `localStorage` |

## 3. Back-end

### 3.1 `src/services/verdictService.js` (novo, puro, sem banco)
`export function buildVerdict(analytics, { now = new Date() } = {}): Verdict`

**Constantes nomeadas** (topo do módulo): `STABLE_BAND_PCT = 5`, `MIN_CLICKS = 30`, `MIN_IMPRESSIONS_FOR_CTR = 100` (igual aos alertas atuais), `BUDGET_NEAR_RATIO = 0.8`, `WASTED_SPEND_SHARE = 0.2`, `STALE_HOURS = 24`, `MAX_ACTIONS = 3`, `NAME_MAX = 80`.

**Entrada:** o objeto que `getAnalytics` já monta (`totals`, `previousTotals`, `changes`, `campaigns`, `alertSettings`, `currency`, `period`, `hasData`, `currentComplete`, `previousComplete`, `lastSyncedAt`).

**Forma da saída**
```
Verdict = {
  status: 'good' | 'stable' | 'attention' | 'insufficient',
  basis: 'goal' | 'comparison' | 'none',
  indicator: 'cpa' | 'cpc',
  insufficientReason: null | 'no_data' | 'incomplete_period' | 'zero_spend' | 'low_volume' | 'no_baseline',
  reasons:    [{ code, params }],
  highlights: [{ key: 'spend'|'clicks'|'conversions'|'cost', value, change, trend, available }],
  actions:    [{ code, params, campaignId? }],
}
```
`trend` ∈ `better | worse | stable | neutral | unknown`. `neutral` é fixo para `spend`. `unknown` quando `change` é `null`. `|change| < 5` → `stable`; caso contrário `better`/`worse` conforme a direção do indicador (cliques e conversões: maior é melhor; custo: menor é melhor). `available: false` apenas para `conversions` quando `totals.conversions == null`.

### 3.2 Regras (ordem de avaliação)

**a) Indicador.** `indicator = 'cpa'` se `totals.conversions > 0` e `totals.cpa != null`; senão `'cpc'`. Se `totals.conversions == null`, reason `no_conversion_tracking`; se `=== 0`, reason `no_results_yet`.

**b) Sinais de atenção que valem mesmo com poucos dados ou sem comparação** (o custo contra a meta é avaliado só em (c), porque exige volume mínimo; "o pior vence"):
- `budget_exceeded` `{ spend, limit }`: `budgetMax > 0` e `totals.spend > budgetMax` e moeda ≠ `UNKNOWN`.
- `ctr_below_min` `{ ctr, min }`: `ctrMin > 0`, `impressions >= 100`, `ctr < ctrMin`.
- Aviso (não muda o status): `budget_near` `{ spend, limit, percent }` quando `spend >= 0.8 × budgetMax` e ainda não excedeu.

**c) Avaliação do indicador** (só se `currentComplete`, `totals.spend > 0` e `totals.clicks >= 30`):
1. Meta aplicável (`indicator === 'cpa'`, `cpaMax > 0`, moeda ≠ `UNKNOWN`): `basis = 'goal'`; `cpa <= cpaMax` → `good` (`cost_within_goal`), senão `attention` (`cost_above_goal`).
2. Senão, se `previousComplete` e `changes[indicator]` é número finito: `basis = 'comparison'`; `change <= -5` → `good` (`cost_better`); `change >= 5` → `attention` (`cost_worse`); caso contrário `stable` (`cost_stable`). As fronteiras ±5 são inclusivas para melhor/pior.
3. Senão: não avaliável, `insufficientReason = 'no_baseline'`.
Com meta aplicável, a comparação (se existir) entra como reason de apoio e **não altera o status**.

**d) Status final.** Se há algum sinal de atenção (b) ou a avaliação (c) deu `attention` → `attention`. Senão, o resultado de (c). Se (c) não foi avaliável e não há sinal de atenção → `insufficient`, com `insufficientReason` na ordem: `no_data` (`!hasData`), `incomplete_period` (`!currentComplete`), `zero_spend`, `low_volume` (`clicks < 30`), `no_baseline`. `basis` é `'none'` nesse caso.

**e) Highlights.** Sempre 4, nesta ordem: `spend`, `clicks`, `conversions`, `cost` (o `cost` usa o indicador escolhido). `value` vem de `totals`; `change` de `changes` (ou `null`).

**f) Actions** (máx. `MAX_ACTIONS`, nesta prioridade; a lista nunca fica vazia):
1. `budget_exceeded` `{ spend, limit }` (mesma condição do sinal).
2. `campaign_over_goal` `{ campaign, value, goal }` (pior campanha: `metrics.cpa > cpaMax`, razão `cpa/cpaMax` maior) e `campaign_low_ctr` `{ campaign, ctr, min }` (menor CTR abaixo do mínimo com ≥ 100 impressões); cada um com `campaignId`.
3. `campaign_without_results` `{ campaign, spend }` com `campaignId`: conta com `totals.conversions > 0`, campanha com `metrics.conversions === 0` e `metrics.spend >= 0.2 × totals.spend` (a de maior gasto).
4. `enable_conversion_tracking` `{}`: `currentComplete` e `totals.conversions == null`.
5. `refresh_data` `{ lastSyncedAt }`: `lastSyncedAt` mais antigo que 24 h em relação a `now` (ou ausente com dados).
6. `nothing_urgent` `{}` se nenhuma das anteriores se aplica.
Ações em dinheiro (1 e 2) são ignoradas quando a moeda é `UNKNOWN`. Nomes de campanha são cortados em 80 caracteres.

### 3.3 Integração
`services/analyticsService.js`: no retorno de `getAnalytics`, adicionar `verdict` calculado dentro de `try/catch`; em qualquer exceção `verdict: null` e o restante da resposta segue intacto. Nenhuma mudança de rota, controller, schema Prisma, rate limit ou validador.

## 4. Front-end

### 4.1 Utilitários
- `src/utils/format.js` (novo): `format(value, type, currency)` extraído de `AnalyticsWorkspace.jsx` (mesma lógica, mesmos testes) para ser compartilhado.
- `src/utils/verdictCopy.js` (novo): `headline(verdict, ctx)`, `reasonText(reason, ctx)`, `actionText(action, ctx)`, `previousLabel(period)` e as constantes de rótulo/explicação dos cartões. `ctx = { currency, period }`.
  - `previousLabel`: `last_7d|last_30d|last_90d` → `os ${days} dias anteriores`; qualquer outro (hoje, ontem, personalizado) → `o período anterior`. `previousLabelTo` é a forma contraída (`aos ${days} dias anteriores` / `ao período anterior`), usada em "em relação …".

### 4.2 Textos (pt-BR; `{x}` = valor formatado)
**Manchetes:** `good/goal` "Seus anúncios estão dentro da sua meta." · `good/comparison` "Seus anúncios estão melhores que {previousLabel}." · `stable` "Seus anúncios estão estáveis em relação {previousLabelTo}." · `attention` por prioridade do sinal: `budget_exceeded` "Atenção: você passou do seu limite de gasto." · custo/meta "Atenção: o custo por resultado está acima da sua meta." · custo/comparação "Atenção: seus anúncios pioraram em relação {previousLabelTo}." · `ctr_below_min` "Atenção: poucas pessoas estão clicando nos seus anúncios." · `insufficient` por motivo: `incomplete_period` "Ainda não dá para avaliar: faltam dados de alguns dias. Atualize os dados." · `zero_spend` "Seus anúncios não gastaram neste período." · `low_volume` "Poucos dados para avaliar ainda. Os números abaixo já aparecem." · `no_baseline` "Ainda não dá para avaliar: falta o período anterior para comparar. Defina uma meta ou aguarde alguns dias."
(`cost` usa "resultado" para `cpa` e "clique" para `cpc` em todos os textos.)

**Razões:** `cost_within_goal` "Cada resultado custa {value}, abaixo da sua meta de {goal}." · `cost_above_goal` "Cada resultado custa {value}, acima da sua meta de {goal}." · `cost_better` "O custo por {resultado|clique} caiu {n}%, para {value}." · `cost_worse` "O custo por {…} subiu {n}%, para {value}." · `cost_stable` "O custo por {…} ficou em {value} (variação de {n}%)." · `budget_exceeded` "Você já gastou {spend}, acima do seu limite de {limit}." · `budget_near` "Você já usou {percent}% do seu limite de gasto." · `ctr_below_min` "Só {ctr}% de quem viu seus anúncios clicou; sua meta é {min}%." · `no_conversion_tracking` "Sua conta não registra vendas ou contatos, então avaliei pelo custo por clique." · `no_results_yet` "Seus anúncios ainda não geraram resultados registrados; avaliei pelo custo por clique."

**Ações:** `budget_exceeded` (igual à razão) · `campaign_over_goal` "A campanha '{campaign}' está custando {value} por resultado, acima da sua meta de {goal}." · `campaign_low_ctr` "Poucas pessoas clicam na campanha '{campaign}' ({ctr}%; sua meta é {min}%)." · `campaign_without_results` "A campanha '{campaign}' gastou {spend} e não gerou resultados." · `enable_conversion_tracking` "Ative o acompanhamento de conversões na plataforma para ver quanto cada resultado custa." · `refresh_data` "Seus dados foram atualizados em {data}. Clique em Atualizar dados para ver o dia de hoje." · `nothing_urgent` "Nada urgente por enquanto. Continue acompanhando." Ações de campanha trazem o botão "Perguntar ao assistente" (link para `/app/assistant`). Os textos sugerem "vale revisar", nunca ordenam pausar campanhas.

**Cartões:** "Você investiu" ("Total gasto nos seus anúncios neste período.") · "Pessoas que clicaram" ("Quantas vezes alguém clicou nos seus anúncios.") · "Resultados" ("Vendas ou contatos que seus anúncios geraram.") — se `available: false`: valor "Não registrado" e "Sua conta ainda não mede vendas ou contatos. Ative o acompanhamento de conversões na plataforma para ver este número." · "Custo por resultado" ("Quanto você pagou, em média, por cada resultado.") ou, no indicador `cpc`, "Custo por clique" ("Quanto você paga, em média, cada vez que alguém clica."). Com meta de custo: linha "Sua meta: {goal}" e seu estado. A comparação de cada cartão diz, com ícone de seta e texto, "{n}% menos|mais que {previousLabel}" + "melhorou|piorou|igual", ou "Ainda sem período anterior para comparar" quando `unknown`. Gasto é sempre neutro.

**Moeda `UNKNOWN`:** os cartões mostram só o número, e um único aviso acima deles diz "Não conseguimos identificar a moeda da sua conta."

### 4.3 Componentes novos (`src/components/overview/` + `src/styles/Overview.css`)
- `VerdictBanner({ verdict, scopeLabel, currency, period })`: região `role="region"` com título "Como estão seus anúncios", `aria-live="polite"`; ícone + manchete + razões + subtítulo de recorte (ex.: "Meta Ads · todas as campanhas"); cor por status, sempre acompanhada de ícone e texto.
- `HighlightCards({ highlights, currency, period, goals })`: lista de 4 cartões; 2×2 no desktop, 1 coluna abaixo de 600 px; explicação sempre visível.
- `NextActions({ actions, currency, period })`: título "O que fazer agora"; lista de 1 a 3 itens.
- `GoalsForm({ alertSettings, currency, disabled, onSaved })`: recolhido por padrão ("Suas metas"); campos "Quero pagar, no máximo, __ por resultado" (`cpaMax`), "Quero gastar, no máximo, __ no período" (`budgetMax`), "Quero que pelo menos __% de quem vê meu anúncio clique" (`ctrMin`); vazio vira `null`; salva em `PUT /metricas/alertas` (existente) e chama `onSaved()` para recarregar; em erro mostra a mensagem no formulário e mantém o digitado; desabilitado em modo demo com a nota "Na demonstração as metas não podem ser alteradas."
- `SimpleOverview(ctx)`: compõe os quatro acima. `verdict === null` → mensagem "Não foi possível montar o resumo agora." e a análise completa abre aberta.

### 4.4 `AnalyticsWorkspace.jsx` (prop opcional `overview`)
`overview?: (ctx: { data, filters, alertSettings, reload }) => ReactNode`.
- **Sem a prop:** DOM e comportamento idênticos aos de hoje (as páginas Meta/Google e seus testes ficam como estão).
- **Com a prop**, e `data.hasData`: ordem = cabeçalho (título; botão "Atualizar dados" no lugar de "Sincronizar dados"; "Atualizado em …") → seletor de **Período** (e o formulário de datas personalizadas) → `overview(ctx)` → `<details className="analytics-advanced">` com summary "Ver análise completa" contendo os demais filtros (plataforma, campanha, moeda), exportação CSV, KPIs, gráfico, alertas, tabela e avisos. O botão/painel "Limites de alerta" não aparece (substituído pelo `GoalsForm`).
- Sem dados (`!data.hasData`), erro ou carregando: exatamente o comportamento atual.
- Estado do `<details>` aberto/fechado em `localStorage['eyesight-advanced-open']` (`try/catch`; padrão fechado).
- Os filtros de plataforma/campanha/moeda continuam valendo: o veredito é recalculado pelo back para o recorte escolhido e o subtítulo mostra o recorte.

### 4.5 `pages/Dashboard.jsx`
Passa `overview={ctx => <SimpleOverview {...ctx} />}` ao `AnalyticsWorkspace` (mantendo `OnboardingCard`, `onData`, `onError` e `reloadToken` do sub-projeto 1).

### 4.6 `services/demoApi.js`
`demoAnalytics` passa a incluir `verdict: demoVerdict(result)`. `demoVerdict` (reduzido): indicador `cpa`; `insufficient` se `!hasData`, `!currentComplete` ou `clicks < 30`; regra de meta com `alertSettings.cpaMax`; senão comparação ±5%; `highlights` completos; `actions: [{ code: 'nothing_urgent', params: {} }]`. **A lógica é uma versão reduzida da do back, duplicada de propósito** (o front não importa código do back).

## 5. Erros e casos de borda

| Situação | Comportamento |
|---|---|
| `verdict: null` (falha no cálculo) | "Não foi possível montar o resumo agora." + análise completa aberta; Meta/Google intactas |
| Gasto zero | `insufficient` / `zero_spend` |
| < 30 cliques | `insufficient` / `low_volume`; cartões aparecem |
| Período anterior incompleto | sem seta/cor; veredito pela meta, se houver, senão `no_baseline` |
| Dados só de resumo (`source: 'snapshot'`) | `currentComplete` falso → `incomplete_period`; ação `refresh_data` |
| Moeda `UNKNOWN` | aviso único; sinais/ações em dinheiro e meta de custo ignorados; comparação percentual segue |
| Várias moedas | veredito vale para a moeda do filtro; subtítulo informa |
| Filtro de plataforma/campanha | veredito acompanha; subtítulo mostra o recorte |
| Metas vazias/zero | desativadas (`null`), como hoje |
| Falha ao salvar metas | erro no formulário; valores digitados mantidos |
| Nome de campanha longo/estranho | cortado em 80 caracteres e renderizado sempre como texto |
| Entrada malformada em `buildVerdict` | lança internamente; `getAnalytics` captura e devolve `verdict: null` |

**Acessibilidade:** região do veredito com título e `aria-live="polite"`; ícone + texto em todo estado; contraste nos temas claro e escuro (tokens de `variables.css`/`Theme.css`; sem repetir o problema de âmbar do sub-projeto 1); `<details>` nativo; cartões em lista; campos de meta com rótulos associados; áreas de toque ≥ 44 px; reduções de movimento já tratadas globalmente.

## 6. Testes

**Back (`node --test`, em `src/test/`)**
- `verdictService.test.js` (novo, tabela): cada status e cada régua (meta × comparação); fronteiras exatas (variação 4,99 / 5 / −5 / −4,99; 29 e 30 cliques; `budget_near` em 79,9% e 80%; estouro em 100% vs. acima); indicador `cpc` com conversões `null` e com `0`; moeda `UNKNOWN`; sem período anterior; gasto zero; meta com precedência e comparação como apoio; status "pior vence" (bom em custo + CTR abaixo do mínimo → `attention`); prioridade e limite de 3 ações, lista nunca vazia, `refresh_data` com `now` injetado, corte de nomes; entrada malformada lança.
- `analyticsService.test.js` (existente, estendido): resposta inclui `verdict` com a forma esperada; se `buildVerdict` falhar, `verdict === null` e o restante da resposta não muda (campos atuais preservados).

**Front (Vitest)**
- `verdictCopy`: todos os códigos têm texto; `previousLabel` para presets e personalizado; formatação de moeda e `UNKNOWN`.
- `VerdictBanner`, `HighlightCards` (gasto neutro; "Não registrado"; "Custo por clique"; linha de meta; sem período anterior), `NextActions` (links para o assistente), `GoalsForm` (salvar; vazio → `null`; erro mantém valores; desabilitado em demo).
- `AnalyticsWorkspace`: com `overview` o bloco vem fechado e a escolha é lembrada; sem dados continua mostrando o estado vazio; **sem `overview` os testes atuais de Meta passam sem alteração**; `format` extraído mantém as saídas.
- `demoApi`: `demoVerdict` devolve a mesma forma de campos do contrato do back (lista de chaves compartilhada entre os dois testes por valor) e os status esperados para o período padrão e para um período sem comparação.
- `Dashboard` ponta a ponta (com e sem `?conectado=`) e Visão geral em modo demo.

**Verificação manual:** tema claro/escuro; só teclado; 360 px; conta real com e sem conversões; usuário novo (sem período anterior) e usuário com meta definida.

## 7. Riscos e pendências

- **As constantes (5%, 30 cliques, 80%, 20%, 24 h) são julgamentos práticos, não benchmarks.** Ficam nomeadas e centralizadas; ajustar depois exige só mudar o módulo e os testes de fronteira.
- **Comparação "estável" pode esconder uma conta ruim há meses.** A meta (parte D) existe justamente para esse caso; a spec não promete mais que isso.
- **Atribuição de conversões:** "resultado" depende da configuração da plataforma do usuário; o texto "Sua conta não registra vendas ou contatos" é a forma de tornar isso visível.
- **Lógica duplicada no demo:** divergência possível entre `verdictService` e `demoVerdict`; mitigada pelo teste de formato, não de regras.
- **Nomes diferentes para as mesmas configurações:** "Suas metas" (Visão geral) vs. "Limites de alerta" (Meta/Google) até o sub-projeto 5.
- **Dependência do sub-projeto 1:** o `OnboardingCard` e o auto-sync continuam acima da visão simples; nenhuma mudança neles.
