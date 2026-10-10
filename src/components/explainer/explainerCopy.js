const GENERIC = ['O que isso quer dizer?'];
const CARD_QUESTIONS = {
  spend: ['Estou gastando demais?', 'Como o gasto se compara ao período anterior?'],
  clicks: ['Esse número de cliques é bom?', 'Como conseguir mais cliques?'],
  conversions: ['O que conta como resultado?', 'Por que tenho poucos resultados?'],
  cost: ['Esse custo é bom ou ruim?', 'Como baixar esse custo?', 'Como defino uma boa meta?'],
};
const CARD_TITLES = { spend: 'Gasto', clicks: 'Cliques', conversions: 'Resultados', cost: 'Custo' };

export function suggestionsFor(focus) {
  if (focus?.kind === 'verdict') return ['Por que meus anúncios estão assim?', 'O que devo fazer primeiro?', 'Como esse resultado foi calculado?'];
  if (focus?.kind === 'card') return CARD_QUESTIONS[focus.key] || GENERIC;
  if (focus?.kind === 'reason') return ['O que isso quer dizer?', 'Isso é grave?'];
  if (focus?.kind === 'action') return ['Como faço isso passo a passo?', 'Por que essa é a prioridade?'];
  return GENERIC;
}

export function focusTitle(focus) {
  if (focus?.kind === 'verdict') return 'Como estão seus anúncios';
  if (focus?.kind === 'card') return CARD_TITLES[focus.key] || 'Indicador';
  if (focus?.kind === 'reason') return 'Motivo da avaliação';
  if (focus?.kind === 'action') return 'Ação sugerida';
  return 'Assistente';
}

export const STATE_COPY = {
  sending: 'Pensando…',
  unavailable: 'Assistente indisponível no momento.',
  retry: 'Tentar de novo',
  fallbackError: 'Não foi possível completar a solicitação. Tente novamente.',
};
