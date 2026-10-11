import { formatMoney, formatPercent } from '../../utils/format';

/* Textos do acompanhamento do plano ("melhorou depois que eu agi?"). O back envia só números (followUp). */

const shortDate = day => { const [, month, date] = day.split('-'); return `${date}/${month}`; };
const perDay = value => Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const METRICS = {
  cpa: { subject: 'O custo por resultado foi', format: (value, currency) => formatMoney(value, currency) },
  ctr: { subject: 'A taxa de cliques foi', format: value => formatPercent(value) },
  resultsPerDay: { subject: 'Os resultados por dia foram', format: value => perDay(value) },
  spendPerDay: { subject: 'O gasto por dia foi', format: (value, currency) => formatMoney(value, currency) },
};
const VERDICT = { better: 'Melhorou.', worse: 'Piorou.', same: 'Ficou praticamente igual.' };
export const FOLLOW_UP_NOTE = 'Outros fatores também podem ter influenciado o resultado.';

export function followUpView(followUp, currency) {
  if (followUp?.status === 'waiting') {
    const missing = Math.max(1, followUp.daysNeeded - followUp.daysAfter);
    return { tone: 'waiting', text: `Acompanhando: ${missing === 1 ? 'falta 1 dia' : `faltam ${missing} dias`} de dados depois dos seus passos para mostrar se melhorou.` };
  }
  if (followUp?.status === 'unavailable') return { tone: 'waiting', text: 'Ainda não há dados de antes dos seus passos para comparar.' };
  const metric = METRICS[followUp?.metric];
  if (followUp?.status !== 'ready' || !metric || !VERDICT[followUp.result]) return null;
  const size = followUp.changePct != null && followUp.result !== 'same'
    ? ` (${formatPercent(Math.abs(followUp.changePct), 0)} ${followUp.changePct < 0 ? 'a menos' : 'a mais'})`
    : '';
  return {
    tone: followUp.result,
    text: `${metric.subject} de ${metric.format(followUp.before, currency)} para ${metric.format(followUp.after, currency)} desde ${shortDate(followUp.since)}${size}. ${VERDICT[followUp.result]}`,
    note: FOLLOW_UP_NOTE,
  };
}
