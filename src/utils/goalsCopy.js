/* Textos das metas, compartilhados pela Visão geral (GoalsForm) e pela análise completa (AnalyticsWorkspace).
   Um nome só para o usuário: "Metas". No backend os campos continuam ctrMin, cpaMax e budgetMax. */
export const GOAL_FIELDS = [
  ['cpaMax', 'Quero pagar, no máximo, por cada resultado', 'money'],
  ['budgetMax', 'Quero gastar, no máximo, no período', 'money'],
  ['ctrMin', 'Quero que pelo menos esta % de quem vê meu anúncio clique', 'percent'],
];

export const GOALS_COPY = {
  title: 'Suas metas',
  save: 'Salvar metas',
  saved: 'Metas salvas.',
  error: 'Não foi possível salvar as metas.',
  numbers: 'Informe apenas números nas metas.',
  help: "Com uma meta, as campanhas que passam dela aparecem em 'Campanhas que precisam de atenção'. Valores em dinheiro seguem a moeda selecionada. Deixe em branco para não usar.",
};
