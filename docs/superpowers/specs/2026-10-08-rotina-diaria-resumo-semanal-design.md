# Rotina diária e resumo semanal por e-mail (sub-projeto 4, etapa 1)

A etapa 2 (alerta por mudança de estado, no máximo 1 por dia) terá spec própria e reaproveitará o motor desta etapa.

## Objetivo

Hoje nada roda sozinho: os dados só atualizam quando alguém abre o painel. Esta etapa entrega:
1. Uma rotina diária que sincroniza em segundo plano as contas conectadas, para o painel já estar atualizado ao abrir.
2. Um resumo semanal por e-mail, em linguagem simples, só para quem ligar a opção (opt-in).

## Decisões já tomadas

- Escopo em duas etapas: motor diário + resumo semanal agora; alertas depois.
- Opt-in: o resumo começa desligado; liga-se em "Meu perfil" ou numa oferta no cartão "Primeiros passos". Todo e-mail tem link de "parar de receber" que funciona sem login.
- Agendamento: `pg_cron` + `pg_net` no Supabase chamam uma rota protegida do backend (Render pode dormir, então não se usa relógio dentro do servidor). O segredo fica no Vault. A rota é independente de quem a chama; qualquer outro agendador serve de plano B.
- Conteúdo do e-mail: o mesmo veredito do painel (dos últimos 7 dias), os 4 números, até 3 ações e um link para o painel.

## Fora do escopo

- Alerta por mudança de estado (etapa 2), resumo diário, horário ou dia personalizável, outros canais além de e-mail, várias contas de e-mail por usuário.
- Verificar o domínio de envio no Resend (passo do usuário).

## Dados

### `usuarios.preferences.summary`
`{ weekly: boolean }` no JSON existente; padrão desligado (ausente = desligado). `authValidator.js` passa a aceitar `preferences.summary: z.object({ weekly: z.boolean() }).strict().optional()`, mantendo `theme` e `onboarding` como estão.

### Tabela `public.rotina_envios` (SQL aditivo e idempotente, `scripts/routine-additions.sql`, mais o modelo em `prisma/schema.prisma`)

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `uuid` PK, `gen_random_uuid()` | |
| `user_id` | `integer` NOT NULL | FK para `usuarios(pk_id_usuario)`, `ON DELETE CASCADE` |
| `kind` | `varchar(30)` NOT NULL | `weekly_summary` |
| `period_key` | `varchar(10)` NOT NULL | semana ISO no fuso `REPORT_TIME_ZONE`, ex. `2026-W41` |
| `sent_at` | `timestamptz` NOT NULL, `now()` | |

- `UNIQUE (user_id, kind, period_key)`.
- RLS ligado e `REVOKE ALL ... FROM anon, authenticated`, como as demais tabelas.
- O SQL só é aplicado no banco real com autorização expressa do usuário naquele momento.

## Backend

### Configuração
Variáveis novas em `config/env.js`: `JOBS_SECRET` e `UNSUBSCRIBE_SECRET`. Sem `JOBS_SECRET` a rota do job responde 503 (desligada, nunca aberta). Sem `UNSUBSCRIBE_SECRET` nenhum resumo é enviado (falha fechada) e o fato é registrado no log. `RESEND_API_KEY` e `EMAIL_FROM` já existem.

### Rota do job (`routes/jobsRoutes.js`)
- `POST /jobs/diario`: exige `Authorization: Bearer <JOBS_SECRET>`, comparado com `crypto.timingSafeEqual`; sem cabeçalho ou com valor errado → 401. Responde `202 { iniciado: true }` e processa em segundo plano. Se já houver uma rodada em andamento (flag no módulo), responde `409`.
- `GET /health` já existe e serve para acordar o servidor antes do job.

### Rodada diária (`services/dailyRoutine.js`)
Constantes nomeadas: `MAX_USERS = 50`, `SYNC_BUDGET_MS = 5 * 60 * 1000` e `SUMMARY_BUDGET_MS = 3 * 60 * 1000` (cada fase tem seu próprio orçamento de tempo), `SYNC_PERIOD = 'last_30d'`, `SUMMARY_DAYS = [1, 2, 3]` (segunda a quarta, no fuso configurado), `SUMMARY_KIND = 'weekly_summary'`.

1. **Sync:** lista usuários com ao menos uma linha em `contas_vinculadas` (Meta ou Google), ordenados pelo sync mais antigo (campanhas sem `sincronizado_em` primeiro), até `MAX_USERS`. Para cada um, executa `syncMetaAccount` e/ou `syncGoogleAccount` com `resolveDateRange({ periodo: SYNC_PERIOD })`, sequencialmente. Erro numa conta é capturado e registrado (`[JOB] ...`, sem tokens) e a rodada continua. Para ao atingir `MAX_RUN_MS`.
2. **Resumo:** se o dia da semana (no fuso `REPORT_TIME_ZONE`) está em `SUMMARY_DAYS`, para cada usuário com `preferences.summary.weekly === true` e conta conectada:
   - reserva `(user_id, 'weekly_summary', <semana ISO>)` em `rotina_envios` (insert ignorando conflito); se já existe, pula;
   - lê o e-mail em `auth.users` (`SELECT email FROM auth.users WHERE id = <usuarios.auth_user_id>::uuid`, via `prisma.$queryRaw`); sem e-mail → apaga a reserva, registra e pula;
   - calcula `getAnalytics(userId, { periodo: 'last_7d' })`; sem `hasData` ou sem veredito → apaga a reserva e pula;
   - monta o e-mail e envia; se o envio falhar, **apaga a reserva** (a próxima rodada, ainda de segunda a quarta, tenta de novo) e registra o erro.
   - Quem liga o resumo na quinta, sexta, sábado ou domingo recebe o primeiro na segunda seguinte.
3. Resultado da rodada (contagens de sincronizados, enviados, pulados e com erro) vai para o log, sem dados pessoais.

### E-mail (`services/summaryEmail.js` e `services/summaryCopy.js`)
- `buildSummaryEmail({ name, analytics, appUrl, unsubscribeUrl }) -> { subject, html, text }`, função pura.
- Assunto: "Seus anúncios estão melhores | estáveis | pedindo atenção · resumo da semana"; para `insufficient`: "Resumo da semana: ainda sem base para avaliar".
- Corpo: saudação com o nome; status com ícone e texto e a frase principal do veredito; os 4 números (investiu, pessoas que clicaram, resultados, custo por resultado), cada um com a comparação com os 7 dias anteriores somente quando `currentComplete && previousComplete`; até 3 ações; botão "Abrir o painel" para `FRONTEND_URL/app`; rodapé com o período, o motivo do envio e o link "Parar de receber". Layout em tabelas com estilos inline, texto escuro sobre fundo claro, sem imagens e sem pixel de rastreio, mais a versão em texto puro.
- Moeda `UNKNOWN`: sem valores em dinheiro e com aviso, como no painel.
- Todo texto vindo de fora (nome do usuário, nome de campanha) é escapado no HTML.
- `summaryCopy.js` **duplica o mínimo** de `eyesight-front/src/utils/verdictCopy.js` (frase por status, texto das 7 ações, rótulos dos 4 números) porque backend e frontend não compartilham pacote. Ambos os arquivos levam um comentário apontando para o outro; qualquer mudança de texto precisa ser feita nos dois.
- `emailService.js` ganha `enviarResumoSemanal({ to, subject, html, text, unsubscribeUrl })`, que envia pelo Resend com os cabeçalhos `List-Unsubscribe: <unsubscribeUrl>` e `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Sem `RESEND_API_KEY` lança erro (já é o comportamento atual).

### Token de cancelamento (`services/unsubscribeToken.js`)
- `createUnsubscribeToken(userId, now?)` e `verifyUnsubscribeToken(token, now?) -> userId | null`.
- Formato `v1.<base64url(userId.exp)>.<base64url(hmac)>`; HMAC-SHA256 com `UNSUBSCRIBE_SECRET` sobre `unsubscribe:v1:<userId>.<exp>`; validade de 400 dias; comparação em tempo constante; qualquer falha (formato, assinatura, expiração) → `null`.
- O link do e-mail é `FRONTEND_URL/cancelar-resumo?t=<token>`; o cabeçalho `List-Unsubscribe` usa o mesmo token no endpoint `POST /resumo/cancelar?t=<token>`.

### Rotas do resumo (`routes/resumoRoutes.js`)
- `POST /resumo/teste` (autenticada, 3 por hora por usuário): monta o e-mail com `last_7d` do usuário e envia para o e-mail da própria conta, mesmo com o resumo desligado; não grava em `rotina_envios`. Respostas: 200 enviado; 429 limite; 503 e-mail não configurado (`RESEND_API_KEY` ou `UNSUBSCRIBE_SECRET` ausentes); 409 sem dados para resumir; 502 falha do envio.
- `POST /resumo/cancelar` (pública, limitada por IP): aceita o token no corpo (`{ token }`) ou na query (`t`, para o cabeçalho de clique único). Token válido → define `preferences.summary.weekly = false` do dono do token (atualização do JSON preservando as demais chaves) e responde 200; inválido ou expirado → 400. Idempotente.

## Frontend

### `Meu perfil` — seção "Resumo semanal por e-mail" (`components/summary/SummarySettings.jsx`)
- Texto: "Toda segunda-feira, um e-mail com como estão seus anúncios, os 4 números e o que fazer agora. Você pode parar quando quiser."
- Caixa de marcar nativa "Receber o resumo semanal", desmarcada por padrão; ao mudar grava com `PUT /auth/me` (`preferences.summary.weekly`) de forma otimista e reverte com mensagem se falhar; o resultado vai para uma região `role="status"` ("Resumo semanal ligado." / "desligado.").
- Botão "Enviar um exemplo para mim" (`POST /resumo/teste`) com estados: enviando, sucesso ("Enviamos um exemplo para o e-mail da sua conta."), limite de 3 por hora, "O envio de e-mail ainda não está configurado" (503), sem dados (409) e falha genérica com "Tentar de novo".
- Modo demo: caixa e botão desabilitados com a nota "Indisponível na demonstração".

### `OnboardingCard`
- Depois do primeiro resultado, o bloco final ganha: "Quer receber um resumo toda segunda-feira?" com o botão "Ligar o resumo semanal". Sucesso: "Resumo ligado. Você pode desligar em Meu perfil." Não aparece se já estiver ligado. Não é um passo novo da lista, então a regra de "tudo concluído" não muda.

### Página pública `/cancelar-resumo` (`pages/CancelSummary.jsx`, rota em `App.jsx`)
- Fora da área logada. Título "Parar de receber o resumo semanal?", botão "Parar de receber" (44px) e link "Voltar ao início". Só o clique cancela (`POST /resumo/cancelar` com o token); abrir o link não faz nada.
- Sucesso: "Pronto. Você não receberá mais o resumo semanal. Para voltar a receber, ligue em Meu perfil." Link inválido, expirado ou sem token: "Este link não é válido ou expirou. Entre no app e desligue o resumo em Meu perfil."
- `main` com título, mensagens em `role="status"`/`role="alert"`, estilos nos dois temas.

## Agendamento (configurado pelo usuário/Supabase, não por código do app)
- Extensões `pg_cron` e `pg_net` ativadas; segredo no `supabase_vault`.
- Dois agendamentos diários em UTC (o Brasil não usa horário de verão): `GET /health` às 11:55 (08:55 em Brasília) e `POST /jobs/diario` às 12:00 (09:00), este com o cabeçalho `Authorization: Bearer <JOBS_SECRET>` lido do Vault.
- Aplicar o SQL das extensões e dos agendamentos só com autorização expressa do usuário.

## Erros e casos de borda
- Plataforma fora do ar ou conta que exige reconexão: registra e segue; os dados antigos continuam no painel.
- Falha no envio: a reserva é apagada e a próxima rodada tenta de novo (segunda a quarta); depois disso a semana é pulada.
- Usuário sem e-mail legível: pulado e registrado.
- Duas chamadas simultâneas: a segunda recebe 409. Chamadas repetidas na semana: a unicidade impede e-mail duplicado.
- Rodada longa: para em 50 usuários ou 8 minutos; os demais ficam para o dia seguinte, começando pelos mais atrasados.
- Render dormindo: a chamada a `/health` antes do job acorda o servidor; se ainda assim falhar, perde-se só aquele dia.

## Segurança e privacidade
- `JOBS_SECRET` ausente → 503; errado → 401; comparação em tempo constante.
- O token de cancelamento só contém o `userId`, é validado antes de qualquer escrita e só altera `summary.weekly` do próprio dono.
- O e-mail não contém tokens de contas de anúncios nem dados de terceiros; textos externos são escapados.
- O resumo respeita o opt-in: sem `summary.weekly === true` o job não envia.
- Logs do job não contêm e-mail, nome nem tokens.

## Testes

Backend (`node --test`):
- `summaryEmail`: assunto e corpo por status; comparação só com os dois períodos completos; moeda `UNKNOWN` sem valores em dinheiro; escape de `<img onerror>` e `&` em nome e campanha; texto puro; link e cabeçalho de cancelamento; `insufficient`.
- `unsubscribeToken`: válido, adulterado, expirado, formato errado, outro segredo.
- Rota do job: sem segredo (503), sem cabeçalho/errado (401), certo (202), simultâneo (409).
- `dailyRoutine`: só envia a quem ligou o resumo; só nos dias `SUMMARY_DAYS`; reserva antes de enviar; apaga a reserva se o envio falhar; não duplica na mesma semana; pula sem e-mail ou sem dados; erro de um usuário não interrompe os demais; respeita `MAX_USERS` e `MAX_RUN_MS`; ordem do sync (mais antigos primeiro); chave de semana ISO no fuso configurado.
- `POST /resumo/teste`: sucesso, limite, 503 sem configuração, 409 sem dados, vai só para o e-mail do próprio usuário e não grava `rotina_envios`.
- `POST /resumo/cancelar`: token válido desliga só o dono e preserva outras preferências; inválido → 400; idempotente; aceita corpo e query.
- `authValidator`: aceita `preferences.summary` estrito e rejeita chaves extras.

Frontend (Vitest):
- `SummarySettings`: estados da caixa, reversão em falha, cada resultado do botão de exemplo, demo desabilitado.
- `CancelSummary`: só cancela no clique, sucesso, link inválido/sem token.
- `OnboardingCard`: a oferta aparece só com o primeiro resultado e sem resumo ligado; liga e some; o resto do cartão não muda.

## Ordem de entrega
1. Backend: `summaryCopy`/`summaryEmail`, `unsubscribeToken`, `emailService.enviarResumoSemanal`, SQL e modelo Prisma de `rotina_envios`, validador de perfil e `env.js`.
2. Backend: `dailyRoutine` e `POST /jobs/diario`.
3. Backend: `POST /resumo/teste` e `POST /resumo/cancelar`.
4. Frontend: `SummarySettings`, oferta no `OnboardingCard` e `CancelSummary`.
5. Verificação final; com autorização expressa: aplicar `routine-additions.sql`, configurar o agendamento e fazer um envio real de teste.
