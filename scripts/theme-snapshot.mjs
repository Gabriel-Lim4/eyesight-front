// Grava a linha de base de cores calculadas das telas do app. Uso: npm run theme:snapshot [-- --only app-overview,app-profile]
import process from 'node:process';
import { BASELINE_DIR, captureAll, parseOnly } from './theme/run.mjs';

captureAll({ only: parseOnly(process.argv.slice(2)), dir: BASELINE_DIR })
  .then(() => process.exit(0))
  .catch(error => { console.error(error); process.exit(2); });
