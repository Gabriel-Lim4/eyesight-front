// Números da migração do tema: linhas com body.light-mode, cores escritas à mão, !important no Theme.css e linhas de CSS.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const HEX = /(?<=[\s:(,])#[0-9a-fA-F]{3,8}\b/g;
const lineCount = text => text.split('\n').length - (text.endsWith('\n') ? 1 : 0);

export function countStats(files) {
  const stats = { lightModeLines: 0, handwrittenColors: {}, importantInTheme: 0, lines: 0 };
  for (const file of files) {
    for (const line of file.text.split('\n')) {
      if (line.includes('body.light-mode')) stats.lightModeLines++;
      if (/--[\w-]+\s*:/.test(line)) continue;
      for (const hex of line.match(HEX) ?? []) {
        const key = hex.toLowerCase();
        stats.handwrittenColors[key] = (stats.handwrittenColors[key] ?? 0) + 1;
      }
    }
    if (basename(file.path) === 'Theme.css') stats.importantInTheme += (file.text.match(/!important/g) ?? []).length;
    stats.lines += lineCount(file.text);
  }
  return stats;
}

const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

/** Lê os CSS do app (tudo em `src`, menos a landing). */
export function appCssFiles(srcDir) {
  return walk(srcDir).filter(path => path.endsWith('.css') && basename(path) !== 'Home.css').map(path => ({ path, text: readFileSync(path, 'utf8') }));
}

export const statsFromDir = srcDir => countStats(appCssFiles(srcDir));
