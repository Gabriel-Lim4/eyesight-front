# Acessibilidade e consistência do app (5a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um nome só ("Metas") nos dois formulários, a fonte carregada uma vez, o cursor órfão removido e uma auditoria de acessibilidade repetível em navegador real (`npm run a11y`) que chega a zero problemas bloqueantes no app e nas telas de autenticação.

**Architecture:** Cópia compartilhada das metas em `src/utils/goalsCopy.js`. A auditoria vive em `scripts/a11y/` (lógica de relatório pura e testável em `report.mjs`, matriz de telas em `matrix.mjs`, verificações no navegador em `checks.mjs`, orquestração em `scripts/a11y-audit.mjs`) e usa o modo demonstração, sem backend. As correções seguem a linha de base da auditoria.

**Tech Stack:** React 18, Vite, Vitest + Testing Library; `playwright` e `@axe-core/playwright` (somente dev).

**Spec:** `docs/superpowers/specs/2026-10-09-acessibilidade-consistencia-design.md`

## Global Constraints

- Mantém o visual atual: nada de redesenho. Ajustes de cor só o mínimo para contraste (4,5:1 texto normal; 3:1 texto grande e componentes), nos arquivos de tema existentes, **sem variáveis novas** (isso é a 5b).
- Texto de interface em pt-BR e nome único "Metas": botão e título "Suas metas", botão "Salvar metas", sucesso "Metas salvas.", erro "Não foi possível salvar as metas.", validação "Informe apenas números nas metas.". Rótulos dos campos: `cpaMax` "Quero pagar, no máximo, por cada resultado"; `budgetMax` "Quero gastar, no máximo, no período"; `ctrMin` "Quero que pelo menos esta % de quem vê meu anúncio clique". Backend (`ctrMin`, `cpaMax`, `budgetMax`, `PUT /metricas/alertas`) não muda.
- Fonte: um único `<link>` no `index.html` com Inter 400–800, Tomorrow 400/600/700, JetBrains Mono 400/500/600, IBM Plex Mono 400/500/600 e Space Grotesk 500/600/700, `display=swap`; nenhum `.css` pode conter `fonts.googleapis.com`.
- Auditoria: matriz de telas, temas e larguras exatamente como na spec; chaves de `localStorage`: `eyesight-demo` = `'1'` e `eyesight-theme` = `'light'` ou `'dark'`, definidas com `context.addInitScript` antes de navegar. Falha o comando (exit 1) só se, nas telas dos grupos `app` e `auth`, houver violação `serious` ou `critical`, rolagem horizontal em 360px ou elemento focável sem indicador de foco. Landing e avisos de área de toque (44px) nunca falham o comando.
- Dependências novas só em `devDependencies` (`playwright`, `@axe-core/playwright`). O navegador do Playwright fica em `~/.cache/ms-playwright` (fora do projeto). **Parar e consultar o usuário** se: o navegador não abrir por falta de bibliotecas do sistema (alternativa B da spec) ou se instalar as bibliotecas exigir `sudo`; ou se uma correção exigir mudar o desenho de uma tela.
- `eyesight-front` agora é um repositório git (branch `main`). **Commite localmente ao fim de cada tarefa** (mensagem em pt-BR, terminando com a linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`) e **nunca faça `git push`**: o envio depende do token do usuário. Os documentos de spec e plano ficam em `docs/` fora desse repositório.
- Ledger em `scratchpad/progress-a11y.md`. Comandos: `cd eyesight-front && npx vitest run`, `npm run lint`, `npm run build` (apagar `dist/` depois), `npm run a11y`. Execuções longas passam de 2 minutos: rode em segundo plano e leia o resultado.

## Review Focus

1. Uma correção de contraste no tema claro quebrar o tema escuro (ou o inverso): toda correção de cor é reauditada nos dois temas e nas duas larguras.
2. Texto renomeado deixando rótulo antigo para trás: testes, nomes acessíveis (`aria-label`, `aria-describedby`), mensagens de erro e estados vazios do formulário da análise completa e da Visão geral devem usar os mesmos textos.
3. Peso de fonte faltando no `<link>` único (por exemplo Inter 800 ou Tomorrow 600) fazendo o navegador "inventar" o peso: conferir a união dos pesos contra o uso nos CSS.
4. Falsa confiança na auditoria: regras que o axe não consegue decidir (`incomplete`) e telas que não carregaram não podem passar em silêncio; o relatório lista ambos e uma tela que falha ao abrir conta como falha.
5. A auditoria não pode tocar rede real nem backend: só o modo demonstração e as fontes externas; falha de rede das fontes não pode falhar o comando.

---

### Task 1: Ferramenta de auditoria e linha de base

**Files:**
- Create: `eyesight-front/scripts/a11y/matrix.mjs`, `eyesight-front/scripts/a11y/report.mjs`, `eyesight-front/scripts/a11y/checks.mjs`, `eyesight-front/scripts/a11y-audit.mjs`, `docs/superpowers/audits/2026-10-09-a11y-baseline.md`
- Modify: `eyesight-front/package.json` (devDependencies, script `a11y`), `eyesight-front/package-lock.json`, `eyesight-front/.gitignore` (`a11y-report.json`)
- Test: `eyesight-front/scripts/a11y/report.test.mjs`

**Interfaces:**
- Produces em `matrix.mjs`: `APP_SCREENS`, `AUTH_SCREENS`, `LANDING_SCREENS` (cada item `{ id: string, path: string, group: 'app' | 'auth' | 'landing' }`), `THEMES = ['dark', 'light']`, `VIEWPORTS = [{ id: 'desktop', width: 1280, height: 800 }, { id: 'mobile', width: 360, height: 740 }]`, `STATES = [{ id: 'explainer', screen: 'app-overview' }, { id: 'goals', screen: 'app-overview' }]`.
- Produces em `report.mjs`: tipo `Result = { screen: string, group: 'app'|'auth'|'landing', theme: string, viewport: string, state?: string, loadError?: string, violations: { id: string, impact: 'minor'|'moderate'|'serious'|'critical', nodes: number, help: string }[], incomplete: { id: string }[], overflow: boolean, focusMissing: string[], smallTargets: number }`; `isBlocking(result): boolean`; `blockingResults(results): Result[]`; `summarize(results): { total: number, blocking: number, byGroup: Record<string, { screens: number, violations: number }>, rules: { id: string, impact: string, nodes: number, screens: number }[] }`; `formatTable(results): string`.
- Produces em `checks.mjs`: `runChecks(page): Promise<Pick<Result, 'violations'|'incomplete'|'overflow'|'focusMissing'|'smallTargets'>>`.
- Produces: `npm run a11y` (exit 1 se `blockingResults(...)` não for vazio ou se alguma tela do grupo `app`/`auth` falhar ao abrir).

- [ ] **Step 1: Preparar o ambiente.**
  Run: `cd eyesight-front && npm ci`
  Expected: instala sem erro (a pasta `node_modules` não existe). Depois `npm i -D playwright @axe-core/playwright` e `npx playwright install chromium`. Se o download ou a execução pedir bibliotecas do sistema com `sudo`, **parar e consultar o usuário**.

- [ ] **Step 2: Teste mínimo do navegador (decide se o plano segue).** Escrever um script descartável (no scratchpad, fora do projeto) que abre `about:blank` com `chromium.launch()`, injeta o axe via `@axe-core/playwright` e roda `analyze()` numa página HTML mínima com um botão sem nome acessível.
  Run: o script com `node`.
  Expected: o navegador abre e o axe reporta a violação `button-name`. Se o navegador não abrir: **parar**, registrar a mensagem de erro e consultar o usuário (alternativa B).

- [ ] **Step 3: Escrever os testes que falham** em `scripts/a11y/report.test.mjs` (Vitest, funções puras):
  - `isBlocking`: um resultado do grupo `app` com violação `serious` → verdadeiro; `critical` → verdadeiro; só `moderate`/`minor` → falso; `overflow: true` → verdadeiro; `focusMissing` não vazio → verdadeiro; `smallTargets` alto sozinho → falso; grupo `landing` com violação `critical` → falso; grupo `auth` com `serious` → verdadeiro; `loadError` definido em `app` ou `auth` → verdadeiro, em `landing` → falso.
  - `blockingResults` devolve só os bloqueantes, na ordem recebida.
  - `summarize`: contagem total, bloqueantes, `byGroup` com número de telas distintas e de violações, e `rules` agregado por `id` (soma de `nodes`, número de telas distintas), ordenado por gravidade (`critical` primeiro) e depois por `nodes`.
  - `formatTable`: contém uma linha por tela/tema/largura/estado com o `id` das regras e a gravidade, lista as regras `incomplete` e as telas com `loadError`, e diz explicitamente "nenhum problema bloqueante" quando não há bloqueantes.

- [ ] **Step 4: Rodar e ver falhar**
  Run: `cd eyesight-front && npx vitest run scripts/a11y`
  Expected: FAIL (módulo `report.mjs` inexistente).

- [ ] **Step 5: Implementar** `report.mjs`, `matrix.mjs` e `checks.mjs`:
  - `matrix.mjs`: telas do app `/app`, `/app/dashboard`, `/app/instagram`, `/app/google`, `/app/meta`, `/app/metrics`, `/app/account`, `/app/assistant`, `/app/profile` (ids `app-overview`, `app-dashboard`, …); de autenticação `/login`, `/cadastro`, `/esqueci-senha`, `/cancelar-resumo?t=x` (grupo `auth`); landing `/` (grupo `landing`).
  - `checks.mjs` (`runChecks`): (1) `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()` mapeando `violations` e `incomplete`; (2) `overflow = document.documentElement.scrollWidth > window.innerWidth`; (3) foco: pressionar Tab até 60 vezes (parando se voltar ao primeiro elemento), para cada elemento focado ler `getComputedStyle` e marcar como ausente quando `outlineStyle === 'none'` ou largura 0 **e** `boxShadow === 'none'`, registrando um seletor curto; (4) `smallTargets` = número de `button, a[href], input, select, textarea, [role=button]` visíveis fora de texto corrido com largura **e** altura menores que 44px (conte apenas o que não estiver dentro de `p, li` com texto em volta quando for `a`).
  - Uma função de espera para a tela estabilizar (rede ociosa ou 800 ms) antes de auditar; falha de rede das fontes externas é ignorada.

- [ ] **Step 6: Rodar e ver passar**
  Run: `cd eyesight-front && npx vitest run scripts/a11y`
  Expected: PASS.

- [ ] **Step 7: Implementar `scripts/a11y-audit.mjs` e o script `a11y`.** Fluxo: `vite build` → `vite preview --port 4173 --strictPort` como processo filho → para cada tela × tema × largura (e os dois estados extras só na Visão geral: abrir o painel clicando em "Explicar" do veredito; expandir "Suas metas" clicando no `summary`) abrir um contexto novo com `addInitScript` definindo as duas chaves de `localStorage`, navegar, esperar, `runChecks`, fechar o contexto; encerrar o servidor sempre (também em erro); imprimir `formatTable`, gravar `a11y-report.json` (adicionar ao `.gitignore`) e `process.exit(blockingResults(...).length ? 1 : 0)`. Uma tela que falha ao abrir vira `Result` com `loadError`.
  Run: `cd eyesight-front && npm run a11y`
  Expected: roda até o fim e imprime a tabela; o código de saída pode ser 1 (a linha de base ainda tem problemas).

- [ ] **Step 8: Registrar a linha de base** em `docs/superpowers/audits/2026-10-09-a11y-baseline.md`: data, contagem total e bloqueante, tabela de regras agregadas por gravidade, as 10 causas mais frequentes e a lista de telas com `loadError` ou regras `incomplete`. Não corrigir nada nesta tarefa.

- [ ] **Step 9: Suíte e lint**
  Run: `cd eyesight-front && npx vitest run && npm run lint`
  Expected: sem falhas e sem erros de lint (incluir `scripts/` no escopo do lint; ajustar a configuração do ESLint só se necessário para `.mjs` de Node).

- [ ] **Step 10: Commit local.** `git add package.json package-lock.json .gitignore scripts` e `git commit` com mensagem "Auditoria de acessibilidade (npm run a11y)" e a linha de coautoria. Sem `push`.

---

### Task 2: Consistência (Metas, fonte única, limpeza)

**Files:**
- Create: `eyesight-front/src/utils/goalsCopy.js`, `eyesight-front/src/__tests__/consistency.test.js`
- Modify: `eyesight-front/src/components/overview/GoalsForm.jsx`, `eyesight-front/src/components/AnalyticsWorkspace.jsx` (botão `Limites de alerta` e formulário `analytics-alert-form`), `eyesight-front/index.html`, os 9 arquivos de `src/styles` com `@import url(` (`Account.css`, `Dashboard.css`, `Google.css`, `Home.css`, `Instagram.css`, `Login.css`, `Meta.css`, `Metrics.css`, `Profile.css`)
- Delete: `eyesight-front/src/components/CustomCursor.jsx`, `eyesight-front/src/components/CustomCursor.css`
- Test: `eyesight-front/src/__tests__/consistency.test.js`, `eyesight-front/src/components/__tests__/AnalyticsWorkspace.test.jsx` (atualizar e acrescentar), `eyesight-front/src/components/overview/__tests__/GoalsForm.test.jsx` (continua passando)

**Interfaces:**
- Produces em `goalsCopy.js`: `GOAL_FIELDS: [['cpaMax', string, 'money'], ['budgetMax', string, 'money'], ['ctrMin', string, 'percent']]` (mesma ordem de hoje no `GoalsForm`), `GOALS_COPY = { title: 'Suas metas', save: 'Salvar metas', saved: 'Metas salvas.', error: 'Não foi possível salvar as metas.', numbers: 'Informe apenas números nas metas.' }`.

- [ ] **Step 1: Escrever os testes que falham.**
  - `consistency.test.js` (usa `node:fs` para ler arquivos; `src` e `index.html` relativos à raiz do frontend):
    - nenhum `.css` em `src` contém `fonts.googleapis.com`;
    - `index.html` tem exatamente um `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...">` com as cinco famílias (`Inter`, `Tomorrow`, `JetBrains+Mono`, `IBM+Plex+Mono`, `Space+Grotesk`) e `display=swap`, e os pesos exigidos nas Global Constraints;
    - nenhum arquivo de `src` contém `CustomCursor` nem `custom-cursor-active`;
    - nenhum arquivo `.jsx`/`.js` de `src` fora de testes contém "Limites de alerta", "Alertas por campanha" ou "Salvar limites".
  - `AnalyticsWorkspace.test.jsx`: o teste que hoje procura o botão `/Limites de alerta/` passa a procurar `/Suas metas/`; novo teste no modo completo: clicar no botão "Suas metas" abre um formulário (`aria-expanded` verdadeiro) cujo título é "Suas metas", com os três campos nomeados exatamente pelos rótulos de `GOAL_FIELDS` e o botão "Salvar metas"; salvar chama `PUT /metricas/alertas` com os mesmos números e mostra "Metas salvas." (o formulário completo passa a mostrar o texto de sucesso, que antes inexistia); erro do servidor mostra "Não foi possível salvar as metas."; o texto de apoio é "Com uma meta, as campanhas que passam dela aparecem em 'Campanhas que precisam de atenção'. Valores em dinheiro seguem a moeda selecionada. Deixe em branco para não usar.".
  - `GoalsForm.test.jsx` (existente): continua passando sem mudar seus textos.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `cd eyesight-front && npx vitest run src/__tests__/consistency.test.js src/components/__tests__/AnalyticsWorkspace.test.jsx`
  Expected: FAIL nos casos novos (fonte, cursor, textos); o restante passa.

- [ ] **Step 3: Implementar.**
  - Criar `goalsCopy.js`; `GoalsForm.jsx` importa `GOAL_FIELDS` e `GOALS_COPY` no lugar de seus textos literais (comportamento idêntico).
  - `AnalyticsWorkspace.jsx`: botão passa a "Suas metas"; o título do formulário "Suas metas"; campos gerados de `GOAL_FIELDS` (mantendo `min`, `max` e `step` de hoje por chave); botão "Salvar metas" (e "Salvando…" durante a gravação); estado de mensagem de sucesso/erro com `role="status"`/`role="alert"`.
  - `index.html`: adicionar o `<link rel="stylesheet">` único logo após os `preconnect`; remover todas as linhas `@import url(...)` dos nove CSS (somente essas linhas).
  - Apagar `CustomCursor.jsx` e `CustomCursor.css`.

- [ ] **Step 4: Rodar e ver passar**
  Run: `cd eyesight-front && npx vitest run src/__tests__/consistency.test.js src/components`
  Expected: PASS.

- [ ] **Step 5: Suíte, lint e build**
  Run: `cd eyesight-front && npx vitest run && npm run lint && npm run build && rm -rf dist`
  Expected: sem falhas; lint limpo; build ok.

- [ ] **Step 6: Reauditar** `npm run a11y` e comparar com a linha de base: nenhuma tela nova com problema bloqueante por causa desta tarefa (a mudança de fonte pode mudar contraste ou largura).

- [ ] **Step 7: Commit local** "Metas com um nome só, fonte carregada uma vez e remoção do cursor órfão" (com coautoria; sem `push`).

---

### Task 3: Correções guiadas pela auditoria

**Files:**
- Modify: apenas os componentes e CSS que a auditoria apontar (nenhum arquivo é previsto de antemão); `docs/superpowers/audits/2026-10-09-a11y-baseline.md` ganha a seção "Depois das correções"
- Test: um teste por correção testável em jsdom, ao lado do componente alterado

**Interfaces:**
- Consome: `npm run a11y` e o JSON de resultados da Task 1.

- [ ] **Step 1: Agrupar por causa.** A partir da auditoria atual, listar os resultados **bloqueantes** agrupados por regra e por seletor/arquivo de origem (por exemplo, `color-contrast` em `.ov-hint` no tema claro). Pontos de partida a conferir mesmo se o axe não os acusar: `grep -rn "outline: none\|outline:none\|outline: 0" eyesight-front/src/styles` (remoções de foco sem substituto), botões só com ícone sem nome acessível, `placeholder` usado como único rótulo, tamanho de fonte fixo em `px` que quebre em 360px.

- [ ] **Step 2: Corrigir um grupo por vez, da causa mais frequente para a menos frequente.** Para cada grupo:
  - se o problema for testável em jsdom (nome acessível, rótulo de campo, papel, ordem de títulos, `aria-*`), escrever primeiro o teste, **vê-lo falhar** e só depois corrigir;
  - se for contraste, foco visual ou largura, corrigir o CSS no arquivo de tema existente com o valor mínimo que atinge o contraste, mantendo o visual, e provar pela reauditoria;
  - rodar `npm run a11y` depois de cada grupo; a quantidade de bloqueantes só pode diminuir, e nenhum grupo corrigido pode reaparecer no outro tema ou na outra largura.

- [ ] **Step 3: Repetir o passo 2** até `npm run a11y` terminar com código 0 (nenhum bloqueante). Se uma correção exigir mudar o desenho de uma tela, **parar e consultar o usuário** com a alternativa mínima.

- [ ] **Step 4: Registrar as pendências** (moderate/minor, avisos de 44px e tudo da landing) na seção "Depois das correções" da linha de base, com contagem por tela e por regra.

- [ ] **Step 5: Suíte, lint e build**
  Run: `cd eyesight-front && npx vitest run && npm run lint && npm run build && rm -rf dist`
  Expected: sem falhas; lint limpo; build ok.

- [ ] **Step 6: Commit local** por grupo de correção, ou um só ao final, com mensagem clara e coautoria (sem `push`).

---

### Task 4: Verificação final

- [ ] **Step 1: Estado limpo.**
  Run: `cd eyesight-front && npx vitest run && npm run lint && npm run build && rm -rf dist && npm run a11y`
  Expected: tudo verde e `npm run a11y` com código de saída 0 e a frase "nenhum problema bloqueante".

- [ ] **Step 2: Conferir no pacote publicado.** `git status` limpo; `git log --oneline` mostra os commits locais desta etapa; `.gitignore` ignora `a11y-report.json`; `package.json` não ganhou nada em `dependencies` (só `devDependencies`).

- [ ] **Step 3: Registrar a conferência manual** que só o usuário faz (leitor de tela em Visão geral e Perfil, zoom de 200%, navegação só por teclado do login até a Visão geral, e-mail do resumo num cliente de e-mail) como pendente no ledger e na resposta final.

- [ ] **Step 4: Avisar o usuário** de que os commits ficaram locais e de que o envio ao GitHub (`git push`) depende dele.
