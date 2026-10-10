// Migra as cores escritas à mão dos arquivos-alvo para as variáveis do tema (ver scripts/theme/migrate.mjs).
// Uso: npm run theme:migrate -- --files Overview.css,Plans.css [--dry]    (--files all = todos os CSS do app)
import { writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import process from 'node:process';
import { planMigration, applyEdits } from './theme/migrate.mjs';
import { appCssFiles } from './theme/stats.mjs';
import { loadTokens, saveExtras, writeTokensBlock } from './theme/tokens-io.mjs';

const argv = process.argv.slice(2);
const option = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const dry = argv.includes('--dry');
const all = appCssFiles('src').map(file => ({ name: basename(file.path), path: file.path, text: file.text }));
const requested = option('--files');
if (!requested) { console.error('Informe --files A.css,B.css (ou --files all).'); process.exit(2); }
const targets = requested === 'all' ? all.map(file => file.name) : requested.split(',').map(item => item.trim());
const unknown = targets.filter(name => !all.some(file => file.name === name));
if (unknown.length) { console.error(`Arquivos desconhecidos: ${unknown.join(', ')}`); process.exit(2); }

const tokens = loadTokens();
const plan = planMigration(all, tokens, { targets });

const byReason = {};
for (const item of plan.skipped) (byReason[item.reason] ??= []).push(item);
console.log(`${dry ? 'ENSAIO: ' : ''}${plan.stats.replaced} cores trocadas por variáveis (${plan.stats.paired} por par claro/escuro); ${plan.stats.removed} declarações de sobrescrita removidas; ${plan.stats.created} variáveis constantes novas.`);
for (const [file, list] of Object.entries(plan.edits)) if (list.length) console.log(`  ${file}: ${list.length} edições`);
console.log(`Puladas (${plan.skipped.length}):`);
for (const [reason, list] of Object.entries(byReason)) {
  console.log(`  ${reason}: ${list.length}`);
  if (argv.includes('--verbose')) for (const item of list.slice(0, 40)) console.log(`     ${item.file} · ${item.selector} · ${item.prop}: ${item.value}`);
}
if (!dry) {
  for (const file of all) {
    const edits = plan.edits[file.name] ?? [];
    if (edits.length) writeFileSync(file.path, applyEdits(file.text, edits));
  }
  if (plan.created.length) { saveExtras(plan.created); writeTokensBlock(loadTokens()); }
  console.log('Arquivos gravados.');
}
process.exit(0);
