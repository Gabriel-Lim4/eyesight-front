# Alerta por mudança de estado (sub-projeto 4, etapa 2)

Decisões tomadas de forma autônoma, a pedido do usuário ("pode fazer sem pedir minha autorização"). Reaproveita o motor diário da etapa 1 (`dailyRoutine.js`), o e-mail do resumo (`summaryEmail.js`), o token de cancelamento e a tabela `rotina_envios`. **Nenhum SQL novo**: não há coluna nem tabela nova.

## Objetivo
Avisar por e-mail, no máximo uma vez por dia, quando os anúncios de quem ligou a opção **passam a pedir atenção** (veredito dos últimos 7 dias muda de "dentro da meta"/"estável" para "atenção").

## Decisões
- Opt-in, desligado por padrão: `preferences.summary.alerts` (boolean), ao lado de `weekly`.
- Só a entrada em "atenção" gera e-mail. Voltar a "bom/estável" só atualiza o estado (sem e-mail).
- Sem estado anterior (primeira rodada depois de ligar): grava o estado e **não** envia, para não surpreender com um alerta sobre algo que já estava assim.
- Limites: no máximo 1 alerta por dia por usuário, e intervalo mínimo de `ALERT_MIN_GAP_DAYS = 3` dias entre alertas (evita ficar mandando e-mail quando o estado oscila).
- Se o resumo semanal foi enviado ao usuário na mesma rodada, o alerta é suprimido (o resumo já mostra a atenção); o estado é gravado do mesmo jeito.
- Veredito `insufficient` ou sem dados: não grava estado, não envia.

## Estado (sem mudança de esquema)
Linhas em `rotina_envios` (`UNIQUE (user_id, kind, period_key)`, `period_key` = data local `AAAA-MM-DD` no fuso `REPORT_TIME_ZONE`):
- `state_ok` / `state_attention`: o estado observado no dia. Reservar essa linha também garante que a verificação roda uma vez por dia. O estado anterior é a linha `state_*` mais recente (`sent_at`), lida **antes** de gravar a de hoje.
- `alert_attention`: alerta enviado no dia (a unicidade impede o segundo no mesmo dia; o intervalo de 3 dias olha a linha mais recente desse tipo). Se o envio falhar, a linha é apagada e o estado de hoje também, para tentar de novo na próxima rodada.

## Rodada diária
Depois do sync e do resumo (se houver), roda `sendAlerts` todos os dias: para cada usuário com `alerts === true` e conta conectada, no limite de `ALERT_BUDGET_MS = 2 * 60 * 1000`, aplica as regras acima. O orçamento é próprio, como nas outras fases.

## E-mail
`buildSummaryEmail` ganha `variant: 'alert'`: assunto "Seus anúncios passaram a pedir atenção"; abertura "Seus anúncios mudaram de estado desde a última verificação."; motivo "Você recebe este e-mail porque ligou os alertas no Eyesight."; link "Parar de receber alertas" com `&e=alertas`. Mesmo corpo (veredito, 4 números, até 3 ações, botão "Abrir o painel").

## Cancelamento e perfil
- `POST /resumo/cancelar` aceita `escopo: 'alertas'` (corpo) ou `e=alertas` (query): desliga `summary.alerts`; sem escopo continua desligando `summary.weekly`. O escopo não é assinado: só escolhe qual preferência do próprio dono do token é desligada.
- `authValidator`: `summary: { weekly?: boolean, alerts?: boolean }` estrito.
- `CancelSummary` lê `e=alertas` e mostra os textos de alertas ("Parar de receber os alertas?").
- `SummarySettings`: segunda caixa "Avisar quando meus anúncios passarem a pedir atenção" (desmarcada, mesmo comportamento otimista, no máximo 1 aviso por dia e intervalo de 3 dias), desabilitada na demonstração.

## Testes
Backend: transições (ok→atenção envia; atenção→atenção, ok→ok, atenção→ok não enviam; primeiro estado não envia), 1 por dia, intervalo de 3 dias, supressão após resumo, `insufficient`/sem dados, falha de envio apaga reservas, opt-in, orçamento, e-mail `variant: 'alert'`, cancelamento por escopo, validador. Frontend: caixa de alertas e `CancelSummary` por escopo.
