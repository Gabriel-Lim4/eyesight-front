import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

const ROOT = cwd();
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const SRC = walk(join(ROOT, 'src'));
const isTest = path => /__tests__|\.test\./.test(path);
const text = path => readFileSync(path, 'utf8');

describe('fonte carregada uma vez', () => {
  it('nenhum CSS importa o Google Fonts', () => {
    const offenders = SRC.filter(path => path.endsWith('.css') && text(path).includes('fonts.googleapis.com'));
    expect(offenders).toEqual([]);
  });

  it('o index.html tem um único link com as cinco famílias e os pesos usados', () => {
    const html = text(join(ROOT, 'index.html'));
    const links = html.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+"/g) ?? [];
    expect(links).toHaveLength(1);
    const href = links[0];
    for (const family of ['Inter:wght@400;500;600;700;800', 'Tomorrow:wght@400;600;700', 'JetBrains+Mono:wght@400;500;600', 'IBM+Plex+Mono:wght@400;500;600', 'Space+Grotesk:wght@500;600;700']) {
      expect(href).toContain(family);
    }
    expect(href).toContain('display=swap');
  });
});

describe('limpeza', () => {
  it('não resta referência ao cursor customizado', () => {
    const offenders = SRC.filter(path => !isTest(path) && /CustomCursor|custom-cursor-active/.test(text(path)));
    expect(offenders).toEqual([]);
  });
});

describe('nome único: Metas', () => {
  it('nenhum texto de interface usa os nomes antigos', () => {
    const offenders = SRC.filter(path => /\.(jsx|js)$/.test(path) && !isTest(path) && /Limites de alerta|Alertas por campanha|Salvar limites|salvar os limites/.test(text(path)));
    expect(offenders).toEqual([]);
  });
});
