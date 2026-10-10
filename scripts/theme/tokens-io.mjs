// Leitura e gravação das variáveis: as medidas (linha de base) mais as constantes extras criadas pela migração.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPairs } from './pairs.mjs';
import { BASELINE_DIR, loadDir } from './run.mjs';
import { buildTokens, renderTokensCss } from './tokens.mjs';

const EXTRAS = 'scripts/theme/extra-tokens.json';
const VARIABLES = 'src/styles/variables.css';
const START = '/* >>> variáveis geradas';
const END = '/* <<< variáveis geradas <<< */';

export const loadExtras = () => JSON.parse(readFileSync(EXTRAS, 'utf8'));

export function loadTokens() {
  const measured = buildTokens(buildPairs(loadDir(BASELINE_DIR)));
  const taken = new Set(measured.map(token => token.name));
  const extras = loadExtras().filter(token => !taken.has(token.name)).map(token => ({ ...token, count: 0, existing: false }));
  return [...measured, ...extras];
}

export function saveExtras(created) {
  const byName = new Map(loadExtras().map(token => [token.name, token]));
  for (const token of created) byName.set(token.name, { name: token.name, dark: token.dark, light: token.light, varying: false });
  writeFileSync(EXTRAS, `${JSON.stringify([...byName.values()].sort((a, b) => a.name.localeCompare(b.name)), null, 2)}\n`);
}

export function writeTokensBlock(tokens) {
  const css = readFileSync(VARIABLES, 'utf8');
  const block = renderTokensCss(tokens);
  const from = css.indexOf(START);
  const to = css.indexOf(END);
  const next = from >= 0 && to > from ? css.slice(0, from) + block + css.slice(to + END.length + 1) : `${css.trimEnd()}\n\n${block}`;
  writeFileSync(VARIABLES, next);
}
