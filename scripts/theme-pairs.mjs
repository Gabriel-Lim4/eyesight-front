// Tabela de pares (cor no tema escuro → cor no claro) a partir da linha de base. Uso: npm run theme:pairs
import process from 'node:process';
import { buildPairs } from './theme/pairs.mjs';
import { BASELINE_DIR, loadDir } from './theme/run.mjs';

const LIMIT = 25;
const pairs = buildPairs(loadDir(BASELINE_DIR));
for (const [name, list] of Object.entries(pairs)) {
  console.log(`\n### ${name} (${list.length} pares)\n\n| escuro | claro | elementos | exemplo |\n|---|---|---|---|`);
  for (const pair of list.slice(0, LIMIT)) console.log(`| \`${pair.dark}\` | \`${pair.light}\` | ${pair.count} | ${pair.examples[0] ?? ''} |`);
}
process.exit(0);
