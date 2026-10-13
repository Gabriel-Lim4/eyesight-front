# Diagnóstico de variação, acompanhamento do plano e gasto sem resultado

Data: 2026-10-11 · Escopo: entrega do TCC (prazo de 3 semanas) · Sem mudança de schema no banco.

## Entendimento (o que foi pedido e o que decidi)

O usuário quer entregar o TCC bem acabado. Foram escolhidas, entre as ideias levantadas, as três de maior valor com
menor risco, todas apoiadas em dados que o Eyesight já guarda (`campaign_daily_metrics`, `planos_acao`):

1. **Por que mudou?** Quando o custo por resultado (ou por clique) varia, dizer qual fator causou a variação.
2. **Acompanhamento do plano de ação:** depois que o usuário marca passos como feitos, mostrar se o indicador melhorou.
3. **Gasto sem resultado:** alertar quando há investimento relevante sem nenhuma conversão registrada.

Fora do escopo (viram "trabalhos futuros" no documento do TCC): novos canais, ações que escrevem nas plataformas,
várias contas de cliente, plano pago, previsão de orçamento (pacing).

## 1. Por que mudou? (`changeExplanation`)

**Método.** O custo é um produto de fatores, então a variação se decompõe de forma exata em logaritmos:

- `CPC = (CPM / 1000) / CTR`  →  `Δln CPC = Δln CPM − Δln CTR`
- `CPA = CPC / TCV`, com `TCV = conversões / cliques`  →  `Δln CPA = Δln CPM − Δln CTR − Δln TCV`

A parcela de cada fator é `contribuição_i / Δln custo`; as parcelas somam 1 (100%). Parcela negativa significa que o
fator compensou parte da variação. O fator principal é o de maior parcela positiva.

**Regras de segurança (sem dado, sem explicação):**
- exige período atual e anterior completos, cliques ≥ 30 nos dois (`MIN_CLICKS` do veredito);
- para `cpa`, exige conversões > 0 nos dois períodos;
- qualquer fator ≤ 0 ou ausente em um dos períodos → `null`;
- variação do custo menor que a faixa de estabilidade (5%) → `null` (não há o que explicar).

**Contrato.** `explainCostChange(current, previous, indicator)` é função pura em
`eyesight-backend/src/services/changeExplainer.js`. Retorna
`{ indicator, costChange, factors: [{ key: 'cpm'|'ctr'|'cvr', change, share }], main }` ou `null`.
`getAnalytics` expõe o resultado como `changeExplanation` (falha nunca derruba a resposta, como o veredito).
O front tem uma cópia mínima da função só para a demonstração (a demo não importa código do servidor).

**Interface.** Bloco "Por que o custo por resultado subiu/caiu X%?" logo abaixo do veredito, em linguagem simples:
o motivo principal em destaque e, se houver, "também contribuiu" e "compensou em parte". Os textos ficam em
`eyesight-front/src/utils/changeCopy.js`.

## 2. Acompanhamento do plano de ação (`followUp`)

Sem coluna nova: cada passo do plano (`steps` é JSON) ganha `doneAt` (ISO) quando é marcado e perde ao desmarcar.

- **Corte:** a data (fuso do relatório, `dayKey`) do primeiro passo concluído (`firstDoneAt`).
- **Métrica por ação:** `campaign_over_goal` → custo por resultado; `campaign_low_ctr` → CTR;
  `campaign_without_results` → resultados por dia; `budget_exceeded` → gasto por dia;
  `enable_conversion_tracking` → sem acompanhamento.
- **Janelas:** "antes" = até 7 dias antes do corte; "depois" = do dia seguinte ao corte até hoje.
  O dia do corte é excluído por ser parcial.
- **Estados:** `waiting` (menos de 3 dias depois, ou poucos cliques; informa quantos dias faltam),
  `unavailable` (sem dados antes), `ready` com `before`, `after`, `changePct` e `result` (`better`/`worse`/`same`,
  faixa de 5%). Para métricas em que menor é melhor, queda = melhor.
- **Honestidade:** o texto sempre diz que outros fatores também podem ter influenciado; é acompanhamento, não prova.
- `GET /ia/planos` devolve `followUp` em cada plano; o front relê a lista após marcar um passo.

## 3. Gasto sem resultado (`spend_without_results`)

Novo motivo de **atenção** no veredito quando: conversões são medidas e iguais a zero, o período está completo,
há meta de custo por resultado (`cpaMax`) e o gasto é ≥ 2× essa meta (`SPEND_WITHOUT_RESULTS_GOAL_MULTIPLE = 2`).
Vem com uma ação de mesmo código (sem plano de ação, para não ampliar o escopo da IA). Como o alerta por e-mail
reage à mudança de estado do veredito, ele passa a avisar esse caso sem código novo. Textos em
`verdictCopy.js` (front) e `summaryCopy.js` (back), mantidos em espelho.

## Riscos e decisões

- Ruling: sem alteração de schema, para não exigir SQL em produção durante o período de entrega.
- Ruling: decomposição logarítmica em vez de comparar variações percentuais, pois é exata e explicável na banca.
- Ruling: pacing de orçamento adiado; `budgetMax` hoje significa "limite do período selecionado", e projetar
  para o fim do mês exigiria uma nova configuração (mensal) que não existe.
- Custo se errado: o bloco "Por que mudou" some quando os dados não bastam; nada quebra.

## Testes (resumo)

Função pura: soma das parcelas = 1; cada caso de `null`; fator dominante; compensação. Serviço: `changeExplanation`
presente/ausente. Plano: `doneAt` ao marcar/desmarcar; `firstDoneAt`; `evaluateFollowUp` (waiting, unavailable,
ready better/worse/same, métrica invertida). Veredito: `spend_without_results` (com e sem meta, limiar, conversão
não medida). Front: componente do bloco, cópia, acompanhamento no plano, demonstração.
