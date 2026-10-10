// Números da migração do tema nos CSS do app. Uso: npm run theme:stats
import process from 'node:process';
import { statsFromDir } from './theme/stats.mjs';

const stats = statsFromDir('src');
const colors = Object.entries(stats.handwrittenColors).sort((a, b) => b[1] - a[1]);
console.log(`linhas com body.light-mode: ${stats.lightModeLines}`);
console.log(`!important em Theme.css: ${stats.importantInTheme}`);
console.log(`linhas de CSS do app: ${stats.lines}`);
console.log(`cores escritas à mão: ${colors.reduce((total, [, count]) => total + count, 0)} (${colors.length} valores distintos)`);
console.log(`mais usadas: ${colors.slice(0, 12).map(([color, count]) => `${color}×${count}`).join(' ')}`);
process.exit(0);
