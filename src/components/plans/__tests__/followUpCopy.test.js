import { describe, expect, it } from 'vitest';
import { followUpView } from '../followUpCopy';

const ready = extra => ({ status: 'ready', metric: 'cpa', since: '2026-10-03', daysBefore: 7, daysAfter: 6, before: 50, after: 40, changePct: -20, result: 'better', ...extra });

describe('followUpView', () => {
  it('says how many days are missing while waiting', () => {
    expect(followUpView({ status: 'waiting', since: '2026-10-09', daysAfter: 1, daysNeeded: 3 }, 'BRL'))
      .toEqual({ tone: 'waiting', text: 'Acompanhando: faltam 2 dias de dados depois dos seus passos para mostrar se melhorou.' });
    expect(followUpView({ status: 'waiting', since: '2026-10-09', daysAfter: 2, daysNeeded: 3 }, 'BRL').text).toContain('falta 1 dia ');
  });

  it('explains a better cost per result with both values and the date', () => {
    const view = followUpView(ready(), 'BRL');
    expect(view.tone).toBe('better');
    expect(view.text).toMatch(/O custo por resultado foi de R\$\s50,00 para R\$\s40,00 desde 03\/10 \(20% a menos\)\. Melhorou\./);
    expect(view.note).toBe('Outros fatores também podem ter influenciado o resultado.');
  });

  it('describes worse and unchanged results', () => {
    expect(followUpView(ready({ after: 60, changePct: 20, result: 'worse' }), 'BRL').text).toMatch(/\(20% a mais\)\. Piorou\./);
    expect(followUpView(ready({ after: 50.5, changePct: 1, result: 'same' }), 'BRL').text).toMatch(/Ficou praticamente igual\./);
  });

  it('formats rates and per day metrics', () => {
    expect(followUpView(ready({ metric: 'ctr', before: 1.2, after: 1.8, changePct: 50 }), 'BRL').text).toMatch(/A taxa de cliques foi de 1,2% para 1,8%/);
    expect(followUpView(ready({ metric: 'resultsPerDay', before: 0, after: 2, changePct: null }), 'BRL').text).toMatch(/Os resultados por dia foram de 0 para 2 desde 03\/10\. Melhorou\./);
    expect(followUpView(ready({ metric: 'spendPerDay', before: 200, after: 100, changePct: -50 }), 'BRL').text).toMatch(/O gasto por dia foi de R\$\s200,00 para R\$\s100,00/);
  });

  it('handles unavailable and missing data', () => {
    expect(followUpView({ status: 'unavailable', since: '2026-10-03' }, 'BRL').text).toBe('Ainda não há dados de antes dos seus passos para comparar.');
    expect(followUpView(null, 'BRL')).toBeNull();
    expect(followUpView({ status: 'whatever' }, 'BRL')).toBeNull();
  });
});
