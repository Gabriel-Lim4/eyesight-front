import { describe, expect, it } from 'vitest';
import { applyEdits, findColors, parseAuthoredColor, planMigration, scanCss } from './migrate.mjs';

const TOKENS = [
  { name: '--text-primary', dark: '#ffffff', light: '#0f172a', varying: true },
  { name: '--text-body', dark: '#ffffff', light: '#111827', varying: true },
  { name: '--c-3b82f6', dark: '#3b82f6', light: '#3b82f6', varying: false },
  { name: '--c-94a3b8--64748b', dark: '#94a3b8', light: '#64748b', varying: true },
  { name: '--border-color', dark: '#1e293b', light: '#e2e8f0', varying: true },
];
const run = (files, targets, tokens = TOKENS) => {
  const plan = planMigration(files, tokens, { targets });
  const out = Object.fromEntries(files.map(file => [file.name, applyEdits(file.text, plan.edits[file.name] ?? [])]));
  return { out, plan };
};

describe('parseAuthoredColor', () => {
  it('normalizes hex, rgb and rgba to the measured form', () => {
    expect(parseAuthoredColor('#fff')).toBe('#ffffff');
    expect(parseAuthoredColor('#FFF')).toBe('#ffffff');
    expect(parseAuthoredColor('#1E293B')).toBe('#1e293b');
    expect(parseAuthoredColor('rgba(255,255,255,.1)')).toBe('rgba(255, 255, 255, 0.1)');
    expect(parseAuthoredColor('rgb(15 23 42)')).toBe('#0f172a');
    expect(parseAuthoredColor('rgba(0, 0, 0, 0)')).toBe('transparent');
  });
  it('returns null for anything that is not a plain color', () => {
    for (const value of ['red', 'var(--x)', 'linear-gradient(red, blue)', 'none', 'currentColor']) expect(parseAuthoredColor(value)).toBeNull();
  });
});

describe('findColors', () => {
  it('finds every color literal with its position', () => {
    const found = findColors('1px solid #FFF, 0 0 4px rgba(0,0,0,.3)');
    expect(found.map(item => item.text)).toEqual(['#FFF', 'rgba(0,0,0,.3)']);
    expect(found.map(item => item.normalized)).toEqual(['#ffffff', 'rgba(0, 0, 0, 0.3)']);
  });
});

describe('scanCss', () => {
  it('reads selectors, context and declarations with offsets, ignoring comments and url() semicolons', () => {
    const text = '/* a { color: red } */\n@media (max-width: 600px) {\n  .a, .b:is(.c, .d) { color: #fff; background: url("x;y") }\n}\n';
    const rules = scanCss(text);
    expect(rules).toHaveLength(1);
    expect(rules[0].selectors).toEqual(['.a', '.b:is(.c, .d)']);
    expect(rules[0].context).toBe('@media (max-width: 600px)');
    expect(rules[0].decls.map(item => item.prop)).toEqual(['color', 'background']);
    const color = rules[0].decls[0];
    expect(text.slice(color.valueStart, color.valueEnd)).toBe('#fff');
  });
});

describe('planMigration', () => {
  const base = '.a { color: #fff; border: 1px solid #3b82f6; }\n';
  it('replaces a paired color by the varying token and removes the override', () => {
    const { out } = run([{ name: 'A.css', text: base }, { name: 'Theme.css', text: 'body.light-mode .a { color: #0f172a; }\n' }], ['A.css']);
    expect(out['A.css']).toBe('.a { color: var(--text-primary); border: 1px solid var(--c-3b82f6); }\n');
    expect(out['Theme.css']).toBe('');
  });
  it('resolves var() in the override through :root definitions', () => {
    const files = [{ name: 'A.css', text: base }, { name: 'Theme.css', text: ':root { --app-text: #111827; }\nbody.light-mode .a { color: var(--app-text); }\n' }];
    const { out } = run(files, ['A.css']);
    expect(out['A.css']).toContain('color: var(--text-body)');
    expect(out['Theme.css']).not.toContain('body.light-mode .a');
  });
  it('keeps the other declarations of an override rule', () => {
    const files = [{ name: 'A.css', text: base }, { name: 'Theme.css', text: 'body.light-mode .a { color: #0f172a; box-shadow: none; }\n' }];
    expect(run(files, ['A.css']).out['Theme.css']).toBe('body.light-mode .a { box-shadow: none; }\n');
  });
  it('uses the constant token when there is no override and creates one for a color without token', () => {
    const files = [{ name: 'A.css', text: '.b { color: #3b82f6; background: #123456; }\n' }];
    const { out, plan } = run(files, ['A.css']);
    expect(out['A.css']).toBe('.b { color: var(--c-3b82f6); background: var(--c-123456); }\n');
    expect(plan.created).toEqual([{ name: '--c-123456', dark: '#123456', light: '#123456', varying: false }]);
  });
  it('never guesses a varying token for a color without override: it gets its own constant', () => {
    const files = [{ name: 'A.css', text: '.b { color: #94a3b8; }\n' }];
    const { out, plan } = run(files, ['A.css']);
    expect(out['A.css']).toBe('.b { color: var(--c-94a3b8); }\n');
    expect(plan.created.map(token => token.name)).toEqual(['--c-94a3b8']);
  });
  it('pairs background with background-color and border with border-color', () => {
    const tokens = [...TOKENS, { name: '--bg-input', dark: '#020617', light: '#f8fafc', varying: true }];
    const files = [{ name: 'A.css', text: '.a { background: #020617; border: 1px solid #1e293b; }\n' }, { name: 'Theme.css', text: 'body.light-mode .a { background-color: #f8fafc; border-color: #e2e8f0; }\n' }];
    const { out } = run(files, ['A.css'], tokens);
    expect(out['A.css']).toBe('.a { background: var(--bg-input); border: 1px solid var(--border-color); }\n');
    expect(out['Theme.css']).toBe('');
  });
  it('replaces every color of gradients and shadows by constants', () => {
    const files = [{ name: 'A.css', text: '.g { background: linear-gradient(90deg, #3b82f6, rgba(139,92,246,.5)); box-shadow: 0 0 4px #3b82f6; }\n' }];
    const { out } = run(files, ['A.css']);
    expect(out['A.css']).toBe('.g { background: linear-gradient(90deg, var(--c-3b82f6), var(--c-rgba-139-92-246-0_5)); box-shadow: 0 0 4px var(--c-3b82f6); }\n');
  });
  it('leaves named colors, transparent, urls and custom properties alone', () => {
    const text = '.n { color: white; background: transparent url("a#fff.svg") no-repeat; border: 1px solid rgba(0,0,0,0); --x: #fff; }\n';
    expect(run([{ name: 'A.css', text }], ['A.css']).out['A.css']).toBe(text);
  });
  it('tokenizes the colors of override rules that stay', () => {
    const files = [{ name: 'Theme.css', text: 'body.light-mode .x { color: #abcdef; }\n' }];
    const { out, plan } = run(files, ['Theme.css']);
    expect(out['Theme.css']).toBe('body.light-mode .x { color: var(--c-abcdef); }\n');
    expect(plan.created.map(token => token.name)).toEqual(['--c-abcdef']);
  });
  it('pairs only inside the same media context', () => {
    const files = [{ name: 'A.css', text: '@media (max-width: 600px) { .a { color: #fff; } }\n' }, { name: 'Theme.css', text: 'body.light-mode .a { color: #0f172a; }\n' }];
    const { out } = run(files, ['A.css']);
    expect(out['A.css']).toContain('color: var(--c-ffffff)');
    expect(out['Theme.css']).toContain('body.light-mode .a');
  });
  it('skips a selector list when not every selector has the same override', () => {
    const files = [{ name: 'A.css', text: '.a, .b { color: #fff; }\n' }, { name: 'Theme.css', text: 'body.light-mode .a { color: #0f172a; }\n' }];
    const { out, plan } = run(files, ['A.css']);
    expect(out['A.css']).toBe('.a, .b { color: var(--c-ffffff); }\n');
    expect(out['Theme.css']).toContain('body.light-mode .a');
    expect(plan.created.map(token => token.name)).toEqual(['--c-ffffff']);
  });
  it('skips a declaration with several colors that has an override', () => {
    const files = [{ name: 'A.css', text: '.a { border: 1px solid #1e293b; box-shadow: 0 0 1px #fff, 0 0 2px #3b82f6; }\n' }, { name: 'Theme.css', text: 'body.light-mode .a { box-shadow: none; }\n' }];
    const { out } = run(files, ['A.css']);
    expect(out['A.css']).toContain('box-shadow: 0 0 1px var(--c-ffffff), 0 0 2px var(--c-3b82f6)');
    expect(out['Theme.css']).toContain('body.light-mode .a');
  });
  it('maps body.light-mode itself to body', () => {
    const files = [{ name: 'Theme.css', text: 'body { color: #fff; }\nbody.light-mode { color: #0f172a; }\n' }];
    const { out } = run(files, ['Theme.css']);
    expect(out['Theme.css']).toContain('body { color: var(--text-primary); }');
    expect(out['Theme.css']).not.toContain('body.light-mode');
  });
  it('leaves custom property definitions alone', () => {
    const files = [{ name: 'A.css', text: ':root { --x: #fff; }\n' }];
    expect(run(files, ['A.css']).out['A.css']).toBe(':root { --x: #fff; }\n');
  });
});

describe('applyEdits', () => {
  it('applies non-overlapping edits from the end', () => {
    expect(applyEdits('abcdef', [{ start: 0, end: 1, text: 'X' }, { start: 4, end: 6, text: 'YY' }])).toBe('XbcdYY');
  });
});
