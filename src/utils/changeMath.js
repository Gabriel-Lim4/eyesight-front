/* Cópia mínima de eyesight-backend/src/services/changeExplainer.js, usada só pela demonstração
   (a demo não importa código do servidor). Ao mudar o método lá, mude aqui. */

const MIN_CLICKS = 30;
const MIN_COST_CHANGE_PCT = 5;
const SIGN = { cpm: 1, ctr: -1, cvr: -1 };
const positive = value => Number.isFinite(value) && value > 0;

const factorsOf = ({ impressions, clicks, spend, conversions }, indicator) => ({
  cpm: spend / impressions * 1000, ctr: clicks / impressions, ...(indicator === 'cpa' ? { cvr: conversions / clicks } : {}),
});
const costOf = (metrics, indicator) => (indicator === 'cpa' ? metrics.spend / metrics.conversions : metrics.spend / metrics.clicks);

export function explainCostChange(current, previous, indicator) {
  if (!current || !previous || !['cpc', 'cpa'].includes(indicator)) return null;
  const needed = indicator === 'cpa' ? ['impressions', 'clicks', 'spend', 'conversions'] : ['impressions', 'clicks', 'spend'];
  for (const metrics of [current, previous]) {
    if (needed.some(key => !positive(Number(metrics[key])) ) || metrics.clicks < MIN_CLICKS) return null;
  }
  const now = factorsOf(current, indicator);
  const before = factorsOf(previous, indicator);
  const logChange = Math.log(costOf(current, indicator) / costOf(previous, indicator));
  const costChange = (Math.exp(logChange) - 1) * 100;
  if (!Number.isFinite(logChange) || Math.abs(costChange) < MIN_COST_CHANGE_PCT) return null;
  const factors = Object.keys(now).map(key => ({
    key, change: (now[key] / before[key] - 1) * 100, share: SIGN[key] * Math.log(now[key] / before[key]) / logChange,
  })).sort((a, b) => b.share - a.share);
  return { indicator, costChange, factors, main: factors[0].share > 0 ? factors[0].key : null };
}
