import { describe, expect, it } from 'vitest';
import { blockingResults, formatTable, isBlocking, summarize } from './report.mjs';

const result = (overrides = {}) => ({ screen: 'app-overview', group: 'app', theme: 'dark', viewport: 'desktop', violations: [], incomplete: [], overflow: false, focusMissing: [], smallTargets: 0, ...overrides });
const violation = (id, impact, nodes = 1) => ({ id, impact, nodes, help: `${id} help` });

describe('isBlocking', () => {
  it('blocks serious and critical violations in app and auth screens only', () => {
    expect(isBlocking(result({ violations: [violation('color-contrast', 'serious')] }))).toBe(true);
    expect(isBlocking(result({ violations: [violation('button-name', 'critical')] }))).toBe(true);
    expect(isBlocking(result({ group: 'auth', violations: [violation('label', 'serious')] }))).toBe(true);
    expect(isBlocking(result({ violations: [violation('region', 'moderate'), violation('x', 'minor')] }))).toBe(false);
    expect(isBlocking(result({ group: 'landing', violations: [violation('button-name', 'critical')] }))).toBe(false);
  });
  it('blocks horizontal overflow and missing focus indicators', () => {
    expect(isBlocking(result({ overflow: true }))).toBe(true);
    expect(isBlocking(result({ focusMissing: ['button.x'] }))).toBe(true);
    expect(isBlocking(result({ group: 'landing', overflow: true, focusMissing: ['a'] }))).toBe(false);
  });
  it('never blocks on small touch targets alone', () => {
    expect(isBlocking(result({ smallTargets: 99 }))).toBe(false);
  });
  it('counts a screen that failed to load as blocking in app and auth, not in landing', () => {
    expect(isBlocking(result({ loadError: 'timeout' }))).toBe(true);
    expect(isBlocking(result({ group: 'auth', loadError: 'timeout' }))).toBe(true);
    expect(isBlocking(result({ group: 'landing', loadError: 'timeout' }))).toBe(false);
  });
});

describe('blockingResults', () => {
  it('keeps only the blocking ones, in order', () => {
    const a = result({ screen: 'a', overflow: true });
    const b = result({ screen: 'b' });
    const c = result({ screen: 'c', violations: [violation('color-contrast', 'critical')] });
    expect(blockingResults([a, b, c]).map(item => item.screen)).toEqual(['a', 'c']);
  });
});

describe('summarize', () => {
  const results = [
    result({ screen: 'a', violations: [violation('color-contrast', 'serious', 3), violation('region', 'moderate', 1)] }),
    result({ screen: 'a', theme: 'light', violations: [violation('color-contrast', 'serious', 2)] }),
    result({ screen: 'b', group: 'auth', violations: [violation('button-name', 'critical', 1)] }),
    result({ screen: 'home', group: 'landing', violations: [violation('image-alt', 'critical', 4)] }),
  ];
  it('counts totals, blocking results and per-group figures', () => {
    const summary = summarize(results);
    expect(summary.total).toBe(4);
    expect(summary.blocking).toBe(3);
    expect(summary.byGroup.app).toEqual({ screens: 1, violations: 3 });
    expect(summary.byGroup.auth).toEqual({ screens: 1, violations: 1 });
    expect(summary.byGroup.landing).toEqual({ screens: 1, violations: 1 });
  });
  it('aggregates rules by id and sorts by severity then by affected nodes', () => {
    const { rules } = summarize(results);
    expect(rules.map(rule => rule.id)).toEqual(['image-alt', 'button-name', 'color-contrast', 'region']);
    expect(rules.find(rule => rule.id === 'color-contrast')).toEqual({ id: 'color-contrast', impact: 'serious', nodes: 5, screens: 1 });
  });
});

describe('formatTable', () => {
  it('lists each result, the incomplete rules and the screens that did not load', () => {
    const text = formatTable([
      result({ screen: 'app-overview', violations: [violation('color-contrast', 'serious', 2)], incomplete: [{ id: 'color-contrast' }] }),
      result({ screen: 'app-meta', loadError: 'timeout 15000ms' }),
    ]);
    expect(text).toContain('app-overview');
    expect(text).toContain('color-contrast');
    expect(text).toContain('serious');
    expect(text).toMatch(/incomplet/i);
    expect(text).toContain('app-meta');
    expect(text).toContain('timeout 15000ms');
  });
  it('says so explicitly when nothing blocks', () => {
    expect(formatTable([result()])).toContain('nenhum problema bloqueante');
  });
  it('does not claim a clean result when something blocks', () => {
    expect(formatTable([result({ overflow: true })])).not.toContain('nenhum problema bloqueante');
  });
});
