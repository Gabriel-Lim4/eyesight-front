const finite = value => value != null && Number.isFinite(Number(value));

/* Formatação usada nas tabelas e KPIs da análise completa (inclui o aviso de moeda desconhecida). */
export function format(value, type = 'number', currency = 'BRL') {
  if (!finite(value)) return '—';
  const number = Number(value);
  if (type === 'money' && currency !== 'UNKNOWN') return number.toLocaleString('pt-BR', { style: 'currency', currency });
  const text = number.toLocaleString('pt-BR', { maximumFractionDigits: type === 'number' ? 0 : 2, minimumFractionDigits: ['number', 'decimal'].includes(type) ? 0 : 2 });
  return `${text}${type === 'percent' ? '%' : type === 'ratio' ? 'x' : type === 'money' ? ' (moeda desconhecida)' : ''}`;
}

/* Dinheiro para a visão simples: moeda desconhecida vira número puro (o aviso aparece uma vez na tela). */
export function formatMoney(value, currency) {
  if (!finite(value)) return '—';
  const number = Number(value);
  if (currency === 'UNKNOWN') return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return number.toLocaleString('pt-BR', { style: 'currency', currency: currency || 'BRL' });
}

export function formatPercent(value, digits = 1) {
  if (!finite(value)) return '—';
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`;
}
