// Gera as variáveis de cor a partir da linha de base. Uso: npm run theme:tokens            (mostra o resumo)
//                                                        npm run theme:tokens -- --write   (grava o bloco em variables.css)
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { buildPairs } from './theme/pairs.mjs';
import { BASELINE_DIR, loadDir } from './theme/run.mjs';
import { buildTokens, renderTokensCss } from './theme/tokens.mjs';

const FILE = 'src/styles/variables.css';
const START = '/* >>> variáveis geradas';
const END = '/* <<< variáveis geradas <<< */';

const tokens = buildTokens(buildPairs(loadDir(BASELINE_DIR)));
const varying = tokens.filter(token => token.varying);
console.log(`${tokens.length} variáveis (${varying.length} mudam com o tema, ${tokens.length - varying.length} são constantes); ${tokens.filter(token => token.existing).length} já existiam em variables.css.`);
console.log('\n| variável | escuro | claro | usos |\n|---|---|---|---|');
for (const token of tokens) console.log(`| \`${token.name}\` | \`${token.dark}\` | \`${token.light}\` | ${token.count} |`);

if (process.argv.includes('--write')) {
  const css = readFileSync(FILE, 'utf8');
  const block = renderTokensCss(tokens);
  const from = css.indexOf(START);
  const to = css.indexOf(END);
  const next = from >= 0 && to > from ? css.slice(0, from) + block + css.slice(to + END.length + 1) : `${css.trimEnd()}\n\n${block}`;
  writeFileSync(FILE, next);
  console.log(`\nBloco gravado em ${FILE}.`);
}
process.exit(0);
