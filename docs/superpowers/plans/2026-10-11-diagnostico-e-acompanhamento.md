# Diagnóstico e acompanhamento — plano de implementação

> Execução nativa (sozinho, com TDD), uma revisão final com modelo fable e uma única passada de correção.

**Meta:** entregar `changeExplanation`, `followUp` e `spend_without_results`.
**Spec:** `docs/superpowers/specs/2026-10-11-diagnostico-e-acompanhamento-design.md`
**Stack:** Express + Prisma (node --test) · React + Vitest.

## Restrições globais
- Nada de schema novo, nada de push, nada em produção, nenhum segredo impresso.
- Textos de veredito espelhados em `verdictCopy.js` (front) e `summaryCopy.js` (back).
- Tema: só variáveis/tokens existentes; `npm run lint` e a suíte devem ficar verdes.

## Review Focus
- Divisão por zero e valores ausentes na decomposição (período sem cliques, sem conversões).
- Plano marcado e desmarcado várias vezes: `doneAt` consistente, corte muda.
- Planos antigos (passos sem `doneAt`) não podem quebrar nem mostrar acompanhamento.
- Plano de ação sem `campaign_id` (nível de conta).
- Falha na consulta do acompanhamento não pode derrubar `GET /ia/planos`.

## Tarefas
1. **changeExplainer (back):** `explainCostChange` + testes (soma = 1, nulos, principal, compensação).
2. **Wire + UI (back/front/demo):** `changeExplanation` em `getAnalytics`; `ChangeExplainer.jsx` + `changeCopy.js`;
   cópia mínima para a demo; testes.
3. **Acompanhamento (back):** `markStep`, `firstDoneAt`, `evaluateFollowUp`, `followUp` em `listarPlanos`; testes.
4. **Acompanhamento (front):** bloco no `ActionPlan`, releitura após marcar, demo; testes.
5. **Gasto sem resultado:** veredito, ação, textos nos dois lados, `REASON_CODES`/`ACTION_CODES`; testes.
6. **Verificação geral + revisão final + correções.**
7. **Documentação:** diário de bordo, roteiro de teste de usabilidade, roteiro de apresentação.
