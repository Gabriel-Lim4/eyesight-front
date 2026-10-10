import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import { COLOR_PROPS, parseRules } from '../../scripts/theme/css-rules.mjs';
import { findColors } from '../../scripts/theme/migrate.mjs';
import { appCssFiles } from '../../scripts/theme/stats.mjs';

const ROOT = cwd();
const FILES = appCssFiles(join(ROOT, 'src'));
const MIGRATED = JSON.parse(readFileSync(join(ROOT, 'scripts/theme/migrated.json'), 'utf8'));
const EXCEPTIONS = JSON.parse(readFileSync(join(ROOT, 'scripts/theme/exceptions.json'), 'utf8'));
const byName = name => FILES.find(file => basename(file.path) === name);

describe('estrutura do tema', () => {
  it('todo var(--x) usado nos CSS do app está definido (ou tem valor de reserva)', () => {
    const defined = new Set(FILES.flatMap(file => [...file.text.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1])));
    const missing = [];
    for (const file of FILES) {
      for (const match of file.text.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
        if (match[2] === ')' && !defined.has(match[1])) missing.push(`${basename(file.path)}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('os arquivos listados em migrated.json existem', () => {
    for (const name of MIGRATED) expect(byName(name), name).toBeTruthy();
  });

  it('nos arquivos migrados, nenhuma declaração de cor usa cor escrita à mão (só var(), palavras-chave e transparente)', () => {
    const offenders = [];
    for (const name of MIGRATED) {
      for (const rule of parseRules(byName(name).text)) {
        for (const declaration of rule.declarations) {
          if (declaration.prop.startsWith('--') || !COLOR_PROPS.test(declaration.prop)) continue;
          const literal = findColors(declaration.value).some(color => color.normalized && color.normalized !== 'transparent');
          if (literal && !EXCEPTIONS.some(exception => exception.file === name && exception.selector === rule.selector)) {
            offenders.push(`${name}: ${rule.selector} { ${declaration.prop}: ${declaration.value} }`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('as exceções têm arquivo, seletor e motivo', () => {
    for (const exception of EXCEPTIONS) {
      expect(exception.file && exception.selector && exception.reason, JSON.stringify(exception)).toBeTruthy();
    }
  });

  it('as variáveis de cor do tema são definidas em variables.css', () => {
    const variables = byName('variables.css').text;
    expect(existsSync(join(ROOT, 'src/styles/variables.css'))).toBe(true);
    expect(variables).toContain(':root');
    expect(variables).toContain('body.light-mode');
  });
});
