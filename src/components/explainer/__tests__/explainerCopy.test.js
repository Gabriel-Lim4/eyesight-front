import { describe, expect, it } from 'vitest';
import { focusTitle, suggestionsFor } from '../explainerCopy';

describe('explainerCopy', () => {
  it('suggests specific questions per focus', () => {
    expect(suggestionsFor({ kind: 'verdict' })).toEqual(['Por que meus anúncios estão assim?', 'O que devo fazer primeiro?', 'Como esse resultado foi calculado?']);
    expect(suggestionsFor({ kind: 'card', key: 'spend' })).toEqual(['Estou gastando demais?', 'Como o gasto se compara ao período anterior?']);
    expect(suggestionsFor({ kind: 'card', key: 'clicks' })).toEqual(['Esse número de cliques é bom?', 'Como conseguir mais cliques?']);
    expect(suggestionsFor({ kind: 'card', key: 'conversions' })).toEqual(['O que conta como resultado?', 'Por que tenho poucos resultados?']);
    expect(suggestionsFor({ kind: 'card', key: 'cost' })).toEqual(['Esse custo é bom ou ruim?', 'Como baixar esse custo?', 'Como defino uma boa meta?']);
    expect(suggestionsFor({ kind: 'reason', code: 'cost_worse' })).toEqual(['O que isso quer dizer?', 'Isso é grave?']);
    expect(suggestionsFor({ kind: 'action', code: 'refresh_data' })).toEqual(['Como faço isso passo a passo?', 'Por que essa é a prioridade?']);
  });
  it('falls back to one generic question', () => {
    expect(suggestionsFor({ kind: 'mystery' })).toEqual(['O que isso quer dizer?']);
    expect(suggestionsFor(null)).toEqual(['O que isso quer dizer?']);
  });
  it('titles each focus', () => {
    expect(focusTitle({ kind: 'verdict' })).toBe('Como estão seus anúncios');
    expect([['spend', 'Gasto'], ['clicks', 'Cliques'], ['conversions', 'Resultados'], ['cost', 'Custo']].map(([key]) => focusTitle({ kind: 'card', key })))
      .toEqual(['Gasto', 'Cliques', 'Resultados', 'Custo']);
    expect(focusTitle({ kind: 'reason', code: 'x' })).toBe('Motivo da avaliação');
    expect(focusTitle({ kind: 'action', code: 'x' })).toBe('Ação sugerida');
  });
});
