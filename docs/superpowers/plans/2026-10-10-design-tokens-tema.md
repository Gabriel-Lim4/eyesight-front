# Variáveis de design e tema claro (5b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Definir todas as cores de tema numa única camada de variáveis (`variables.css`), migrar os CSS do app para `var(--…)` e eliminar a camada de sobrescritas `body.light-mode` de `Theme.css`, **sem nenhuma mudança visível**, provada por uma comparação de cores calculadas.

**Architecture:** Peças compartilhadas de sessão em `scripts/lib/session.mjs` (construir, servir, abrir tela). A rede de segurança vive em `scripts/theme/` (módulos puros e testados: `compare.mjs`, `pairs.mjs`, `stats.mjs`, `css-rules.mjs`; captura em navegador: `capture.mjs`) com os comandos `theme:snapshot`, `theme:compare`, `theme:pairs` e `theme:stats`. A migração é feita por área, cada uma aceita só com zero diferença.

**Tech Stack:** CSS, Node 22, Playwright (já instalado na 5a), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-design-tokens-tema-design.md`

## Global Constraints

- **Nenhuma mudança visível.** Cada valor de cor continua exatamente o mesmo. Se dois sistemas usam valores diferentes para o mesmo papel, criam-se duas variáveis; nunca se altera um valor para unificar. Tamanho, espaçamento, fonte e a landing (`Home.css` e as variáveis próprias dela) não são tocados.
- Trocar uma cor escrita à mão por variável **somente se** o valor escuro for idêntico ao da variável **e** a sobrescrita clara correspondente (se houver) for idêntica ao valor claro da variável.
- Todas as variáveis de cor são definidas só em `src/styles/variables.css` (`:root` escuro, `body.light-mode` claro). Nos CSS das telas, cor é `var(--…)`. Uma regra `body.light-mode …` fora de `variables.css` só é aceita se mudar algo que não é cor, e então consta de `scripts/theme/exceptions.json` com o motivo.
- Escopo dos CSS do app: todos os `.css` de `eyesight-front/src` **exceto** `Home.css`: `Account, AnalyticsWorkspace, App, Assistant, Dashboard, Explainer, ForgotPassword, Google, Identity, index, Instagram, Layout, Login, Meta, Metrics, Onboarding, Overview, Plans, Profile, Sidebar, Summary, Theme, variables` e `components/EmptyState.css`.
- Linha de base em `eyesight-front/.theme-baseline/` (ignorada pelo git), gravada **antes** de qualquer mudança de estilo. Nunca regravar a linha de base para "fazer a comparação passar".
- Depois de cada arquivo migrado: `npm run theme:compare -- --only <telas afetadas>` (rápido). Ao fim de cada área: `npm run theme:compare` completo (zero diferença em todas as telas), `npm run a11y` (0 bloqueantes), suíte, lint e build.
- `eyesight-front` é um repositório git (branch `main`). **Um commit local por área** (mensagem em pt-BR, terminando com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`). **Nunca `git push`.**
- Ledger em `scratchpad/progress-tokens.md`. Execuções longas (captura e auditoria levam vários minutos) rodam em segundo plano; ler o resultado do arquivo. Ao encerrar processos, nunca usar `pkill -f` com padrão que apareça na própria linha de comando (matou o shell antes): usar `ps | grep "[p]adrão" | awk | xargs kill`.

## Review Focus

1. Variável com valor claro errado que a comparação do tema escuro não pega: a comparação cobre os dois temas, e as variáveis nascem dos pares medidos, não de suposição.
2. Mudança de cascata ao remover sobrescritas (os 69 `!important` de `Theme.css` venciam regras originais): comparação após cada remoção, e commit por área para desfazer só a área.
3. Estados `:hover`, `:active`, `:focus-visible` fora da captura estática: capturar com estados forçados via CDP; se não for viável, comparar as regras desses estados por texto resolvido.
4. Telas e estados que o demo não renderiza (erro, vazio, carregando, modais): listar os componentes não cobertos na documentação e conferir por busca de texto que nenhuma cor escrita à mão restou neles.
5. `var(--x)` indefinida cai em valor herdado ou inicial sem aviso: teste de estrutura garante que toda variável usada está definida.

---

### Task 1: Sessão compartilhada, módulos puros e linha de base

**Files:**
- Create: `eyesight-front/scripts/lib/session.mjs`, `eyesight-front/scripts/theme/{compare,pairs,stats,css-rules}.mjs`, `eyesight-front/scripts/theme/capture.mjs`, `eyesight-front/scripts/theme-snapshot.mjs`, `theme-compare.mjs`, `theme-pairs.mjs`, `theme-stats.mjs` (em `scripts/`), `eyesight-front/scripts/theme/exceptions.json`
- Modify: `eyesight-front/scripts/a11y-audit.mjs` (usar `session.mjs`), `eyesight-front/package.json` (scripts), `eyesight-front/.gitignore` (`.theme-baseline/`)
- Test: `eyesight-front/scripts/theme/theme.test.mjs`

**Interfaces:**
- Produces em `session.mjs`: `build(): void`, `startPreview(port = 4173): Promise<ChildProcess>`, `openScreen(browser, { screen, theme, viewport, state }): Promise<{ page, context }>` (já com as chaves de `localStorage`, fontes do Google simuladas, animações e transições desligadas por `<style>` injetado, conferência da página final como na 5a, estados `explainer`/`goals`), `SCREENS` (matriz reaproveitada de `scripts/a11y/matrix.mjs`).
- Produces em `capture.mjs`: `capturePage(page): Promise<Record<string, Record<string, string>>>` — mapa `caminho → { color, backgroundColor, backgroundImage, borderTopColor, borderRightColor, borderBottomColor, borderLeftColor, boxShadow, fill, stroke, textDecorationColor, opacity }`; caminho = `tag:nth-child` desde o `body`; entradas `caminho::before` e `caminho::after` quando o `content` do pseudo-elemento não é `none`; e, para até 60 elementos interativos por tela, entradas `caminho@hover`, `caminho@focus-visible`, `caminho@active` com os estados forçados por CDP (`CSS.forcePseudoState`).
- Produces em `compare.mjs`: `diffSnapshots(before, after): { total: number, byKey: Record<string, { changed: number, onlyBefore: number, onlyAfter: number, samples: { path: string, prop: string, before: string, after: string }[] }> }` (no máximo 10 amostras por chave; chave = `tela|tema|largura|estado`).
- Produces em `pairs.mjs`: `buildPairs(snapshot): Record<'text'|'background'|'border'|'shadow'|'svg', { dark: string, light: string, count: number, examples: string[] }[]>` (cruza a mesma tela, largura, estado e caminho entre os temas; ignora pares em que os dois lados são `rgba(0, 0, 0, 0)`; ordenado por `count` decrescente).
- Produces em `stats.mjs`: `countStats(files: { path: string, text: string }[]): { lightModeLines: number, handwrittenColors: Record<string, number>, importantInTheme: number, lines: number }` e `statsFromDir(dir: string): ReturnType<typeof countStats>` (lê os CSS do escopo, excluindo `Home.css`).
- Produces em `css-rules.mjs`: `parseRules(css: string): { selector: string, declarations: { prop: string, value: string }[] }[]` (remove comentários; achata `@media` aninhado; `selector` já separado por vírgula em itens) e `COLOR_PROPS` (lista de propriedades que carregam cor).
- Produces em `exceptions.json`: `[]` no início; cada exceção `{ file, selector, reason }`.
- Produces: `npm run theme:snapshot [-- --only a,b]`, `theme:compare [-- --only a,b]`, `theme:pairs`, `theme:stats`.

- [ ] **Step 1: Escrever os testes que falham** em `scripts/theme/theme.test.mjs` (Vitest, funções puras):
  - `diffSnapshots`: valores iguais → `total` 0; propriedade diferente → uma amostra com `path`, `prop`, `before`, `after`; elemento só no antes → `onlyBefore`; só no depois → `onlyAfter`; mais de 10 mudanças → 10 amostras e `changed` com a contagem real; chaves distintas ficam separadas.
  - `buildPairs`: mesmo elemento com `color` `#fff` no escuro e `#111` no claro, repetido em 3 elementos → um par `text` com `count` 3 e exemplos; fundo transparente nos dois lados é ignorado; elemento só em um tema é ignorado; ordenação por contagem; propriedades de borda agrupam em `border`, `fill`/`stroke` em `svg`, `boxShadow` em `shadow`.
  - `countStats`: conta linhas que contêm `body.light-mode`, cores `#rgb`/`#rrggbb` escritas à mão por valor (ignorando linhas que definem `--var:`), `!important` somente em arquivos chamados `Theme.css`, e total de linhas.
  - `parseRules`: ignora comentários; devolve declarações por regra; achata regras dentro de `@media`; separa `a, b` em dois seletores.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `cd eyesight-front && npx vitest run scripts/theme`
  Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar** `compare.mjs`, `pairs.mjs`, `stats.mjs` e `css-rules.mjs` conforme as interfaces.

- [ ] **Step 4: Rodar e ver passar**
  Run: `cd eyesight-front && npx vitest run scripts/theme`
  Expected: PASS.

- [ ] **Step 5: Extrair `session.mjs` e ajustar `a11y-audit.mjs` para usá-lo**, sem mudar o comportamento da auditoria (mesmas telas, mesmas verificações, mesma saída). Rodar `npm run a11y` em segundo plano.
  Expected: `Resultado: nenhum problema bloqueante` e código de saída 0 (como antes da extração).

- [ ] **Step 6: Implementar `capture.mjs` com viabilidade comprovada primeiro.** Spike: numa página de teste, forçar `:hover` num botão via `context.newCDPSession(page)` + `DOM.getDocument` + `DOM.querySelector` + `CSS.enable` + `CSS.forcePseudoState`, ler a cor de fundo calculada e confirmar que muda para a cor da regra `:hover`. **Se o spike falhar**, registrar no ledger e substituir a captura de estados por uma comparação textual das regras `:hover/:active/:focus` (resolvendo variáveis) em `css-rules.mjs`, atualizando a spec. Se funcionar, implementar a captura completa (elementos visíveis do `body`, pseudo-elementos e estados forçados para até 60 elementos interativos por tela, na mesma ordem de Tab da auditoria).

- [ ] **Step 7: Implementar os quatro comandos** (`theme-snapshot.mjs`, `theme-compare.mjs`, `theme-pairs.mjs`, `theme-stats.mjs`) e os scripts do `package.json`. `snapshot` grava um arquivo por chave em `.theme-baseline/` (ou `.theme-current/` no `compare`, também ignorado); `compare` imprime por tela/tema/largura/estado a quantidade de elementos mudados e até 10 amostras e sai com código 1 se houver qualquer diferença; `--only` filtra as telas pelo `id`; `pairs` imprime a tabela em Markdown; `stats` imprime os números.

- [ ] **Step 8: Gravar a linha de base e provar o determinismo.**
  Run (segundo plano): `cd eyesight-front && npm run theme:snapshot && npm run theme:compare`
  Expected: `theme:compare` termina com código 0 e "nenhuma diferença". Se aparecer diferença entre duas gravações seguidas, **parar**, descobrir a fonte de variação (animação, dado do demo, relógio) e eliminá-la antes de seguir. Registrar o tempo de uma captura completa e o de uma captura com `--only`.

- [ ] **Step 9: Registrar o estado de partida.**
  Run: `npm run theme:stats`
  Expected: números próximos de 321 linhas com `body.light-mode` e 69 `!important` em `Theme.css`; colar a saída em `docs/superpowers/audits/2026-10-10-tokens-pares.md` na seção "Antes".

- [ ] **Step 10: Suíte, lint e commit local.**
  Run: `cd eyesight-front && npx vitest run && npm run lint`
  Expected: sem falhas. `git add` dos arquivos desta tarefa e `git commit` "Rede de segurança para o tema: comparação de cores calculadas" (com coautoria; sem `push`).

---

### Task 2: Variáveis em `variables.css` (sem usá-las ainda)

**Files:**
- Modify: `eyesight-front/src/styles/variables.css`
- Create: `eyesight-front/src/__tests__/theme-structure.test.js`, parte "Pares" de `docs/superpowers/audits/2026-10-10-tokens-pares.md`

**Interfaces:**
- Consumes: `buildPairs`, `parseRules` (Task 1).
- Produces: variáveis de cor em `:root` (escuro) e `body.light-mode` (claro) cobrindo todos os pares frequentes; teste de estrutura com três verificações (funções auxiliares em `theme-structure.test.js`): (a) fora de `variables.css`, nenhuma regra dos CSS do app que contenha `body.light-mode` e declare propriedade de `COLOR_PROPS` — exceto as listadas em `exceptions.json`; (b) `Theme.css` não define variáveis de cor; (c) todo `var(--x)` usado nos CSS do app está definido (em `variables.css`, nos CSS do app ou, para `Home.css`, na própria landing).

- [ ] **Step 1: Gerar a tabela de pares** (`npm run theme:pairs`), registrá-la no documento de auditoria e listar, por classe, os pares com 3 ou mais elementos.

- [ ] **Step 2: Escrever o teste de estrutura** (as verificações (a), (b) e (c) acima). A verificação (c) deve passar desde já. As verificações (a) e (b) são parametrizadas por uma lista `MIGRATED` de arquivos (vazia agora) à qual cada área migrada acrescenta os seus: o teste fica verde hoje e vai endurecendo a cada área, e cada área começa vendo-o falhar ao entrar na lista.
  Run: `cd eyesight-front && npx vitest run src/__tests__/theme-structure.test.js`
  Expected: PASS com `MIGRATED = []` (e um teste extra que falha se um arquivo da lista não existir).

- [ ] **Step 3: Definir as variáveis.** Nomes de papel (ver spec): manter os de `variables.css`, mover os `--app-*` de `Theme.css` com nomes de papel, criar `--status-*` no lugar de `--ov-*`, e uma variável por par frequente medido. Valores exatamente iguais aos do par medido. Pares raros ficam como variáveis locais do componente na tarefa em que forem usados. Não usar ainda nas telas.

- [ ] **Step 4: Provar neutralidade.**
  Run (segundo plano): `cd eyesight-front && npm run theme:compare`
  Expected: zero diferença (as variáveis novas ainda não são usadas por nenhuma regra, exceto as já existentes que não mudaram de valor).

- [ ] **Step 5: Suíte, lint, build e commit local** "Variáveis de cor em variables.css (ainda sem uso)".

---

### Task 3: Área A — Overview, Onboarding, Explainer, Plans, Summary, Identity

**Files:**
- Modify: `src/styles/{Overview,Onboarding,Explainer,Plans,Summary,Identity}.css`, `src/__tests__/theme-structure.test.js` (acrescentar os seis arquivos a `MIGRATED`), `scripts/theme/exceptions.json` (se houver exceção)

- [ ] **Step 1: Listar e guardar as regras de estado.** Para cada arquivo, anotar no ledger as regras `:hover/:active/:focus/:focus-visible` e suas cores (conferência extra mesmo com a captura de estados forçados).

- [ ] **Step 2: Escrever o teste que falha.** Acrescentar os seis arquivos a `MIGRATED` no teste de estrutura.
  Run: `cd eyesight-front && npx vitest run src/__tests__/theme-structure.test.js`
  Expected: FAIL (ainda há `body.light-mode` com cor e cores escritas à mão nesses arquivos).

- [ ] **Step 3: Migrar arquivo por arquivo.** Para cada um: trocar cores escritas à mão por `var(--…)` seguindo a regra de substituição; remover as sobrescritas claras de `Theme.css` que passam a ser desnecessárias para esse arquivo (cada sobrescrita só sai se o par escuro/claro já estiver coberto pela variável); depois de cada arquivo, `npm run theme:compare -- --only <telas que usam o arquivo>` deve dar zero diferença. As `--ov-*` são renomeadas para `--status-*` aqui (substituir todos os usos nos seis arquivos e em qualquer outro CSS que as use).

- [ ] **Step 4: Rodar e ver passar**
  Run: `cd eyesight-front && npx vitest run src/__tests__/theme-structure.test.js`
  Expected: PASS.

- [ ] **Step 5: Verificação da área** (segundo plano): `npm run theme:compare` completo (zero), `npm run a11y` (0 bloqueantes), `npx vitest run`, `npm run lint`, `npm run build` (apagar `dist/`). Registrar `theme:stats` no documento ("Depois da área A").

- [ ] **Step 6: Commit local** "Tema por variáveis: Visão geral, Primeiros passos, Explicar, Plano, Resumo e Identidade".

---

### Task 4: Área B — Login e Layout

**Files:**
- Modify: `src/styles/{Login,Layout,ForgotPassword}.css`, `src/__tests__/theme-structure.test.js` (`MIGRATED`)

- [ ] **Step 1: Teste que falha** (acrescentar os arquivos a `MIGRATED`) — Expected: FAIL.
- [ ] **Step 2: Migrar** com a mesma regra da Task 3. Atenção: a tela de login é escura nos dois temas (fundo fixo `#020617`); as variáveis que ela usa devem ter o mesmo valor nos dois temas, ou ficar de fora das sobrescritas claras, de modo que a captura em tema claro continue idêntica.
- [ ] **Step 3: Teste passa**, verificação da área (mesma da Task 3, Step 5), commit local "Tema por variáveis: Login, Layout e Esqueci a senha".

---

### Task 5: Área C — telas do app (uma por vez)

**Files:**
- Modify, nesta ordem: `src/styles/Dashboard.css`, `Sidebar.css`, `Profile.css`, `Account.css`, `Meta.css`, `Google.css`, `Instagram.css`, `Metrics.css`, `AnalyticsWorkspace.css`, `Assistant.css`, `App.css`, `index.css` e `src/components/EmptyState.css`; `src/__tests__/theme-structure.test.js` (`MIGRATED`)

- [ ] **Step 1: Para cada arquivo da lista, um ciclo completo:** (1) anotar as regras de estado; (2) acrescentar o arquivo a `MIGRATED` e ver o teste de estrutura falhar; (3) migrar as cores para variáveis e remover as sobrescritas claras correspondentes de `Theme.css`; (4) `npm run theme:compare -- --only <telas afetadas>` com zero diferença; (5) teste de estrutura passa. `Sidebar.css` aparece em todas as telas do app: nele a comparação é sempre a completa.
- [ ] **Step 2: Verificação da área** (Task 3, Step 5) ao fim de cada **par** de arquivos, e a completa ao fim da área.
- [ ] **Step 3: Commit local por arquivo grande** (`Dashboard`, `Sidebar`, `Profile`) e um para o restante, com mensagens "Tema por variáveis: …".

---

### Task 6: Limpeza de `Theme.css` e fechamento

**Files:**
- Modify: `src/styles/Theme.css`, `src/styles/variables.css`, demais CSS do app (remoção de sistemas de variáveis sem uso), `docs/superpowers/audits/2026-10-10-tokens-pares.md`

- [ ] **Step 1: Teste que falha.** No teste de estrutura, acrescentar a verificação: `Theme.css` não contém nenhuma regra `body.light-mode` que declare propriedade de cor (exceto exceções), nem `!important` ligado a cor; e que nenhuma variável `--app-*` nem `--ov-*` é referenciada nos CSS do app.
  Expected: FAIL enquanto restar sobrescrita.

- [ ] **Step 2: Remover o que sobrou** de `Theme.css` (sobrescritas e `!important` de cor que perderam função), conferir por busca que nenhuma regra `body.light-mode` com cor resta fora de `variables.css` e de `exceptions.json`, e remover as variáveis antigas sem uso.

- [ ] **Step 3: Teste passa**; `theme:compare` completo (zero), `npm run a11y` (0 bloqueantes), suíte, lint e build.

- [ ] **Step 4: Medir e documentar.** `npm run theme:stats`: registrar "Depois" ao lado do "Antes" no documento (linhas com `body.light-mode`, cores escritas à mão com variável equivalente, `!important` em `Theme.css`, linhas de CSS), a lista final de exceções e os componentes que o demo não renderiza (para conferência manual).

- [ ] **Step 5: Revisão final independente** (fresca, modelo mais capaz) com o pacote `git diff 82eca56..HEAD` dos CSS e dos scripts, o Review Focus deste plano e o ledger; uma única rodada de correções com teste que falhava antes; commit local e relatório de pendentes e adiados.

- [ ] **Step 6: Avisar o usuário** de que os commits ficaram locais e de que o envio ao GitHub (`git push`) depende dele, e listar a conferência manual: abrir cada tela nos dois temas, passar o mouse e usar o teclado nos elementos interativos, e as telas que o demo não mostra (estados de erro, vazio e carregando).
