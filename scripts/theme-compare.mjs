// Compara as cores calculadas de agora com a linha de base. Sai com código 1 se houver qualquer diferença.
// Uso: npm run theme:compare [-- --only app-overview,app-profile]
import process from 'node:process';
import { diffSnapshots } from './theme/compare.mjs';
import { BASELINE_DIR, CURRENT_DIR, captureAll, loadDir, parseOnly } from './theme/run.mjs';

const only = parseOnly(process.argv.slice(2));

async function main() {
  await captureAll({ only, dir: CURRENT_DIR });
  const before = loadDir(BASELINE_DIR, only);
  const after = loadDir(CURRENT_DIR, only);
  for (const key of Object.keys(before)) if (!(key in after)) after[key] = {};
  const diff = diffSnapshots(before, after);
  if (diff.total === 0) {
    console.log(`Nenhuma diferença em ${Object.keys(before).length} capturas.`);
    return 0;
  }
  console.log(`${diff.total} diferença(s):`);
  for (const [key, entry] of Object.entries(diff.byKey)) {
    console.log(`\n${key}: ${entry.changed} elemento(s) mudaram, ${entry.onlyBefore} só antes, ${entry.onlyAfter} só depois`);
    for (const sample of entry.samples) console.log(`  ${sample.path} · ${sample.prop}: ${sample.before} → ${sample.after}`);
  }
  return 1;
}

main().then(code => process.exit(code)).catch(error => { console.error(error); process.exit(2); });
