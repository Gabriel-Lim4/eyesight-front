import { describe, expect, it } from 'vitest';
import { explanationLines, explanationTitle } from '../changeCopy';

const ctx = { currency: 'BRL', period: { period: 'last_30d', days: 30 } };
const explanation = (extra = {}) => ({
  indicator: 'cpa', costChange: 25,
  factors: [{ key: 'cvr', change: -20, share: 0.7 }, { key: 'cpm', change: 8, share: 0.25 }, { key: 'ctr', change: 1, share: 0.05 }],
  main: 'cvr', ...extra,
});

describe('changeCopy', () => {
  it('titles the explanation with the cost noun, the direction and the size', () => {
    expect(explanationTitle(explanation(), ctx)).toBe('Por que o custo por resultado subiu 25%?');
    expect(explanationTitle(explanation({ indicator: 'cpc', costChange: -12.4 }), ctx)).toBe('Por que o custo por clique caiu 12,4%?');
  });

  it('puts the main factor first, then the other relevant ones, and drops the tiny ones', () => {
    const lines = explanationLines(explanation());
    expect(lines[0]).toEqual({ kind: 'main', text: 'Menos cliques viraram resultado: a taxa de conversão caiu 20%.' });
    expect(lines[1]).toEqual({ kind: 'also', text: 'Seus anúncios ficaram mais caros de mostrar: o custo para aparecer mil vezes subiu 8%.' });
    expect(lines).toHaveLength(2);
  });

  it('marks a factor that worked against the change as an offset', () => {
    const lines = explanationLines(explanation({ factors: [{ key: 'cpm', change: 100, share: 1.4 }, { key: 'ctr', change: 25, share: -0.4 }], main: 'cpm', indicator: 'cpc', costChange: 60 }));
    expect(lines.map(line => line.kind)).toEqual(['main', 'offset']);
    expect(lines[1].text).toBe('Mais pessoas clicaram: a taxa de cliques subiu 25%.');
  });

  it('returns nothing without a main factor', () => {
    expect(explanationLines(explanation({ main: null }))).toEqual([]);
    expect(explanationLines(null)).toEqual([]);
  });
});
