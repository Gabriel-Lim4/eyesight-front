import { formatPercent } from './format';
import { costNoun } from './verdictCopy';

/* Frases do bloco "Por que mudou?". O back envia só números (changeExplanation); aqui eles viram texto. */

const RELEVANT_SHARE = 0.15;
const percentOf = value => formatPercent(Math.abs(value));

const FACTORS = {
  cpm: change => (change > 0
    ? `Seus anúncios ficaram mais caros de mostrar: o custo para aparecer mil vezes subiu ${percentOf(change)}.`
    : `Seus anúncios ficaram mais baratos de mostrar: o custo para aparecer mil vezes caiu ${percentOf(change)}.`),
  ctr: change => (change > 0
    ? `Mais pessoas clicaram: a taxa de cliques subiu ${percentOf(change)}.`
    : `Menos pessoas clicaram: a taxa de cliques caiu ${percentOf(change)}.`),
  cvr: change => (change > 0
    ? `Mais cliques viraram resultado: a taxa de conversão subiu ${percentOf(change)}.`
    : `Menos cliques viraram resultado: a taxa de conversão caiu ${percentOf(change)}.`),
};

export const explanationTitle = explanation => `Por que o custo por ${costNoun(explanation.indicator)} ${explanation.costChange > 0 ? 'subiu' : 'caiu'} ${percentOf(explanation.costChange)}?`;

/* main = causa principal; also = outro fator na mesma direção; offset = fator que compensou parte da variação. */
export function explanationLines(explanation) {
  if (!explanation?.main) return [];
  const text = factor => FACTORS[factor.key]?.(factor.change) ?? '';
  const main = explanation.factors.find(factor => factor.key === explanation.main);
  const lines = [{ kind: 'main', text: text(main) }];
  for (const factor of explanation.factors) {
    if (factor.key === explanation.main || Math.abs(factor.share) < RELEVANT_SHARE) continue;
    lines.push({ kind: factor.share > 0 ? 'also' : 'offset', text: text(factor) });
  }
  return lines.filter(line => line.text);
}
