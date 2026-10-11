import { describe, expect, it } from 'vitest';
import { CARD_COPY, actionText, costNoun, headline, previousLabel, previousLabelTo, reasonText } from '../verdictCopy';

const plain = text => text.replace(/\s/g, ' ');
const ctx = { currency: 'BRL', period: { period: 'last_30d', days: 30 } };
const verdict = (status, basis, reasons = [], insufficientReason = null) => ({ status, basis, indicator: 'cpa', insufficientReason, reasons, highlights: [], actions: [] });

describe('previous period labels', () => {
  it('names preset periods by their length', () => {
    expect(previousLabel({ period: 'last_30d', days: 30 })).toBe('os 30 dias anteriores');
    expect(previousLabelTo({ period: 'last_30d', days: 30 })).toBe('aos 30 dias anteriores');
    expect(previousLabel({ period: 'last_7d', days: 7 })).toBe('os 7 dias anteriores');
  });
  it('falls back to the generic previous period', () => {
    for (const period of ['custom:2026-09-01:2026-09-10', 'today', 'yesterday']) {
      expect(previousLabel({ period, days: 10 })).toBe('o período anterior');
      expect(previousLabelTo({ period, days: 10 })).toBe('ao período anterior');
    }
  });
  it('names the cost noun by indicator', () => {
    expect(costNoun('cpa')).toBe('resultado');
    expect(costNoun('cpc')).toBe('clique');
  });
});

describe('headline', () => {
  it('covers good, stable and the goal basis', () => {
    expect(headline(verdict('good', 'goal'), ctx)).toBe('Seus anúncios estão dentro da sua meta.');
    expect(headline(verdict('good', 'comparison'), ctx)).toBe('Seus anúncios estão melhores que os 30 dias anteriores.');
    expect(headline(verdict('stable', 'comparison'), ctx)).toBe('Seus anúncios estão estáveis em relação aos 30 dias anteriores.');
  });
  it('picks the attention headline by signal priority', () => {
    const r = code => ({ code, params: {} });
    expect(headline(verdict('attention', 'goal', [r('cost_above_goal')]), ctx)).toBe('Atenção: o custo por resultado está acima da sua meta.');
    expect(headline(verdict('attention', 'comparison', [r('cost_worse')]), ctx)).toBe('Atenção: seus anúncios pioraram em relação aos 30 dias anteriores.');
    expect(headline(verdict('attention', 'comparison', [r('ctr_below_min'), r('cost_better')]), ctx)).toBe('Atenção: poucas pessoas estão clicando nos seus anúncios.');
    expect(headline(verdict('attention', 'goal', [r('cost_worse'), r('budget_exceeded'), r('cost_above_goal')]), ctx)).toBe('Atenção: você passou do seu limite de gasto.');
  });
  it('does not blame the cost trend when the cost is within the goal', () => {
    const r = code => ({ code, params: {} });
    expect(headline(verdict('attention', 'goal', [r('cost_worse'), r('ctr_below_min'), r('cost_within_goal')]), ctx)).toBe('Atenção: poucas pessoas estão clicando nos seus anúncios.');
    expect(headline(verdict('attention', 'comparison', [r('cost_worse'), r('ctr_below_min')]), ctx)).toBe('Atenção: seus anúncios pioraram em relação aos 30 dias anteriores.');
  });
  it('explains why there is no verdict', () => {
    const insufficient = reason => headline(verdict('insufficient', 'none', [], reason), ctx);
    expect(insufficient('incomplete_period')).toBe('Ainda não dá para avaliar: faltam dados de alguns dias. Atualize os dados.');
    expect(insufficient('zero_spend')).toBe('Seus anúncios não gastaram neste período.');
    expect(insufficient('low_volume')).toBe('Poucos dados para avaliar ainda. Os números abaixo já aparecem.');
    expect(insufficient('no_baseline')).toBe('Ainda não dá para avaliar: falta o período anterior para comparar. Defina uma meta ou aguarde alguns dias.');
    expect(insufficient('no_data')).not.toBe('');
  });
});

describe('reasonText', () => {
  it('writes the goal and comparison reasons', () => {
    expect(plain(reasonText({ code: 'cost_above_goal', params: { value: 52, goal: 40 } }, ctx))).toBe('Cada resultado custa R$ 52,00, acima da sua meta de R$ 40,00.');
    expect(plain(reasonText({ code: 'cost_within_goal', params: { value: 28, goal: 40 } }, ctx))).toBe('Cada resultado custa R$ 28,00, abaixo da sua meta de R$ 40,00.');
    expect(plain(reasonText({ code: 'cost_better', params: { indicator: 'cpc', change: -15, value: 2 } }, ctx))).toBe('O custo por clique caiu 15%, para R$ 2,00.');
    expect(plain(reasonText({ code: 'cost_worse', params: { indicator: 'cpa', change: 35, value: 52 } }, ctx))).toBe('O custo por resultado subiu 35%, para R$ 52,00.');
    expect(plain(reasonText({ code: 'cost_stable', params: { indicator: 'cpa', change: 2.5, value: 41 } }, ctx))).toBe('O custo por resultado ficou em R$ 41,00 (variação de 2,5%).');
  });
  it('writes the budget, click-through and tracking reasons', () => {
    expect(plain(reasonText({ code: 'budget_exceeded', params: { spend: 15200, limit: 15000 } }, ctx))).toBe('Você já gastou R$ 15.200,00, acima do seu limite de R$ 15.000,00.');
    expect(reasonText({ code: 'budget_near', params: { percent: 85 } }, ctx)).toBe('Você já usou 85% do seu limite de gasto.');
    expect(reasonText({ code: 'ctr_below_min', params: { ctr: 1, min: 2 } }, ctx)).toBe('Só 1% de quem viu seus anúncios clicou; sua meta é 2%.');
    expect(reasonText({ code: 'no_conversion_tracking', params: {} }, ctx)).toBe('Sua conta não registra vendas ou contatos, então avaliei pelo custo por clique.');
    expect(reasonText({ code: 'no_results_yet', params: {} }, ctx)).toBe('Seus anúncios ainda não geraram resultados registrados; avaliei pelo custo por clique.');
  });
});

describe('actionText', () => {
  it('writes the campaign actions', () => {
    expect(plain(actionText({ code: 'campaign_over_goal', params: { campaign: 'Natal', value: 52, goal: 40 } }, ctx))).toBe("A campanha 'Natal' está custando R$ 52,00 por resultado, acima da sua meta de R$ 40,00.");
    expect(actionText({ code: 'campaign_low_ctr', params: { campaign: 'Natal', ctr: 0.5, min: 2 } }, ctx)).toBe("Poucas pessoas clicam na campanha 'Natal' (0,5%; sua meta é 2%).");
    expect(plain(actionText({ code: 'campaign_without_results', params: { campaign: 'Teste B', spend: 800 } }, ctx))).toBe("A campanha 'Teste B' gastou R$ 800,00 e não gerou resultados.");
  });
  it('writes the account actions', () => {
    expect(actionText({ code: 'enable_conversion_tracking', params: {} }, ctx)).toBe('Ative o acompanhamento de conversões na plataforma para ver quanto cada resultado custa.');
    expect(actionText({ code: 'refresh_data', params: { lastSyncedAt: '2026-10-06T12:00:00Z' } }, ctx)).toBe('Seus dados foram atualizados em 06/10. Clique em Atualizar dados para ver o dia de hoje.');
    expect(actionText({ code: 'refresh_data', params: { lastSyncedAt: null } }, ctx)).toBe('Seus dados ainda não foram atualizados. Clique em Atualizar dados.');
    expect(actionText({ code: 'nothing_urgent', params: {} }, ctx)).toBe('Nada urgente por enquanto. Continue acompanhando.');
    expect(plain(actionText({ code: 'budget_exceeded', params: { spend: 15200, limit: 15000 } }, ctx))).toBe('Você já gastou R$ 15.200,00, acima do seu limite de R$ 15.000,00.');
  });
});

describe('robustness', () => {
  const reasons = [['cost_within_goal', { value: 1, goal: 2 }], ['cost_above_goal', { value: 1, goal: 2 }], ['cost_better', { indicator: 'cpa', change: -9, value: 1 }], ['cost_worse', { indicator: 'cpc', change: 9, value: 1 }], ['cost_stable', { indicator: 'cpa', change: 1, value: 1 }], ['budget_exceeded', { spend: 2, limit: 1 }], ['budget_near', { percent: 80 }], ['ctr_below_min', { ctr: 1, min: 2 }], ['no_conversion_tracking', {}], ['no_results_yet', {}]];
  const actions = [['budget_exceeded', { spend: 2, limit: 1 }], ['campaign_over_goal', { campaign: 'A', value: 2, goal: 1 }], ['campaign_low_ctr', { campaign: 'A', ctr: 1, min: 2 }], ['campaign_without_results', { campaign: 'A', spend: 3 }], ['enable_conversion_tracking', {}], ['refresh_data', { lastSyncedAt: null }], ['nothing_urgent', {}]];

  it('has text for every code the back end can send', () => {
    for (const [code, params] of reasons) expect(reasonText({ code, params }, ctx), code).not.toBe('');
    for (const [code, params] of actions) expect(actionText({ code, params }, ctx), code).not.toBe('');
  });
  it('returns an empty string for unknown codes instead of throwing', () => {
    expect(reasonText({ code: 'nope', params: {} }, ctx)).toBe('');
    expect(actionText({ code: 'nope', params: {} }, ctx)).toBe('');
  });
  it('never leaks the unknown-currency suffix or NaN', () => {
    const unknown = { ...ctx, currency: 'UNKNOWN' };
    for (const [code, params] of reasons) { const text = reasonText({ code, params }, unknown); expect(text).not.toMatch(/moeda desconhecida|NaN/); }
    for (const [code, params] of actions) { const text = actionText({ code, params }, unknown); expect(text).not.toMatch(/moeda desconhecida|NaN/); }
  });
  it('exposes the card copy', () => {
    expect(CARD_COPY.spend.title).toBe('Você investiu');
    expect(CARD_COPY.clicks.title).toBe('Pessoas que clicaram');
    expect(CARD_COPY.conversions.title).toBe('Resultados');
    expect(CARD_COPY.conversionsMissing.hint).toBe('Sua conta ainda não mede vendas ou contatos. Ative o acompanhamento de conversões na plataforma para ver este número.');
    expect(CARD_COPY.costCpa.title).toBe('Custo por resultado');
    expect(CARD_COPY.costCpc.title).toBe('Custo por clique');
    expect(CARD_COPY.costCpc.hint).toBe('Quanto você paga, em média, cada vez que alguém clica.');
  });
});

describe('spend without results', () => {
  it('has a reason, an action and an attention headline', () => {
    const params = { spend: 800, goal: 40 };
    expect(plain(reasonText({ code: 'spend_without_results', params }, ctx))).toBe('Você gastou R$ 800,00 e ainda não teve nenhum resultado, mais que o dobro da sua meta de R$ 40,00 por resultado.');
    expect(plain(actionText({ code: 'spend_without_results', params }, ctx))).toBe('Seus anúncios gastaram R$ 800,00 sem nenhum resultado. Confira o acompanhamento de conversões e pause o que não está funcionando.');
    expect(headline(verdict('attention', 'comparison', [{ code: 'spend_without_results', params }]), ctx)).toBe('Atenção: você está gastando sem ter resultados.');
  });
});
