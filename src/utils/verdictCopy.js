import { formatMoney, formatPercent } from './format';

/* Frases do veredito em pt-BR. O back envia só códigos e parâmetros; aqui eles viram texto.
   ATENÇÃO: o e-mail do resumo semanal duplica parte destas frases em eyesight-backend/src/services/summaryCopy.js;
   ao mudar um texto aqui, mude lá também. */

const PRESETS = ['last_7d', 'last_30d', 'last_90d'];
const isPreset = period => PRESETS.includes(period?.period);

export const previousLabel = period => (isPreset(period) ? `os ${period.days} dias anteriores` : 'o período anterior');
export const previousLabelTo = period => (isPreset(period) ? `aos ${period.days} dias anteriores` : 'ao período anterior');
export const costNoun = indicator => (indicator === 'cpc' ? 'clique' : 'resultado');

const money = (value, ctx) => formatMoney(value, ctx.currency);
const shortDate = value => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const verb = { cost_better: 'caiu', cost_worse: 'subiu' };

const REASONS = {
  cost_within_goal: (p, c) => `Cada resultado custa ${money(p.value, c)}, abaixo da sua meta de ${money(p.goal, c)}.`,
  cost_above_goal: (p, c) => `Cada resultado custa ${money(p.value, c)}, acima da sua meta de ${money(p.goal, c)}.`,
  cost_better: (p, c) => `O custo por ${costNoun(p.indicator)} ${verb.cost_better} ${formatPercent(Math.abs(p.change))}, para ${money(p.value, c)}.`,
  cost_worse: (p, c) => `O custo por ${costNoun(p.indicator)} ${verb.cost_worse} ${formatPercent(Math.abs(p.change))}, para ${money(p.value, c)}.`,
  cost_stable: (p, c) => `O custo por ${costNoun(p.indicator)} ficou em ${money(p.value, c)} (variação de ${formatPercent(Math.abs(p.change))}).`,
  budget_exceeded: (p, c) => `Você já gastou ${money(p.spend, c)}, acima do seu limite de ${money(p.limit, c)}.`,
  budget_near: p => `Você já usou ${p.percent}% do seu limite de gasto.`,
  ctr_below_min: p => `Só ${formatPercent(p.ctr)} de quem viu seus anúncios clicou; sua meta é ${formatPercent(p.min)}.`,
  no_conversion_tracking: () => 'Sua conta não registra vendas ou contatos, então avaliei pelo custo por clique.',
  no_results_yet: () => 'Seus anúncios ainda não geraram resultados registrados; avaliei pelo custo por clique.',
};

const ACTIONS = {
  budget_exceeded: REASONS.budget_exceeded,
  campaign_over_goal: (p, c) => `A campanha '${p.campaign}' está custando ${money(p.value, c)} por resultado, acima da sua meta de ${money(p.goal, c)}.`,
  campaign_low_ctr: p => `Poucas pessoas clicam na campanha '${p.campaign}' (${formatPercent(p.ctr)}; sua meta é ${formatPercent(p.min)}).`,
  campaign_without_results: (p, c) => `A campanha '${p.campaign}' gastou ${money(p.spend, c)} e não gerou resultados.`,
  enable_conversion_tracking: () => 'Ative o acompanhamento de conversões na plataforma para ver quanto cada resultado custa.',
  refresh_data: p => (p.lastSyncedAt
    ? `Seus dados foram atualizados em ${shortDate(p.lastSyncedAt)}. Clique em Atualizar dados para ver o dia de hoje.`
    : 'Seus dados ainda não foram atualizados. Clique em Atualizar dados.'),
  nothing_urgent: () => 'Nada urgente por enquanto. Continue acompanhando.',
};

const render = (table, item, ctx) => (table[item?.code] ? table[item.code](item.params || {}, ctx) : '');
export const reasonText = (reason, ctx) => render(REASONS, reason, ctx);
export const actionText = (action, ctx) => render(ACTIONS, action, ctx);

const INSUFFICIENT = {
  no_data: 'Ainda não há dados para avaliar.',
  incomplete_period: 'Ainda não dá para avaliar: faltam dados de alguns dias. Atualize os dados.',
  zero_spend: 'Seus anúncios não gastaram neste período.',
  low_volume: 'Poucos dados para avaliar ainda. Os números abaixo já aparecem.',
  no_baseline: 'Ainda não dá para avaliar: falta o período anterior para comparar. Defina uma meta ou aguarde alguns dias.',
};

const ATTENTION = [
  ['budget_exceeded', () => 'Atenção: você passou do seu limite de gasto.'],
  ['cost_above_goal', () => 'Atenção: o custo por resultado está acima da sua meta.'],
  ['cost_worse', ctx => `Atenção: seus anúncios pioraram em relação ${previousLabelTo(ctx.period)}.`],
  ['ctr_below_min', () => 'Atenção: poucas pessoas estão clicando nos seus anúncios.'],
];

export function headline(verdict, ctx) {
  if (verdict.status === 'good') {
    return verdict.basis === 'goal' ? 'Seus anúncios estão dentro da sua meta.' : `Seus anúncios estão melhores que ${previousLabel(ctx.period)}.`;
  }
  if (verdict.status === 'stable') return `Seus anúncios estão estáveis em relação ${previousLabelTo(ctx.period)}.`;
  if (verdict.status === 'attention') {
    const codes = (verdict.reasons || []).map(reason => reason.code);
    const candidates = verdict.basis === 'goal' ? ATTENTION.filter(([code]) => code !== 'cost_worse') : ATTENTION;
    const found = candidates.find(([code]) => codes.includes(code));
    return found ? found[1](ctx) : 'Atenção: vale revisar seus anúncios.';
  }
  return INSUFFICIENT[verdict.insufficientReason] || INSUFFICIENT.no_data;
}

export const CARD_COPY = {
  spend: { title: 'Você investiu', hint: 'Total gasto nos seus anúncios neste período.' },
  clicks: { title: 'Pessoas que clicaram', hint: 'Quantas vezes alguém clicou nos seus anúncios.' },
  conversions: { title: 'Resultados', hint: 'Vendas ou contatos que seus anúncios geraram.' },
  conversionsMissing: { title: 'Resultados', value: 'Não registrado', hint: 'Sua conta ainda não mede vendas ou contatos. Ative o acompanhamento de conversões na plataforma para ver este número.' },
  costCpa: { title: 'Custo por resultado', hint: 'Quanto você pagou, em média, por cada resultado.' },
  costCpc: { title: 'Custo por clique', hint: 'Quanto você paga, em média, cada vez que alguém clica.' },
};
