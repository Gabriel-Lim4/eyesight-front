/* Catálogo dos indicadores que o cliente pode escolher para o painel.
   `better` diz para onde a seta aponta quando o resultado melhora ('neutral' = sem juízo de valor). */
export const KPI_CATALOG = [
  { key: 'roas', name: 'ROAS', caption: 'Retorno sobre o investimento', type: 'ratio', better: 'up', icon: 'TrendingUp', hue: 'violet' },
  { key: 'ctr', name: 'CTR', caption: 'Taxa de cliques', type: 'percent', better: 'up', icon: 'Percent', hue: 'cyan' },
  { key: 'cpa', name: 'CPA', caption: 'Custo por conversão', type: 'money', better: 'down', icon: 'Receipt', hue: 'amber' },
  { key: 'cpc', name: 'CPC', caption: 'Custo por clique', type: 'money', better: 'down', icon: 'Coins', hue: 'amber' },
  { key: 'cpm', name: 'CPM', caption: 'Custo por mil impressões', type: 'money', better: 'down', icon: 'ChartColumn', hue: 'amber' },
  { key: 'spend', name: 'Investimento', caption: 'Total gasto no período', type: 'money', better: 'neutral', icon: 'Wallet', hue: 'blue' },
  { key: 'revenue', name: 'Valor de conversões', caption: 'Valor atribuído às conversões', type: 'money', better: 'up', icon: 'BadgeDollarSign', hue: 'green' },
  { key: 'conversions', name: 'Conversões', caption: 'Resultados gerados', type: 'decimal', better: 'up', icon: 'Target', hue: 'green' },
  { key: 'clicks', name: 'Cliques', caption: 'Pessoas que clicaram', type: 'number', better: 'up', icon: 'MousePointerClick', hue: 'cyan' },
  { key: 'impressions', name: 'Impressões', caption: 'Vezes que o anúncio apareceu', type: 'number', better: 'up', icon: 'Eye', hue: 'blue' },
];

export const KPI_KEYS = KPI_CATALOG.map(item => item.key);
export const KPI_BY_KEY = Object.fromEntries(KPI_CATALOG.map(item => [item.key, item]));

/* Quais aparecem de primeira. No painel inicial os quatro cards do resumo já cobrem investimento, cliques, resultados e custo. */
export const DEFAULT_KPIS_OVERVIEW = ['roas', 'ctr', 'cpc', 'cpm', 'impressions', 'revenue'];
export const DEFAULT_KPIS_FULL = ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'conversions', 'roas'];

/* Estado = ordem de todos os indicadores + quais estão ocultos. */
export function fromVisible(visible = []) {
  const shown = [...new Set(visible.filter(key => KPI_BY_KEY[key]))];
  const order = [...shown, ...KPI_KEYS.filter(key => !shown.includes(key))];
  return { order, hidden: order.filter(key => !shown.includes(key)) };
}

/* Aceita o que veio do armazenamento (pode estar velho, corrompido ou de uma versão anterior do catálogo). */
export function normalizePrefs(raw, defaultVisible) {
  if (!raw || !Array.isArray(raw.order) || !Array.isArray(raw.hidden)) return fromVisible(defaultVisible);
  const known = raw.order.filter((key, index) => KPI_BY_KEY[key] && raw.order.indexOf(key) === index);
  const added = KPI_KEYS.filter(key => !known.includes(key));
  const order = [...known, ...added];
  // indicador novo no catálogo entra oculto: ninguém vê o painel mudar sozinho
  const hidden = [...raw.hidden.filter(key => known.includes(key)), ...added];
  return { order, hidden };
}

export const visibleKeys = prefs => prefs.order.filter(key => !prefs.hidden.includes(key));

export function movePrefs(prefs, from, to) {
  if (from === to || !prefs.order.includes(from) || !prefs.order.includes(to)) return prefs;
  const order = prefs.order.filter(key => key !== from);
  order.splice(prefs.order.indexOf(to), 0, from);
  return { ...prefs, order };
}

export function shiftPrefs(prefs, key, step) {
  const index = prefs.order.indexOf(key), target = index + step;
  if (index < 0 || target < 0 || target >= prefs.order.length) return prefs;
  const order = [...prefs.order];
  [order[index], order[target]] = [order[target], order[index]];
  return { ...prefs, order };
}

export function togglePrefs(prefs, key) {
  return { ...prefs, hidden: prefs.hidden.includes(key) ? prefs.hidden.filter(item => item !== key) : [...prefs.hidden, key] };
}
