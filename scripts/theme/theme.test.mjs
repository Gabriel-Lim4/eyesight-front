import { describe, expect, it } from 'vitest';
import { diffSnapshots } from './compare.mjs';
import { buildPairs } from './pairs.mjs';
import { parseRules } from './css-rules.mjs';
import { countStats } from './stats.mjs';

const style = (overrides = {}) => ({ color: 'rgb(255, 255, 255)', backgroundColor: 'rgb(11, 17, 32)', ...overrides });

describe('diffSnapshots', () => {
  it('finds nothing when both snapshots are equal', () => {
    const snap = { 'a|dark|desktop|-': { 'body:nth-child(1)': style() } };
    expect(diffSnapshots(snap, structuredClone(snap)).total).toBe(0);
  });
  it('reports the element, the property and both values', () => {
    const before = { 'a|dark|desktop|-': { 'body>div:nth-child(1)': style() } };
    const after = { 'a|dark|desktop|-': { 'body>div:nth-child(1)': style({ color: 'rgb(0, 0, 0)' }) } };
    const diff = diffSnapshots(before, after);
    expect(diff.total).toBe(1);
    expect(diff.byKey['a|dark|desktop|-'].samples).toEqual([{ path: 'body>div:nth-child(1)', prop: 'color', before: 'rgb(255, 255, 255)', after: 'rgb(0, 0, 0)' }]);
  });
  it('counts elements present on one side only', () => {
    const before = { k: { x: style(), y: style() } };
    const after = { k: { x: style(), z: style() } };
    const entry = diffSnapshots(before, after).byKey.k;
    expect(entry.onlyBefore).toBe(1);
    expect(entry.onlyAfter).toBe(1);
    expect(diffSnapshots(before, after).total).toBe(2);
  });
  it('keeps at most ten samples but counts every change', () => {
    const many = value => Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`e${i}`, style({ color: value })]));
    const entry = diffSnapshots({ k: many('a') }, { k: many('b') }).byKey.k;
    expect(entry.changed).toBe(25);
    expect(entry.samples).toHaveLength(10);
  });
  it('keeps keys apart and treats a missing key as all elements missing', () => {
    const diff = diffSnapshots({ one: { x: style() } }, { two: { x: style() } });
    expect(diff.byKey.one.onlyBefore).toBe(1);
    expect(diff.byKey.two.onlyAfter).toBe(1);
  });
});

describe('buildPairs', () => {
  const both = (dark, light) => ({ 'tela|dark|desktop|-': dark, 'tela|light|desktop|-': light });
  const transparent = 'rgba(0, 0, 0, 0)';
  it('pairs the same element across themes and counts them by class of property', () => {
    const el = (c, b) => ({ color: c, backgroundColor: b, backgroundImage: 'none', borderTopColor: transparent, borderRightColor: transparent, borderBottomColor: transparent, borderLeftColor: transparent, boxShadow: 'none', fill: 'none', stroke: 'none' });
    const snap = both({ a: el('#fff', transparent), b: el('#fff', transparent), c: el('#fff', transparent) }, { a: el('#111', transparent), b: el('#111', transparent), c: el('#111', transparent) });
    const text = buildPairs(snap).text.find(pair => pair.dark === '#fff' && pair.light === '#111');
    expect(text.count).toBe(3);
    expect(text.examples.length).toBeGreaterThan(0);
  });
  it('ignores pairs that are transparent on both sides and elements present in one theme only', () => {
    const el = bg => ({ color: 'x', backgroundColor: bg, backgroundImage: 'none', borderTopColor: transparent, borderRightColor: transparent, borderBottomColor: transparent, borderLeftColor: transparent, boxShadow: 'none', fill: 'none', stroke: 'none' });
    const pairs = buildPairs(both({ a: el(transparent), only: el('#000') }, { a: el(transparent) }));
    expect(pairs.background).toEqual([]);
  });
  it('groups borders, shadows and svg paint apart and sorts by count', () => {
    const el = o => ({ color: 'x', backgroundColor: transparent, backgroundImage: 'none', borderTopColor: transparent, borderRightColor: transparent, borderBottomColor: transparent, borderLeftColor: transparent, boxShadow: 'none', fill: 'none', stroke: 'none', ...o });
    const dark = { a: el({ borderTopColor: '#1e293b', fill: '#3b82f6' }), b: el({ borderTopColor: '#1e293b', boxShadow: 'rgb(0,0,0) 0 1px' }), c: el({ borderTopColor: '#334155' }) };
    const light = { a: el({ borderTopColor: '#e2e8f0', fill: '#2563eb' }), b: el({ borderTopColor: '#e2e8f0', boxShadow: 'rgb(1,1,1) 0 1px' }), c: el({ borderTopColor: '#cbd5e1' }) };
    const pairs = buildPairs(both(dark, light));
    expect(pairs.border[0]).toMatchObject({ dark: '#1e293b', light: '#e2e8f0', count: 2 });
    expect(pairs.border[1].count).toBe(1);
    expect(pairs.shadow).toHaveLength(1);
    expect(pairs.svg[0]).toMatchObject({ dark: '#3b82f6', light: '#2563eb' });
  });
});

describe('countStats', () => {
  const files = [
    { path: 'src/styles/Theme.css', text: 'body.light-mode .a { color: #fff !important; }\nbody.light-mode,\nbody.light-mode .b { color: #111; }\n.c { color: red !important; }\n' },
    { path: 'src/styles/Other.css', text: ':root { --x: #3b82f6; }\n.d { color: #3b82f6; background: #3b82f6; }\n.e { color: #FFF; }\n.f { color: red !important; }\n' },
  ];
  it('counts lines with body.light-mode, handwritten colors by value, theme !important and lines', () => {
    const stats = countStats(files);
    expect(stats.lightModeLines).toBe(3);
    expect(stats.handwrittenColors['#3b82f6']).toBe(2);
    expect(stats.handwrittenColors['#fff']).toBe(2);
    expect(stats.importantInTheme).toBe(2);
    expect(stats.lines).toBe(8);
  });
});

describe('parseRules', () => {
  it('ignores comments, keeps declarations and splits selector lists', () => {
    const rules = parseRules('/* x { color: red } */\n.a, .b { color: #fff; background: var(--bg); }');
    expect(rules).toEqual([
      { selector: '.a', declarations: [{ prop: 'color', value: '#fff' }, { prop: 'background', value: 'var(--bg)' }] },
      { selector: '.b', declarations: [{ prop: 'color', value: '#fff' }, { prop: 'background', value: 'var(--bg)' }] },
    ]);
  });
  it('flattens rules inside media queries', () => {
    const rules = parseRules('@media (max-width: 600px) { .a { color: red; } }\n.b { color: blue; }');
    expect(rules.map(rule => rule.selector)).toEqual(['.a', '.b']);
  });
});
