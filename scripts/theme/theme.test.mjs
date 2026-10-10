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

describe('tokens', () => {
  it('normalizes computed colors to hex or a stable rgba()', async () => {
    const { normalizeColor } = await import('./tokens.mjs');
    expect(normalizeColor('rgb(15, 23, 42)')).toBe('#0f172a');
    expect(normalizeColor('rgb(255, 255, 255)')).toBe('#ffffff');
    expect(normalizeColor('rgba(37, 99, 235, 0.1)')).toBe('rgba(37, 99, 235, 0.1)');
    expect(normalizeColor('rgba(0, 0, 0, 0)')).toBe('transparent');
    expect(normalizeColor('linear-gradient(red, blue)')).toBeNull();
    expect(normalizeColor('none')).toBeNull();
  });

  it('builds one token per distinct pair across classes, constant or varying', async () => {
    const { buildTokens } = await import('./tokens.mjs');
    const pairs = {
      text: [{ dark: 'rgb(255, 255, 255)', light: 'rgb(31, 41, 55)', count: 5, examples: [] }, { dark: 'rgb(16, 185, 129)', light: 'rgb(16, 185, 129)', count: 4, examples: [] }],
      background: [{ dark: 'rgb(255, 255, 255)', light: 'rgb(31, 41, 55)', count: 3, examples: [] }, { dark: 'linear-gradient(red, blue)', light: 'none', count: 9, examples: [] }],
      border: [{ dark: 'rgb(255, 255, 255)', light: 'rgb(255, 255, 255)', count: 2, examples: [] }],
      shadow: [], svg: [],
    };
    const tokens = buildTokens(pairs);
    expect(tokens).toHaveLength(3);
    const varying = tokens.find(token => token.dark === '#ffffff' && token.light === '#1f2937');
    expect(varying.count).toBe(8);
    expect(varying.varying).toBe(true);
    expect(varying.name).toBe('--c-ffffff--1f2937');
    expect(tokens.find(token => token.dark === '#10b981').name).toBe('--c-10b981');
    expect(tokens.find(token => token.dark === '#ffffff' && !token.varying).name).toBe('--c-ffffff');
    expect(new Set(tokens.map(token => token.name)).size).toBe(3);
  });

  it('uses role names for the pairs the project already names', async () => {
    const { buildTokens } = await import('./tokens.mjs');
    const pairs = { text: [{ dark: 'rgb(255, 255, 255)', light: 'rgb(15, 23, 42)', count: 1, examples: [] }, { dark: 'rgb(148, 163, 184)', light: 'rgb(100, 116, 139)', count: 1, examples: [] }], background: [], border: [], shadow: [], svg: [] };
    expect(buildTokens(pairs).map(token => token.name).sort()).toEqual(['--text-primary', '--text-secondary']);
  });

  it('renders :root with every token and body.light-mode with the varying ones only', async () => {
    const { renderTokensCss } = await import('./tokens.mjs');
    const css = renderTokensCss([
      { name: '--c-3b82f6', dark: '#3b82f6', light: '#3b82f6', varying: false, count: 1 },
      { name: '--c-ffffff--111827', dark: '#ffffff', light: '#111827', varying: true, count: 1 },
    ]);
    const root = css.slice(css.indexOf(':root'), css.indexOf('body.light-mode'));
    const light = css.slice(css.indexOf('body.light-mode'));
    expect(root).toContain('--c-3b82f6: #3b82f6;');
    expect(root).toContain('--c-ffffff--111827: #ffffff;');
    expect(light).toContain('--c-ffffff--111827: #111827;');
    expect(light).not.toContain('--c-3b82f6');
  });
});
