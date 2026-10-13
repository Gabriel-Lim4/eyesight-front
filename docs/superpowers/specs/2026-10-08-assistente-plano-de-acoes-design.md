# Assistente integrado, fase B: plano de ações com passos marcáveis

Sub-projeto 3, parte B. Depende da fase A (`2026-10-08-assistente-explicador-design.md`): reaproveita `buildExplainContext`, o recorte da tela e o `withAiLimit`.

## Objetivo

Na Visão geral, cada ação de "O que fazer agora" pode ganhar um passo a passo de 3 a 5 passos curtos, escrito pela IA com os números da conta. O usuário marca cada passo como feito, e o progresso fica salvo. O plano pertence à ação (tipo + campanha), não ao período.

## Decisões já tomadas

- Os cartões do plano são as ações que o veredito já calcula. A IA só escreve o passo a passo; nunca inventa prioridades nem contradiz o painel.
- A IA só é chamada no clique em "Ver passo a passo" (ou "Gerar de novo"). Nada é gerado sozinho.
- O plano fica ligado à ação. Ele aparece enquanto a ação estiver no veredito atual. Se a ação some, o plano some da tela; se ela voltar em até 30 dias, o plano volta com o progresso.
- Armazenamento: tabela nova `planos_acao`, criada por SQL aditivo e idempotente. O SQL só é aplicado no banco real com autorização expressa do usuário naquele momento.

## Fora do escopo

- Lembretes ou e-mail sobre passos pendentes (sub-projeto 4).
- Passos que se aplicam sozinhos nas plataformas.
- Excluir planos manualmente.
- Planos fora da Visão geral e compartilhamento entre usuários.
- Plano para as ações `nothing_urgent` e `refresh_data`.

## Banco de dados

Arquivo novo `eyesight-backend/scripts/plans-additions.sql` (separado do `activation-additions.sql`, para não reexecutar a ativação) e o modelo correspondente em `prisma/schema.prisma`.

Tabela `public.planos_acao`:

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `uuid` PK, padrão `gen_random_uuid()` | |
| `user_id` | `integer` NOT NULL | FK para `usuarios(pk_id_usuario)`, `ON DELETE CASCADE` |
| `action_key` | `varchar(80)` NOT NULL | `<código>:<campaignId ou ->`, montada só pelo servidor |
| `action_code` | `varchar(50)` NOT NULL | |
| `campaign_id` | `integer` NULL | sem FK |
| `steps` | `jsonb` NOT NULL | `[{ id: 's1', text, done }]` |
| `generated_at` | `timestamptz` NOT NULL, padrão `now()` | |
| `last_seen_at` | `timestamptz` NOT NULL, padrão `now()` | |
| `updated_at` | `timestamptz` NOT NULL, padrão `now()` | |

- Restrição `UNIQUE (user_id, action_key)`; índice em `(user_id, last_seen_at)`.
- Mesmo padrão de segurança das tabelas existentes: `ENABLE ROW LEVEL SECURITY` e `REVOKE ALL ... FROM anon, authenticated` (todas as tabelas públicas do projeto têm RLS ligado; o backend acessa por conexão direta).
- Tudo com `IF NOT EXISTS`; nenhuma alteração em tabelas existentes.

## Backend

### Escopo e validação compartilhados

A função `analyticsQuery` de `iaController.js` (recorte: `periodo`, `startDate`, `endDate`, `platform`, `campaignId`, `currency`) é extraída para `services/aiScope.js` e usada pelo chat e pelas rotas de plano, sem mudar o comportamento do chat.

### `services/planService.js` (funções puras e de dados)

- `PLAN_ACTION_CODES = ['budget_exceeded','campaign_over_goal','campaign_low_ctr','campaign_without_results','enable_conversion_tracking']`.
- `actionKey({ code, campaignId })`: `"<code>:<campaignId>"` ou `"<code>:-"`; lança 400 se o código não está em `PLAN_ACTION_CODES` ou `campaignId` não é inteiro positivo.
- `parsePlanAction(raw)`: valida `{ code, campaignId? }` em modo estrito.
- `validateSteps(raw)`: exige objeto `{ passos: string[] }` com 3 a 5 itens; cada item aparado, não vazio e com até 200 caracteres; devolve `[{ id: 's1', text, done: false }, ...]`; qualquer violação lança erro 502 ("A IA não conseguiu montar os passos. Tente novamente.") e nada é gravado.
- `findCurrentAction(analytics, action)`: procura a ação em `analytics.verdict.actions` (mesmo código e `campaignId`); sem veredito ou sem a ação → `null`.

### Rotas (todas em `iaRoutes.js`, autenticadas, sempre filtradas por `user_id`)

- `GET /ia/planos` (recorte na query): recalcula o veredito com `getAnalytics`; apaga os planos do usuário com `last_seen_at` mais antigo que 30 dias; para cada ação atual elegível que tenha plano, atualiza `last_seen_at` e o inclui. Resposta: `{ planos: [{ id, actionKey, actionCode, campaignId, steps, generatedAt }] }` (apenas planos de ações atuais). Não chama a IA.
- `POST /ia/planos` (corpo: `{ action: { code, campaignId? }, regenerate?: boolean }` mais o recorte):
  1. Valida a ação e o recorte (400 antes de qualquer consulta de métricas).
  2. Recalcula o veredito; ação fora dele → 404 "Esta ação não está mais no painel."
  3. Plano existente e sem `regenerate` → 200 com o plano existente, sem chamar a IA.
  4. Caso contrário, monta o contexto com `buildExplainContext(analytics, { kind: 'action', code, campaignId })`, chama a IA dentro do `withAiLimit` (20/h, uma por vez), valida os passos e faz upsert por `(user_id, action_key)`. Criação → 201; `regenerate` substitui os passos (todos `done: false`) → 200.
  5. Resposta: `{ plano }`.
- `PATCH /ia/planos/:id/passos/:stepId` (corpo: `{ done: boolean }`): dentro de `prisma.$transaction`, trava a linha (`SELECT ... FOR UPDATE`) do plano do usuário, altera só aquele passo e atualiza `updated_at`. Plano de outro usuário, `id` inválido ou passo inexistente → 404. Resposta: `{ plano }`.

### Geração dos passos (`iaService.js`)

- `complete(messages, { structured })` passa a aceitar, além de `true` (análise de campanha, comportamento atual inalterado), um objeto `{ name, schema, instruction }`. Na OpenAI usa `json_schema` estrito com esse esquema; nos demais provedores usa `json_object` com a `instruction` como última mensagem. O resultado devolvido é o JSON já parseado, validado por quem chamou.
- `gerarPassos({ context })` em `iaService.js`: esquema `{ passos: string[] }`; pedido: de 3 a 5 passos curtos, em linguagem simples, que o dono do negócio faz na própria plataforma (Meta ou Google), usando só os números do bloco do painel, sem prometer resultado e sem comparar com o mercado; se o veredito for `insufficient`, o primeiro passo explica o que falta.
- Erros do provedor continuam mapeados como hoje (429 de limite, 503 indisponível) e registrados no log do servidor sem a chave.

## Frontend

### Hook `usePlans(filters)` (`src/components/plans/usePlans.js`)

- Carrega `GET /ia/planos` com o recorte ao montar, quando o recorte muda e depois de uma sincronização (via `reload` existente). Falha no carregamento só esconde a área de planos.
- Expõe `planFor(action)`, `generate(action, { regenerate })`, `toggle(planId, stepId, done)`, `state` por ação (`idle | generating | error | limit`) e `error`.
- Uma geração por vez no cliente (as demais ficam bloqueadas enquanto uma roda).
- `toggle` é otimista: aplica na hora, envia o `PATCH`, e reverte com mensagem "Não foi possível salvar. Tente de novo." se falhar. Cliques no mesmo passo são enviados em ordem; vale o último valor escolhido.
- Respostas de requisições descartadas (recorte mudou) não alteram o estado atual (mesmo cuidado de painel por identificador da fase A).

### Componente `ActionPlan` (`src/components/plans/ActionPlan.jsx`)

Renderizado dentro de cada ação elegível em `NextActions`, abaixo do texto e ao lado do botão "Explicar":
1. Sem plano: botão "Ver passo a passo" (ícone + texto, 44px).
2. Gerando: botão com `aria-disabled` e texto "Preparando os passos…"; os botões das outras ações também ficam bloqueados.
3. Com plano: progresso "N de M passos feitos", caixas de marcar nativas (`<input type="checkbox">` com rótulo), "Gerado em dd/mm" e botão discreto "Gerar de novo". Todos marcados: "Tudo feito. Veja nos próximos dias se o resultado melhorou."
4. Erro ou limite: mensagem do servidor num `role="alert"`; "Tentar de novo" só no erro, não no limite de 20/h. Marcações existentes nunca se perdem.
5. IA indisponível (`available === false` do `useExplainer`): o botão de gerar fica desabilitado, ligado ao aviso "Assistente indisponível no momento."; planos existentes continuam visíveis e marcáveis.
- Passos são sempre renderizados como texto.

### Integração

- `SimpleOverview` cria `usePlans(filters)` e passa `plans` (e o estado de disponibilidade da IA) a `NextActions`. Sem a prop `plans`, o HTML de `NextActions` é idêntico ao atual.
- Estilos `.pl-*` em `src/styles/Plans.css`, com variantes para `body.light-mode`, contraste adequado e alvos de 44px.

### Demo

`demoApi`: `GET /ia/planos` → `{ planos: [] }`; `POST /ia/planos` → 3 passos fixos de exemplo, sem números, marcados como demonstração; `PATCH` funciona só em memória da página (nada é gravado). Os demais POST/PUT continuam bloqueados.

## Erros e casos de borda

- Ação sumiu entre o clique e a resposta: 404 "Esta ação não está mais no painel."; o front recarrega planos e veredito.
- 429 (limite ou geração em andamento) e 503 (IA sem configuração ou provedor fora do ar): mensagem no cartão, nenhum plano criado.
- Passos inválidos (502): nada é gravado; o botão continua disponível.
- `regenerate` que falha: o plano antigo permanece com seus passos marcados.
- Duplo clique ou duas abas: a unicidade resolve; o segundo `POST` devolve o plano existente sem chamar a IA.
- Veredito `insufficient`: primeiro passo explica o que falta.
- Tabela ausente no banco: as rotas respondem erro genérico e registram o motivo; a Visão geral segue funcionando sem a área de planos.

## Segurança

- O cliente envia apenas código e `campaignId`; o servidor valida contra a lista fechada, recalcula o veredito e só aceita ações que existem nele. Texto livre do usuário não entra no pedido à IA.
- Toda leitura e escrita filtra por `user_id`; id de plano alheio responde 404 igual a inexistente.
- Passos de 3 a 5, até 200 caracteres cada; resposta fora disso é rejeitada, não corrigida.
- Nenhum SQL é aplicado no banco real sem autorização expressa do usuário.

## Testes

Backend (`node --test`):
- `actionKey` e `parsePlanAction`: códigos válidos e inválidos, `campaignId` inválido.
- `validateSteps`: 2 e 6 passos, passo vazio, passo com mais de 200 caracteres, tipo errado → 502; caso válido gera ids `s1..sN`.
- `findCurrentAction` com e sem veredito.
- `POST /ia/planos`: cria (201), devolve existente sem chamar a IA, `regenerate` zera os "feito", ação fora do veredito → 404, entrada inválida → 400 antes de consultar métricas, falha da IA não grava.
- `GET /ia/planos`: só devolve planos de ações atuais, atualiza `last_seen_at`, apaga planos com mais de 30 dias, não vaza planos de outro usuário.
- `PATCH`: marca e desmarca, plano alheio e passo inexistente → 404, atualização dentro de transação.
- `complete()` com esquema por chamada: a análise de campanha continua idêntica; o modo JSON de outros provedores usa a instrução.
- Chat da fase A inalterado depois da extração de `aiScope.js`.

Frontend (Vitest):
- `usePlans`: carrega, gera, regenera, alterna com reversão em falha, ignora respostas de requisições descartadas, bloqueia gerações simultâneas.
- `ActionPlan`: cada estado (sem plano, gerando, com plano, concluído, erro, limite, IA indisponível), progresso, caixas acessíveis por teclado, texto sem HTML.
- `NextActions` sem a prop `plans` mantém o HTML atual; ações `nothing_urgent` e `refresh_data` não mostram plano.
- Demo: gera, marca e não grava nada.

## Ordem de entrega

1. Backend: `plans-additions.sql`, modelo Prisma, `aiScope.js`, `planService.js`, `complete()` com esquema por chamada e `gerarPassos`.
2. Backend: as três rotas, com testes.
3. Frontend: `usePlans`, `ActionPlan` e `Plans.css`.
4. Frontend: integração em `NextActions` e `SimpleOverview`, demo e verificação final.

Aplicar `plans-additions.sql` no banco é um passo separado, feito só depois de o usuário ver o SQL e autorizar.
