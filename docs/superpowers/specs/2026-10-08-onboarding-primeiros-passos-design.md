# Primeiros passos (onboarding) — Design

Data: 2026-10-08
Sub-projeto 1 de 3 da iniciativa "Eyesight para donos de pequenas empresas"
(2 = Dashboard em linguagem simples, 3 = Assistente integrado).

## 1. Contexto e objetivo

**Usuário-alvo:** dono de pequena empresa que roda os próprios anúncios (Meta Ads e/ou Google Ads) e tem pouca familiaridade com métricas.

**Problema hoje:** a primeira sessão exige 4–5 passos manuais sem guia:
cadastro → login → Dashboard vazio ("Seus resultados começam aqui") → `/app/account` → OAuth → volta a `/app/account` com "Você já pode sincronizar" → precisa voltar ao Dashboard e clicar em "Sincronizar dados".

**Objetivo:** quem acabou de criar a conta deve ver o resultado dos próprios anúncios em poucos minutos, sempre sabendo qual é o próximo passo.

**Critérios de sucesso**
- Após conectar uma plataforma, os dados são buscados sem nenhum clique extra e o usuário cai no Dashboard já com o resultado (ou com um erro claro).
- Em qualquer momento da primeira sessão há um próximo passo visível.
- Basta **uma** plataforma (Meta *ou* Google) para concluir; a outra é sugestão opcional.
- Falhas comuns (sincronização falha, conta sem campanhas com atividade, ainda não sincronizou) têm mensagem com a ação certa.

**Fora do escopo:** redesenho dos KPIs (sub-projeto 2), mudanças no assistente de IA (sub-projeto 3), alertas padrão e sync periódico, suporte a várias contas por plataforma.

## 2. Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Formato | Checklist (cartão) no Dashboard, não wizard | Não bloqueia o usuário; fácil de retomar; reaproveita o app existente |
| Fonte do progresso | **Derivado** do estado real (contas, sync, dados) | Sem tabela/migração; nunca fica desalinhado (desconectar reabre o item) |
| Persistência | Apenas "dispensado" em `usuarios.preferences.onboarding.dismissed` | `preferences` (JSON) já existe |
| Quem dispara o sync | **Front**, ao voltar do OAuth, via `POST /metricas/sincronizar` existente | Mostra progresso/erro; não mexe no fluxo de segurança do callback |

### Ajuste em relação ao design discutido
Foi discutido mudar o `redirect` dos callbacks OAuth no back. Para **não tocar no fluxo de segurança**, os callbacks do Meta e do Google continuam apontando para `/app/account?<plataforma>=<resultado>`. A página **Account**, ao ver `conectado`, redireciona no front para `/app?conectado=<plataforma>`. O efeito para o usuário é o mesmo (cai no Dashboard). Resultados de erro (`negado`, `erro`, `sem-conta`, `troca-bloqueada`) continuam exibidos na página Account, que já tem as mensagens e o botão de tentar de novo. Erros de **sincronização** aparecem no cartão.

## 3. Componentes

### 3.1 `OnboardingCard` (front, novo) — `src/components/OnboardingCard.jsx` + `src/styles/Onboarding.css`
Cartão no topo do Dashboard, `<section role="region" aria-label="Primeiros passos">`, lista ordenada de 3 itens.

Entrada (props): `statuses` não é prop; o cartão busca `GET /meta/status` e `GET /google/status`. Recebe de fora: `hasData`, `lastSyncedAt`, `sync` (estado do auto-sync: `idle | running | error`, mais `onRetry`).

| # | Item | Pronto quando | Em andamento | Pendente (ação) | Erro |
|---|---|---|---|---|---|
| 1 | Conectar sua conta de anúncios | alguma plataforma `conectado: true` | — | botões "Conectar Meta Ads" / "Conectar Google Ads" (reaproveita `connect()` da Account, extraído para um helper) | falha ao iniciar OAuth: mensagem + tentar de novo |
| 2 | Buscar seus dados | `lastSyncedAt` existe ou `hasData` | `sync === 'running'`: "Buscando suas campanhas…" (`aria-live="polite"`) | conectado mas sem sync: botão "Buscar meus dados" | `sync === 'error'`: mensagem do back + "Tentar de novo" (+ link "Ver conexões" se for reconexão) |
| 3 | Ver seu primeiro resultado | `hasData === true` | — | aguardando o item 2 | item 2 concluído e `hasData === false`: "Sua conta não tem campanhas com atividade neste período. Quando tiver, elas aparecem aqui." |

Estados do cartão:
- **Nenhuma plataforma conectada:** mostra os 3 itens e o link **"Ver com dados de exemplo"** (`/demo`).
- **Todos os itens prontos:** mensagem "Tudo pronto! Estes são os resultados dos seus anúncios." + botão "Ocultar". Se faltar uma plataforma, sugere "Conectar Google Ads também" / "Conectar Meta Ads também" (link para `/app/account`). Ao ocultar, grava `dismissed`.
- **Dispensado** (`preferences.onboarding.dismissed === true`) ou **modo demo** (`eyesight-demo === '1'`): não renderiza nada.
- **Carregando** statuses/preferências: não renderiza (evita piscar o cartão).
- Status ícone + texto em cada item (nunca só cor), tema claro/escuro via tokens de `variables.css`/`Theme.css`.

### 3.2 Hook `useAutoSync` (front, novo) — `src/hooks/useAutoSync.js`
Responsabilidade única: executar a sincronização inicial uma vez ao voltar do OAuth.
- Lê `?conectado=meta|google` (valor validado contra a lista permitida).
- Remove o parâmetro da URL imediatamente (`replace`), de modo que recarregar a página **não** dispara outro sync.
- Guarda com `useRef` contra execução dupla (StrictMode).
- Chama `api.post('/metricas/sincronizar', { periodo: 'last_30d', platform })`.
- Expõe `{ state: 'idle'|'running'|'error', message, retry, reloadToken }`. `retry` reutiliza a mesma chamada (também usada pelo botão "Buscar meus dados"). Em sucesso, incrementa `reloadToken`.
- Falha parcial (uma plataforma ok, outra não): trata como sucesso se alguma plataforma sincronizou; o aviso entra em `message` e é mostrado no cartão sem bloquear.

### 3.3 Alterações em componentes existentes (front)
- `pages/Dashboard.jsx`: renderiza `<OnboardingCard />` acima do `AnalyticsWorkspace`, mantém `hasData`/`lastSyncedAt` em estado (recebidos do workspace) e passa `reloadToken` ao workspace.
- `components/AnalyticsWorkspace.jsx`: novas props opcionais `onData(result)` (chamada após cada carga bem-sucedida) e `reloadToken` (entra nas dependências do efeito de carga para refazer a busca). Sem outras mudanças de comportamento. Sem as props, funciona como hoje.
- `pages/Account.jsx`: se `?meta=conectado` ou `?google=conectado`, `navigate('/app?conectado=<plataforma>', { replace: true })`. Os demais resultados seguem como estão.
- `pages/Layout.jsx`: `leaveDemo` navega para `/app` se houver `token` (usuário logado que visitou a demo pelo cartão), senão para `/` como hoje.
- `services/demoApi.js`: `PUT /auth/me` e `GET /auth/me` já existem na demo; nenhuma mudança necessária, pois o cartão não renderiza em demo.

### 3.4 Back-end (única mudança)
`validators/authValidator.js` — `atualizarPerfilSchema.preferences` passa de `{ theme }` obrigatório para:
```js
z.object({
  theme: z.enum(['light', 'dark']).optional(),
  onboarding: z.object({ dismissed: z.boolean() }).strict().optional(),
}).strict().optional()
```
`atualizarPerfil` já faz merge raso (`{ ...current.preferences, ...preferences }`), então `alerts` e `theme` são preservados. O PUT exige `nome`; o front envia o nome obtido de `GET /auth/me`.

**Não há mudança** em callbacks OAuth, `schema.prisma`, rotas ou rate limits.

## 4. Fluxo de dados

1. Dashboard monta → `OnboardingCard` busca `/auth/me` (preferências), `/meta/status`, `/google/status`.
2. `AnalyticsWorkspace` carrega `/metricas/analytics` como hoje e chama `onData` → Dashboard guarda `hasData`, `lastSyncedAt`.
3. Usuário conecta (cartão ou Account) → OAuth → `/app/account?meta=conectado` → redireciona para `/app?conectado=meta`.
4. `useAutoSync` dispara o sync uma vez; cartão mostra "Buscando suas campanhas…".
5. Sucesso → `reloadToken++` → workspace recarrega → `onData` → itens 2 e 3 concluem. Erro → item 2 em erro com "Tentar de novo".

## 5. Tratamento de erros e casos de borda

- **Rate limit do sync (5/min por usuário):** o auto-sync usa 1 chamada; se a API responder 429, a mensagem do back ("Aguarde um minuto…") aparece no item 2 com "Tentar de novo".
- **Sync já em andamento (lock no back):** tratado como erro com a mensagem do back e retry.
- **Conectado sem sync** (usuário fechou a aba durante o sync): item 2 pendente com botão "Buscar meus dados"; sem auto-sync nesse caso (só dispara com `?conectado=`).
- **Conta sem campanhas com atividade:** item 3 explica; não é erro.
- **Falha ao carregar status/preferências:** o cartão não aparece (degradação silenciosa; o Dashboard continua funcionando).
- **Falha ao gravar `dismissed`:** o cartão some localmente e a gravação é tentada em silêncio; na próxima carga pode reaparecer. Sem bloquear o usuário.
- **Desconectar a conta depois:** item 1 volta a pendente automaticamente (progresso derivado), a menos que o usuário já tenha ocultado o cartão.
- **Parâmetro `conectado` inválido:** ignorado e removido da URL.

## 6. Testes

**Front (Vitest + Testing Library, seguindo `components/__tests__` e `pages/__tests__`)**
- `OnboardingCard`: renderiza cada estado da tabela (sem conexão; conectado sem sync; sync em andamento; sync com erro + retry; sem campanhas; tudo pronto + ocultar + sugestão da outra plataforma); não renderiza em demo, quando dispensado ou durante o carregamento; clicar "Ocultar" chama `PUT /auth/me` com `{ nome, preferences: { onboarding: { dismissed: true } } }`.
- `useAutoSync`: dispara uma única vez com `?conectado=meta`; remove o parâmetro; ignora valor inválido; erro e retry; sucesso incrementa `reloadToken`; sucesso parcial.
- `Account`: redireciona para `/app?conectado=…` em `conectado`; mantém a mensagem nos demais resultados.
- `AnalyticsWorkspace`: chama `onData` após carga; recarrega quando `reloadToken` muda.

**Back (`node --test`, em `src/test/`)**
- `authValidator.test.js` / `identity.test.js`: aceita `{ onboarding: { dismissed: true } }`, aceita `{ theme }` sozinho (compatibilidade), rejeita chaves desconhecidas e `dismissed` não booleano, e o merge preserva `alerts` e `theme`.

**Verificação manual:** fluxo completo com uma conta nova (cadastro → conectar → sync automático → resultado), em tema claro e escuro, navegação por teclado e leitor de tela no cartão, largura de celular.

## 7. Riscos e pendências

- **Dependência de configuração:** o fluxo real só funciona com as credenciais OAuth do Meta/Google configuradas e aprovadas (`status.configured`). Quando `configured === false`, o item 1 mostra "Integração ainda não configurada" em vez do botão. A aprovação dos apps nas plataformas para usuários reais é um risco externo ao código e deve ser verificada antes de abrir o produto ao público.
- **Dois pontos de "conectar":** o cartão e a página Account compartilham a lógica de iniciar o OAuth (helper extraído) para não divergirem.
- **Demo → app:** o link "Ver com dados de exemplo" liga o modo demo para um usuário logado; `leaveDemo` ajustado para devolvê-lo ao `/app`.
