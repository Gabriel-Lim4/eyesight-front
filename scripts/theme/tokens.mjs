// Variáveis de cor a partir dos pares medidos (cor no escuro → cor no claro). Cada variável é exatamente um par.
const TRANSPARENT = 'transparent';

/** `rgb(15, 23, 42)` → `#0f172a`; `rgba(…, 0.1)` → `rgba(…, 0.1)`; totalmente transparente → `transparent`; o resto (degradês, none) → null. */
export function normalizeColor(value) {
  const rgb = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(value);
  if (rgb) return `#${rgb.slice(1).map(part => Number(part).toString(16).padStart(2, '0')).join('')}`;
  const rgba = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(value);
  if (rgba) return Number(rgba[4]) === 0 ? TRANSPARENT : `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${rgba[4]})`;
  return null;
}

// Nomes de papel dos pares que o projeto já nomeia ou que são claramente identificáveis. Chave: `escuro|claro`.
export const ROLES = {
  '#ffffff|#0f172a': '--text-primary',
  '#94a3b8|#64748b': '--text-secondary',
  '#0b1120|#ffffff': '--bg-container',
  '#020617|#f8fafc': '--bg-input',
  '#020617|#ffffff': '--bg-field',
  '#04070f|#f1f5f9': '--bg-page',
  '#04070f|#eef2f8': '--bg-app',
  'transparent|#f1f5f9': '--bg-active',
  '#1e293b|#e2e8f0': '--border-color',
  '#3b82f6|#3b82f6': '--accent-blue',
  '#9333ea|#9333ea': '--accent-purple',
  '#ffffff|#111827': '--text-body',
  '#8291a8|#111827': '--text-nav',
  '#8291a8|#64748b': '--text-nav-muted',
  '#93c5fd|#1d4ed8': '--status-stable',
  '#34d399|#047857': '--status-good',
  '#fbbf24|#b45309': '--status-attention',
  '#94a3b8|#475569': '--status-unknown',
};

// Variáveis que já estão definidas em variables.css com os mesmos valores: não são redefinidas no bloco gerado.
export const EXISTING = new Set(['--text-primary', '--text-secondary', '--bg-container', '--bg-input', '--bg-page', '--border-color', '--accent-blue', '--accent-purple']);

const slug = color => color.replace(/^#/, '').replace(/^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/, 'rgba-$1-$2-$3-$4').replace(/\./g, '_');

export function buildTokens(pairs) {
  const map = new Map();
  for (const list of Object.values(pairs)) {
    for (const pair of list) {
      const dark = normalizeColor(pair.dark);
      const light = normalizeColor(pair.light);
      if (!dark || !light || (dark === TRANSPARENT && light === TRANSPARENT)) continue;
      const key = `${dark}|${light}`;
      const token = map.get(key) ?? { dark, light, varying: dark !== light, count: 0 };
      token.count += pair.count;
      map.set(key, token);
    }
  }
  return [...map.entries()].map(([key, token]) => {
    const name = ROLES[key] ?? (token.varying ? `--c-${slug(token.dark)}--${slug(token.light)}` : `--c-${slug(token.dark)}`);
    return { name, ...token, existing: EXISTING.has(name) };
  }).sort((a, b) => b.count - a.count);
}

export function renderTokensCss(tokens) {
  const fresh = tokens.filter(token => !token.existing);
  const lines = ['/* >>> variáveis geradas por `npm run theme:tokens`: cada uma é um par medido (cor no escuro e no claro) >>> */', ':root {'];
  for (const token of fresh) lines.push(`  ${token.name}: ${token.dark};`);
  lines.push('}', '', 'body.light-mode {');
  for (const token of fresh.filter(item => item.varying)) lines.push(`  ${token.name}: ${token.light};`);
  lines.push('}', '/* <<< variáveis geradas <<< */', '');
  return lines.join('\n');
}
