# Primeiros passos (onboarding) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um cartão "Primeiros passos" no Dashboard guia o usuário novo de "conectar conta" até "ver o primeiro resultado", com sincronização automática depois do OAuth.

**Architecture:** O progresso do checklist é derivado do estado real (status das contas, `lastSyncedAt`, `hasData`); só "dispensado" é persistido em `usuarios.preferences.onboarding.dismissed`. Os callbacks OAuth do back não mudam: a página Account redireciona no front para `/app?conectado=<plataforma>`, e o Dashboard dispara o sync uma vez via `POST /metricas/sincronizar`.

**Tech Stack:** React 18 + Vite + Vitest/Testing Library (front, `eyesight-front`); Express + Zod + `node --test` (back, `eyesight-backend`).

**Spec:** `docs/superpowers/specs/2026-10-08-onboarding-primeiros-passos-design.md`

## Global Constraints

- Textos de interface em **pt-BR**, exatamente como listados nas tarefas (os testes os usam).
- Estado de cada item do checklist sempre com **texto + ícone**, nunca só cor; cartão é `<section role="region" aria-label="Primeiros passos">` com `<ol>`; progresso do sync em `aria-live="polite"`.
- Tema claro e escuro via tokens de `src/styles/variables.css` (`--bg-container`, `--border-color`, `--text-primary`, `--text-secondary`, `--accent-blue`, `--gradient-btn`); `body.light-mode` já os troca.
- **Não alterar** callbacks OAuth (`metaController`/`googleController`), `schema.prisma`, rotas nem rate limits. Única mudança no back: `atualizarPerfilSchema`.
- Sync inicial: `api.post('/metricas/sincronizar', { periodo: 'last_30d', platform })` (o sync tem limite de 5/min por usuário; o auto-sync usa 1 chamada).
- Parâmetro de retorno: `?conectado=meta|google`; qualquer outro valor é ignorado e removido da URL.
- `PUT /auth/me` exige `nome`; para dispensar, enviar `{ nome, preferences: { onboarding: { dismissed: true } } }` com o `nome` vindo de `GET /auth/me`.
- O cartão não renderiza em modo demo (`localStorage['eyesight-demo'] === '1'`), quando dispensado, ou enquanto statuses/preferências/`hasData` não chegaram.
- Seguir o padrão do repo: o ESLint do front tem a regra `react-hooks/set-state-in-effect`; efeitos de carga inicial usam o comentário `// eslint-disable-next-line react-hooks/set-state-in-effect` como em `Account.jsx`.
- Este diretório **não é um repositório git** hoje. Os passos "Commit" valem só depois de um `git init`; sem git, pule-os.

## Review Focus

Entradas/condições que a spec implica e que um usuário real pode encontrar (cada uma tem teste na tarefa dona):

1. Recarregar `/app?conectado=meta` depois do sync **não** dispara outro sync (Task 3).
2. `?conectado=<valor inválido>` não dispara sync e é limpo da URL (Task 3).
3. Falha ao carregar status/preferências ou `hasData` desconhecido: o cartão não aparece e o Dashboard continua funcionando (Task 5).
4. Modo demo: nenhuma chamada de status/preferências e nada renderizado (Task 5).
5. Falha ao gravar "dispensado": o cartão some mesmo assim, sem erro na tela (Task 5).

---

### Task 1: Back — aceitar `preferences.onboarding.dismissed`

**Files:**
- Modify: `eyesight-backend/src/validators/authValidator.js:31` (campo `preferences` de `atualizarPerfilSchema`)
- Test: `eyesight-backend/src/test/authValidator.test.js` (bloco `atualizarPerfilSchema`, ~linha 112)
- Test: `eyesight-backend/src/test/identity.test.js`

**Interfaces:**
- Produces: `PUT /auth/me` aceita `preferences: { theme?: 'light'|'dark', onboarding?: { dismissed: boolean } }` (strict); `atualizarPerfil` já faz merge raso e não muda.

- [ ] **Step 1: Escrever os testes que falham**
  - Em `authValidator.test.js`, no `describe('atualizarPerfilSchema')`, adicionar casos sobre `atualizarPerfilSchema.safeParse({ nome: 'Ana', preferences })`:
    - `{ onboarding: { dismissed: true } }` → `success === true`
    - `{ theme: 'light' }` sozinho → `success === true` (compatibilidade com Profile)
    - `{ onboarding: { dismissed: 'sim' } }` → `false`
    - `{ onboarding: { dismissed: true, extra: 1 } }` → `false`
    - `{ foo: 1 }` → `false`
  - Em `identity.test.js`, novo `test('onboarding dismissal merges without losing alerts or theme', ...)`: `users.findUnique` devolve `{ preferences: { alerts: { ctr: 1 }, theme: 'dark' } }`; chamar `atualizarPerfil` com `body: { nome: 'Ana', preferences: { onboarding: { dismissed: true } } }`; afirmar `statusCode === 200` e `users.update` chamado com `data.preferences` igual a `{ alerts: { ctr: 1 }, theme: 'dark', onboarding: { dismissed: true } }`.
- [ ] **Step 2: Rodar e ver falhar**
  Run (em `eyesight-backend`): `node --experimental-test-module-mocks --test src/test/authValidator.test.js src/test/identity.test.js`
  Expected: FAIL nos casos de `onboarding`.
- [ ] **Step 3: Implementar** em `authValidator.js`: `preferences: z.object({ theme: z.enum(['light','dark']).optional(), onboarding: z.object({ dismissed: z.boolean() }).strict().optional() }).strict().optional()`.
- [ ] **Step 4: Rodar a suíte inteira do back**
  Run: `npm test`
  Expected: todos passam.
- [ ] **Step 5: Commit** — `feat(auth): aceitar preferencia de onboarding dispensado`

---

### Task 2: Front — helper `startOAuth` + redirecionamento na Account

**Files:**
- Create: `eyesight-front/src/services/oauth.js`
- Modify: `eyesight-front/src/pages/Account.jsx` (função `connect`, ~linha 51; efeitos de `params`)
- Test: `eyesight-front/src/services/__tests__/oauth.test.js` (novo)
- Test: `eyesight-front/src/pages/__tests__/Account.test.jsx` (novo)

**Interfaces:**
- Produces (em `services/oauth.js`):
  - `async function startOAuth(platform: 'meta'|'google'): Promise<void>` — `GET /${platform}/conectar`; exige `data.url` começando com `https://`, senão lança `Error('invalid_redirect')`; então `window.location.assign(data.url)`.
  - `function oauthErrorMessage(error: unknown): string` — `error.response?.data?.erro` ou `'Não foi possível iniciar a autorização.'`.
- Consumes: `api` default de `services/api.js`.

- [ ] **Step 1: Testes que falham**
  - `oauth.test.js` (mock de `../api` como em `Profile.test.jsx`; stub de `window.location.assign` com `vi.stubGlobal('location', { ...window.location, assign: vi.fn() })`):
    - `startOAuth('meta')` com `{ url: 'https://facebook.com/x' }` chama `assign('https://facebook.com/x')` e chamou `api.get('/meta/conectar')`.
    - URL `http://evil` ou ausente → rejeita e `assign` não é chamado.
    - `oauthErrorMessage({ response: { data: { erro: 'Integração ainda não configurada pelo administrador.' } } })` devolve essa string; `oauthErrorMessage(new Error('x'))` devolve `'Não foi possível iniciar a autorização.'`.
  - `Account.test.jsx` (mock de `api` com `get` resolvendo `{ data: { conectado: false, configured: true } }`; `MemoryRouter` com `Routes`: `/app/account` → `<Account />`, `/app` → componente que exibe `useLocation().search`):
    - entrar em `/app/account?meta=conectado` navega para `/app` com search `?conectado=meta`; idem `google=conectado` → `?conectado=google`.
    - entrar em `/app/account?meta=negado` permanece em Account e mostra a mensagem `Autorização cancelada. Conecte novamente quando desejar.`.
- [ ] **Step 2: Rodar e ver falhar**
  Run (em `eyesight-front`): `npx vitest run src/services/__tests__/oauth.test.js src/pages/__tests__/Account.test.jsx`
  Expected: FAIL (módulo/redirect inexistentes).
- [ ] **Step 3: Criar `services/oauth.js`** com as duas funções acima (mesma lógica que hoje está em `Account.connect`).
- [ ] **Step 4: Refatorar `Account.jsx`**: `connect(key)` passa a usar `startOAuth` e `oauthErrorMessage` (comportamento e mensagens idênticos). Adicionar redirecionamento: se `params.get('meta') === 'conectado'` ou `params.get('google') === 'conectado'`, renderizar/disparar `<Navigate to={`/app?conectado=${plataforma}`} replace />` antes de qualquer outra coisa (inclusive antes do efeito que limpa os params).
- [ ] **Step 5: Rodar** os dois arquivos e depois `npx vitest run` completo do front.
  Expected: passam.
- [ ] **Step 6: Commit** — `feat(front): helper startOAuth e redirect pos-conexao para o dashboard`

---

### Task 3: Front — hook `useAutoSync`

**Files:**
- Create: `eyesight-front/src/hooks/useAutoSync.js`
- Test: `eyesight-front/src/hooks/__tests__/useAutoSync.test.jsx` (novo; `.jsx` para o wrapper com `MemoryRouter`)

**Interfaces:**
- Produces: `function useAutoSync(): { state: 'idle'|'running'|'error', message: string, retry: (platform?: 'meta'|'google'|'all') => Promise<void>, reloadToken: number }`
  - Ao montar, lê `?conectado`; se for `meta` ou `google`: remove o parâmetro (`setSearchParams(..., { replace: true })`), e dispara o sync uma vez (guarda com `useRef` contra StrictMode).
  - `retry(platform = 'all')` executa o mesmo sync manualmente.
  - Sync = `api.post('/metricas/sincronizar', { periodo: 'last_30d', platform })`. Sucesso (resposta 2xx, mesmo parcial) → `state: 'idle'`, `reloadToken + 1`; se algum `results[i].success === false`, `message` recebe esses erros (`results[i].error` unidos por espaço). Falha (rejeição) → `state: 'error'`, `message` = `err.response?.data?.erro` || erros de `err.response?.data?.results` unidos || `'Falha na sincronização. Verifique suas contas e tente novamente.'`.
- Consumes: `api` de `services/api.js`; `useSearchParams` do react-router.

- [ ] **Step 1: Testes que falham** (`renderHook` com wrapper `MemoryRouter initialEntries`; mock de `api.post`):
  - `/app?conectado=meta` → um único `POST /metricas/sincronizar` com `{ periodo: 'last_30d', platform: 'meta' }`; `state` passa por `'running'` e termina `'idle'`; `reloadToken` vira 1; parâmetro removido da URL.
  - **(Review Focus 1)** re-renderizar o hook depois do sync (simulando recarga: nova montagem com a URL já limpa `/app`) → `api.post` continua com 1 chamada no total.
  - **(Review Focus 2)** `?conectado=x` e `?conectado=<script>` → `api.post` nunca chamado; parâmetro removido.
  - Rejeição com `{ response: { data: { erro: 'Aguarde um minuto antes de sincronizar novamente.' } } }` → `state: 'error'`, `message` com esse texto; `retry()` chama de novo com `platform: 'all'` e, ao resolver, volta a `'idle'`.
  - Resposta 200 com `results: [{ platform:'meta', success:true }, { platform:'google', success:false, error:'Reconecte sua conta para continuar.' }]` → `state: 'idle'`, `reloadToken` incrementado, `message` contém `'Reconecte sua conta para continuar.'`.
  - Sem `?conectado` → nada chamado, `state: 'idle'`.
- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run src/hooks/__tests__/useAutoSync.test.jsx`
  Expected: FAIL (hook inexistente).
- [ ] **Step 3: Implementar** `useAutoSync` conforme a interface acima.
- [ ] **Step 4: Rodar o teste**
  Expected: PASS.
- [ ] **Step 5: Commit** — `feat(front): hook useAutoSync para sync inicial pos-OAuth`

---

### Task 4: Front — `AnalyticsWorkspace` com `onData` e `reloadToken`

**Files:**
- Modify: `eyesight-front/src/components/AnalyticsWorkspace.jsx` (assinatura do componente ~linha 31; efeito de carga ~linhas 46-55)
- Test: `eyesight-front/src/components/__tests__/AnalyticsWorkspace.test.jsx` (novo; reutilize os mocks de `recharts`/`api` e o `fixture` de `pages/__tests__/Meta.test.jsx`)

**Interfaces:**
- Produces: props opcionais `onData?: (result: AnalyticsResult) => void` (chamada após cada carga bem-sucedida, com o corpo da resposta de `/metricas/analytics`) e `reloadToken?: number` (default `0`; entra nas dependências do efeito de carga para refazer a busca). Sem as props, comportamento idêntico ao atual.

- [ ] **Step 1: Testes que falham**
  - Renderiza `<AnalyticsWorkspace platform="all" onData={fn} />`; após carregar, `fn` foi chamada uma vez com um objeto cujo `hasData === true` e `lastSyncedAt === '2026-09-30T12:00:00Z'`.
  - `rerender` com `reloadToken={1}` → `api.get` ganha uma 2ª chamada a `/metricas/analytics` e `fn` é chamada de novo.
  - Sem `onData`/`reloadToken` (renderização simples) → carrega normalmente, sem erro.
- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run src/components/__tests__/AnalyticsWorkspace.test.jsx`
  Expected: FAIL.
- [ ] **Step 3: Implementar** as props; chamar `onData(result)` dentro do `.then` do efeito, apenas se não abortado. Guardar `onData` em um `useRef` atualizado a cada render para não entrar nas dependências do efeito.
- [ ] **Step 4: Rodar** o novo teste e os existentes: `npx vitest run src/pages/__tests__/Meta.test.jsx src/components/__tests__/AnalyticsWorkspace.test.jsx`
  Expected: PASS (os testes de Meta continuam verdes).
- [ ] **Step 5: Commit** — `feat(front): AnalyticsWorkspace expoe onData e reloadToken`

---

### Task 5: Front — `OnboardingCard`

**Files:**
- Create: `eyesight-front/src/components/OnboardingCard.jsx`
- Create: `eyesight-front/src/styles/Onboarding.css`
- Test: `eyesight-front/src/components/__tests__/OnboardingCard.test.jsx` (novo)

**Interfaces:**
- Consumes: `startOAuth(platform)`, `oauthErrorMessage(error)` (Task 2); `api`.
- Produces: `export default function OnboardingCard({ hasData, lastSyncedAt, sync })` com
  - `hasData: boolean | null` (`null` = ainda não carregou), `lastSyncedAt: string | null`,
  - `sync: { state: 'idle'|'running'|'error', message: string, retry: (platform?) => Promise<void> }`.
- Comportamento:
  - Ao montar (fora do demo): `GET /meta/status`, `GET /google/status`, `GET /auth/me` em paralelo. Qualquer falha → não renderiza nada. Não renderiza enquanto faltar resposta, enquanto `hasData === null`, se `usuario.preferences.onboarding?.dismissed === true`, ou em demo (sem fazer nenhuma chamada).
  - `connected = status.meta.conectado || status.google.conectado`; item 2 pronto = `connected && (Boolean(lastSyncedAt) || hasData)`; item 3 pronto = `connected && hasData`; tudo pronto = os três.
  - Textos fixos: título `Primeiros passos`; itens `Conectar sua conta de anúncios`, `Buscar seus dados`, `Ver seu primeiro resultado`; rótulos de estado `Concluído` / `Em andamento` / `Pendente` / `Com erro` (texto visível dentro do `<li>`).
  - Item 1 pendente: botões `Conectar Meta Ads` e `Conectar Google Ads` (chamam `startOAuth`; erro mostrado em `role="alert"` com `oauthErrorMessage`); se `status.configured === false` para a plataforma, em vez do botão: `Integração ainda não configurada`. Enquanto nada conectado: link `Ver com dados de exemplo` → `/demo`.
  - Item 2: `sync.state === 'running'` → `Em andamento` + `Buscando suas campanhas…` (em região `aria-live="polite"`); `'error'` → `Com erro` + `sync.message` + botão `Tentar de novo` (chama `sync.retry()`) + link `Ver conexões` → `/app/account`; conectado sem sync e sem erro → `Pendente` + botão `Buscar meus dados` (chama `sync.retry()`). Se `sync.message` não vazio com `state: 'idle'` (sucesso parcial), exibi-lo como aviso (`role="status"`).
  - Item 3: item 2 pronto e `hasData === false` → texto `Sua conta não tem campanhas com atividade neste período. Quando tiver, elas aparecem aqui.`
  - Tudo pronto: `Tudo pronto! Estes são os resultados dos seus anúncios.` + botão `Ocultar`; se só uma plataforma conectada, link `Conectar Google Ads também` ou `Conectar Meta Ads também` → `/app/account`. `Ocultar` esconde o cartão na hora e faz `api.put('/auth/me', { nome: usuario.nome, preferences: { onboarding: { dismissed: true } } })`, ignorando erro.

- [ ] **Step 1: Testes que falham** (mock de `../../services/api` com `get`/`put`; mock de `../../services/oauth`; `MemoryRouter`). Cada teste monta com um conjunto de respostas de `api.get` por URL e afirma o texto:
  - nada conectado → 3 itens, item 1 `Pendente` com os dois botões e link `Ver com dados de exemplo` apontando `/demo`; clicar `Conectar Meta Ads` chama `startOAuth('meta')`; se rejeitar, aparece `role="alert"` com a mensagem.
  - `configured: false` no Meta → `Integração ainda não configurada` no lugar do botão do Meta.
  - conectado + `lastSyncedAt: null` + `hasData: false` + `sync.state: 'idle'` → item 1 `Concluído`, item 2 `Pendente` e botão `Buscar meus dados` chama `sync.retry`.
  - `sync.state: 'running'` → item 2 `Em andamento` e `Buscando suas campanhas…`.
  - `sync.state: 'error'` com `message` → `Com erro`, a mensagem, `Tentar de novo` chama `retry`, link `Ver conexões` → `/app/account`.
  - conectado + sincronizado + `hasData: false` → item 2 `Concluído`, item 3 mostra a mensagem de conta sem campanhas.
  - tudo pronto com só Meta conectado → `Tudo pronto!…`, link `Conectar Google Ads também` → `/app/account`; clicar `Ocultar` remove o cartão e chama `api.put('/auth/me', { nome: 'Ana', preferences: { onboarding: { dismissed: true } } })`.
  - **(Review Focus 5)** `api.put` rejeita → mesmo assim o cartão some e nenhum `alert` aparece.
  - **(Review Focus 3)** `api.get('/meta/status')` rejeita → nada renderizado (`container` vazio); `hasData: null` → nada renderizado.
  - dispensado (`preferences.onboarding.dismissed: true`) → nada renderizado.
  - **(Review Focus 4)** `localStorage['eyesight-demo'] = '1'` → nada renderizado e `api.get` nunca chamado.
  - desconectar reabre: com `conectado: false` e `lastSyncedAt` preenchido, item 2 NÃO aparece como `Concluído`.
- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run src/components/__tests__/OnboardingCard.test.jsx`
  Expected: FAIL (componente inexistente).
- [ ] **Step 3: Implementar** `OnboardingCard.jsx` e `Onboarding.css` (importar o CSS no componente; ícones de `lucide-react` — `CheckCircle2`, `Loader2`, `Circle`, `AlertTriangle` — com `aria-hidden`, sempre acompanhados do texto de estado; animação do spinner desligada por `prefers-reduced-motion`, já tratado globalmente em `variables.css`). Layout responsivo: itens empilhados em largura de celular, botões com área de toque ≥ 44px.
- [ ] **Step 4: Rodar o teste**
  Expected: PASS.
- [ ] **Step 5: Commit** — `feat(front): OnboardingCard com checklist derivado do estado real`

---

### Task 6: Front — ligar tudo no Dashboard e ajustar `leaveDemo`

**Files:**
- Modify: `eyesight-front/src/pages/Dashboard.jsx`
- Modify: `eyesight-front/src/pages/Layout.jsx` (`leaveDemo`)
- Test: `eyesight-front/src/pages/__tests__/Dashboard.test.jsx` (novo)
- Test: `eyesight-front/src/pages/__tests__/Layout.test.jsx` (novo; `vi.mock('../../components/Sidebar', () => ({ default: () => null }))`)

**Interfaces:**
- Consumes: `useAutoSync` (Task 3), `AnalyticsWorkspace` props `onData`/`reloadToken` (Task 4), `OnboardingCard` (Task 5).
- Produces: `Dashboard` mantém `const [data, setData] = useState({ hasData: null, lastSyncedAt: null })`; renderiza `<OnboardingCard hasData={data.hasData} lastSyncedAt={data.lastSyncedAt} sync={sync} />` acima de `<AnalyticsWorkspace key="all" platform="all" title="Visão geral" onData={r => setData({ hasData: r.hasData, lastSyncedAt: r.lastSyncedAt })} reloadToken={sync.reloadToken} />`, com `sync = useAutoSync()` (o objeto passado ao cartão é `{ state, message, retry }`).
- `leaveDemo` em `Layout.jsx`: remove `eyesight-demo`, navega para `/app` se existir `localStorage.token`, senão para `/` (ambos com `replace`).

- [ ] **Step 1: Testes que falham**
  - `Dashboard.test.jsx` (mocks de `api` e `recharts` como em `Meta.test.jsx`; `get` responde por URL: `/meta/status`, `/google/status`, `/auth/me`, `/metricas/analytics`; `MemoryRouter initialEntries={['/app?conectado=meta']}`):
    - o fluxo ponta a ponta: `POST /metricas/sincronizar` chamado **uma vez** com `{ periodo: 'last_30d', platform: 'meta' }`; depois `/metricas/analytics` é buscado de novo; ao final o cartão mostra item 2 e 3 `Concluído` e `Tudo pronto!`.
    - sem `?conectado`: nenhum POST; conta conectada e sem sincronização mostra `Buscar meus dados`.
    - com `/auth/me` falhando, o workspace ("Visão geral") continua renderizado e o cartão não aparece.
  - `Layout.test.jsx`: em modo demo com `token` no localStorage, clicar `Sair da demonstração` leva a `/app`; sem `token`, leva a `/` (rotas de teste simples que exibem o pathname).
- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run src/pages/__tests__/Dashboard.test.jsx src/pages/__tests__/Layout.test.jsx`
  Expected: FAIL.
- [ ] **Step 3: Implementar** as alterações descritas em Interfaces.
- [ ] **Step 4: Rodar a suíte completa do front**
  Run: `npx vitest run`
  Expected: PASS (inclui Meta/Instagram/Assistant/Profile existentes).
- [ ] **Step 5: Commit** — `feat(front): checklist de primeiros passos no dashboard com sync automatico`

---

### Task 7: Verificação final

**Files:** nenhum novo.

- [ ] **Step 1: Lint do front** — Run (em `eyesight-front`): `npm run lint` — Expected: sem erros novos.
- [ ] **Step 2: Testes** — front: `npx vitest run`; back: `npm test` (em `eyesight-backend`) — Expected: tudo verde.
- [ ] **Step 3: Build do front** — Run: `npm run build` — Expected: build concluído.
- [ ] **Step 4: Verificação manual** (com backend e front rodando; requer credenciais OAuth configuradas, senão o botão mostra `Integração ainda não configurada`): conta nova → cartão com 3 itens pendentes → conectar → volta ao Dashboard com "Buscando suas campanhas…" → resultado e `Tudo pronto!` → `Ocultar` persiste após recarregar → desconectar e reconectar não reabre o cartão dispensado. Conferir tema claro/escuro, navegação só por teclado, leitor de tela anunciando o progresso, largura de celular (~360px). Conferir `/demo` sem cartão e que `Sair da demonstração` volta ao `/app` para quem está logado.
- [ ] **Step 5: Reportar** o resultado de cada comando acima, incluindo o que não pôde ser verificado (por exemplo, OAuth real).
