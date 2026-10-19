import { describe, expect, it } from 'vitest';
import { KPI_KEYS, fromVisible, movePrefs, normalizePrefs, shiftPrefs, togglePrefs, visibleKeys } from '../kpiCatalog';

describe('kpiCatalog', () => {
  it('monta o estado a partir da lista de visíveis, mantendo todos os indicadores no catálogo', () => {
    const prefs = fromVisible(['roas', 'ctr']);
    expect(prefs.order.slice(0, 2)).toEqual(['roas', 'ctr']);
    expect([...prefs.order].sort()).toEqual([...KPI_KEYS].sort());
    expect(visibleKeys(prefs)).toEqual(['roas', 'ctr']);
  });

  it('ignora chaves desconhecidas e repetidas', () => {
    expect(visibleKeys(fromVisible(['roas', 'nada', 'roas', 'cpc']))).toEqual(['roas', 'cpc']);
  });

  it('usa o padrão quando o que estava salvo está corrompido', () => {
    expect(visibleKeys(normalizePrefs({ order: 'x' }, ['ctr']))).toEqual(['ctr']);
    expect(visibleKeys(normalizePrefs(null, ['ctr']))).toEqual(['ctr']);
  });

  it('indicador novo no catálogo entra oculto, sem mudar o painel de quem já personalizou', () => {
    const saved = { order: ['roas', 'ctr'], hidden: [] };
    const prefs = normalizePrefs(saved, ['spend']);
    expect(visibleKeys(prefs)).toEqual(['roas', 'ctr']);
    expect(prefs.order).toHaveLength(KPI_KEYS.length);
  });

  it('move, troca de lugar e alterna a visibilidade sem mutar o original', () => {
    const base = fromVisible(['roas', 'ctr', 'cpc']);
    expect(movePrefs(base, 'cpc', 'roas').order.slice(0, 3)).toEqual(['cpc', 'roas', 'ctr']);
    expect(shiftPrefs(base, 'roas', 1).order.slice(0, 2)).toEqual(['ctr', 'roas']);
    expect(shiftPrefs(base, 'roas', -1)).toBe(base);
    expect(visibleKeys(togglePrefs(base, 'ctr'))).toEqual(['roas', 'cpc']);
    expect(visibleKeys(togglePrefs(togglePrefs(base, 'ctr'), 'ctr'))).toEqual(['roas', 'ctr', 'cpc']);
    expect(base.order.slice(0, 3)).toEqual(['roas', 'ctr', 'cpc']);
  });
});
