// Migração das cores escritas à mão para as variáveis do tema.
// Para cada declaração de cor de um arquivo-alvo, procura a sobrescrita `body.light-mode` correspondente (mesmo contexto,
// mesmo seletor, mesma propriedade); se o par (cor no escuro, cor no claro) tem variável, troca a cor pela variável e
// remove a sobrescrita. Casos ambíguos são pulados e relatados, nunca adivinhados.
import { COLOR_PROPS } from './css-rules.mjs';
import { slug } from './tokens.mjs';

const LIGHT = 'body.light-mode';

/** Cor escrita à mão → forma medida pelo navegador (`#rrggbb`, `rgba(r, g, b, a)` ou `transparent`); outra coisa → null. */
export function parseAuthoredColor(input) {
  const text = String(input).trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
  let r; let g; let b; let a = 1;
  if (hex) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map(char => char + char).join('') : hex[1];
    [r, g, b] = [0, 2, 4].map(at => parseInt(digits.slice(at, at + 2), 16));
    if (digits.length === 8) a = parseInt(digits.slice(6, 8), 16) / 255;
  } else {
    const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(text);
    if (!fn) return null;
    [r, g, b] = [fn[1], fn[2], fn[3]].map(Number);
    if (fn[4] !== undefined) a = Number(fn[4]);
  }
  if (a === 0) return 'transparent';
  if (a === 1) return `#${[r, g, b].map(part => Math.round(part).toString(16).padStart(2, '0')).join('')}`;
  return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(2))})`;
}

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

/** Todas as cores literais de um valor, com posição (dentro de `url(...)` não conta). */
export function findColors(value) {
  const blanked = value.replace(/url\([^)]*\)/g, match => ' '.repeat(match.length));
  const found = [];
  for (const match of blanked.matchAll(COLOR_LITERAL)) {
    const text = value.slice(match.index, match.index + match[0].length);
    found.push({ text, start: match.index, end: match.index + text.length, normalized: parseAuthoredColor(text) });
  }
  return found;
}

function skipString(text, at) {
  const quote = text[at];
  let i = at + 1;
  while (i < text.length && text[i] !== quote) i += text[i] === '\\' ? 2 : 1;
  return i + 1;
}

function splitList(text) {
  const items = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) { items.push(current.trim()); current = ''; } else current += char;
  }
  items.push(current.trim());
  return items.filter(Boolean);
}

function parseDecls(text, start, end) {
  const decls = [];
  let depth = 0;
  let segStart = start;
  const flush = (segEnd, hasSemicolon) => {
    let s = segStart;
    for (;;) {
      while (s < segEnd && /\s/.test(text[s])) s++;
      if (text.startsWith('/*', s) && s < segEnd) { const close = text.indexOf('*/', s + 2); s = close < 0 ? segEnd : close + 2; } else break;
    }
    let e = segEnd;
    while (e > s && /\s/.test(text[e - 1])) e--;
    const colon = text.slice(s, e).indexOf(':');
    if (s < e && colon > 0) {
      const prop = text.slice(s, s + colon).trim();
      let valueStart = s + colon + 1;
      while (valueStart < e && /\s/.test(text[valueStart])) valueStart++;
      decls.push({ prop, value: text.slice(valueStart, e), valueStart, valueEnd: e, declStart: s, declEnd: segEnd + (hasSemicolon ? 1 : 0) });
    }
    segStart = segEnd + 1;
  };
  for (let i = start; i < end;) {
    const char = text[i];
    if (char === '/' && text[i + 1] === '*') { const close = text.indexOf('*/', i + 2); i = close < 0 ? end : close + 2; continue; }
    if (char === '"' || char === "'") { i = skipString(text, i); continue; }
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ';' && depth === 0) flush(i, true);
    i++;
  }
  flush(end, false);
  return decls;
}

/** Regras com seletores, contexto (@media…) e declarações com posições absolutas no texto. */
export function scanCss(text) {
  const rules = [];
  const stack = [];
  let segmentStart = 0;
  for (let i = 0; i < text.length;) {
    const char = text[i];
    if (char === '/' && text[i + 1] === '*') { const close = text.indexOf('*/', i + 2); i = close < 0 ? text.length : close + 2; continue; }
    if (char === '"' || char === "'") { i = skipString(text, i); continue; }
    if (char === '{') {
      const raw = text.slice(segmentStart, i).replace(/\/\*[\s\S]*?\*\//g, '');
      const header = raw.trim();
      if (header.startsWith('@')) { stack.push(header.replace(/\s+/g, ' ')); i++; segmentStart = i; continue; }
      let bodyEnd = i + 1;
      for (let depth = 0; bodyEnd < text.length; bodyEnd++) {
        if (text[bodyEnd] === '/' && text[bodyEnd + 1] === '*') { const close = text.indexOf('*/', bodyEnd + 2); bodyEnd = (close < 0 ? text.length : close + 2) - 1; continue; }
        if (text[bodyEnd] === '"' || text[bodyEnd] === "'") { bodyEnd = skipString(text, bodyEnd) - 1; continue; }
        if (text[bodyEnd] === '(') depth++;
        if (text[bodyEnd] === ')') depth--;
        if (text[bodyEnd] === '}' && depth <= 0) break;
      }
      let ruleStart = segmentStart;
      while (ruleStart < i && /\s/.test(text[ruleStart])) ruleStart++;
      rules.push({ selectors: splitList(header), context: stack.join(' | '), ruleStart, blockStart: i, blockEnd: bodyEnd, decls: parseDecls(text, i + 1, bodyEnd) });
      i = bodyEnd + 1;
      segmentStart = i;
      continue;
    }
    if (char === '}') { stack.pop(); i++; segmentStart = i; continue; }
    if (char === ';' && stack.length === 0) segmentStart = i + 1;
    i++;
  }
  return rules;
}

export function applyEdits(text, edits) {
  let out = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return out;
}

function declarationSpan(text, decl) {
  let start = decl.declStart;
  let end = decl.declEnd;
  let before = start;
  while (before > 0 && (text[before - 1] === ' ' || text[before - 1] === '\t')) before--;
  let after = end;
  while (after < text.length && (text[after] === ' ' || text[after] === '\t')) after++;
  const ownLine = (before === 0 || text[before - 1] === '\n') && (after >= text.length || text[after] === '\n' || text[after] === '\r');
  if (ownLine) {
    if (text[after] === '\r' && text[after + 1] === '\n') after += 2;
    else if (text[after] === '\n') after += 1;
    return { start: before, end: after };
  }
  return { start, end: after };
}

function ruleSpan(text, rule) {
  let end = rule.blockEnd + 1;
  while (end < text.length && (text[end] === ' ' || text[end] === '\t')) end++;
  if (text[end] === '\r' && text[end + 1] === '\n') end += 2;
  else if (text[end] === '\n') end += 1;
  return { start: rule.ruleStart, end };
}

const baseSelector = selector => (selector === LIGHT ? 'body' : selector.startsWith(`${LIGHT} `) ? selector.slice(LIGHT.length + 1).trim() : null);
const isOverrideRule = rule => rule.selectors.some(selector => selector === LIGHT || selector.startsWith(`${LIGHT} `));
const cleanValue = value => value.replace(/\s*!important\s*$/i, '').trim();

// Propriedades que pintam a mesma coisa (shorthand e longhand de cor) formam uma família.
const FAMILY = prop => (prop === 'background' || prop === 'background-color' ? 'background'
  : /^(border|outline)(-(top|right|bottom|left))?(-color)?$/.test(prop) ? prop.replace(/-color$/, '')
    : prop);
const aliasesOf = prop => (FAMILY(prop) === prop && !/^(background|border|outline)/.test(prop) ? [prop]
  : FAMILY(prop) === 'background' ? ['background', 'background-color']
    : [FAMILY(prop), `${FAMILY(prop)}-color`]);
const isImportant = value => /!important\s*$/i.test(value);

// Uma regra "estende" outra quando é o mesmo elemento com estado ou modificador (.a:hover, .a.ativo, .a[x]), nunca pseudo-elemento.
const extendsSelector = (candidate, base) => candidate !== base && candidate.startsWith(base)
  && /^(:(?!:)|\.|\[|#)/.test(candidate.slice(base.length));

export function planMigration(files, tokens, { targets }) {
  const parsed = files.map((file, fileIndex) => ({ ...file, fileIndex, rules: scanCss(file.text) }));
  const rootDefs = {};
  const lightDefs = {};
  for (const file of parsed) {
    for (const rule of file.rules) {
      for (const decl of rule.decls.filter(item => item.prop.startsWith('--'))) {
        if (rule.selectors.includes(':root')) rootDefs[decl.prop] = decl.value;
        if (rule.selectors.includes(LIGHT)) lightDefs[decl.prop] = decl.value;
      }
    }
  }
  const resolve = (value, mode, depth = 0) => {
    const direct = parseAuthoredColor(cleanValue(value));
    if (direct) return direct;
    const ref = /^var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)$/.exec(cleanValue(value));
    if (!ref || depth > 5) return null;
    const next = (mode === 'light' ? lightDefs[ref[1]] ?? rootDefs[ref[1]] : rootDefs[ref[1]]);
    return next === undefined ? null : resolve(next, mode, depth + 1);
  };

  // Grupos de sobrescrita: contexto + seletor-base + família da propriedade.
  const groupKey = (context, selector, prop) => `${context}||${selector}||${FAMILY(prop)}`;
  const groups = new Map();
  for (const file of parsed) {
    for (const rule of file.rules) {
      for (const selector of rule.selectors) {
        const base = baseSelector(selector);
        if (base === null) continue;
        for (const decl of rule.decls) {
          const key = groupKey(rule.context, base, decl.prop);
          groups.set(key, [...(groups.get(key) ?? []), { file, rule, decl, selector, important: isImportant(decl.value) }]);
        }
      }
    }
  }
  // Vencedora do grupo: !important primeiro; entre iguais, a última do arquivo. Vários arquivos só valem se concordarem.
  const winnerLight = entries => {
    if (entries.some(entry => entry.important)) return { reason: 'sobrescrita !important' };
    const lights = entries.map(entry => resolve(entry.decl.value, 'light'));
    if (lights.some(light => light === null)) return { reason: 'sobrescrita não é cor simples' };
    if (new Set(entries.map(entry => entry.file.name)).size > 1) {
      return new Set(lights).size === 1 ? { light: lights[0] } : { reason: 'sobrescritas em arquivos diferentes' };
    }
    const last = entries.reduce((best, entry) => (entry.decl.valueStart > best.decl.valueStart ? entry : best));
    return { light: resolve(last.decl.value, 'light') };
  };

  const baseDecls = new Map();
  const baseSelectors = new Map(); // seletor → famílias de cor que ele declara
  for (const file of parsed) {
    for (const rule of file.rules) {
      if (isOverrideRule(rule)) continue;
      for (const selector of rule.selectors) {
        for (const decl of rule.decls) {
          baseDecls.set(`${selector}||${decl.prop}`, [...(baseDecls.get(`${selector}||${decl.prop}`) ?? []), decl]);
          if (!decl.prop.startsWith('--') && COLOR_PROPS.test(decl.prop)) baseSelectors.set(selector, new Set([...(baseSelectors.get(selector) ?? []), FAMILY(decl.prop)]));
        }
      }
    }
  }
  const hasStateRule = (selector, prop) => [...baseSelectors].some(([candidate, families]) => extendsSelector(candidate, selector) && families.has(FAMILY(prop)));

  const edits = Object.fromEntries(files.map(file => [file.name, []]));
  const skipped = [];
  const stats = { replaced: 0, paired: 0, removed: 0, created: 0 };
  const handled = new Map(); // declaração-base já trocada por par → valor claro usado
  const created = new Map();
  const targetFiles = parsed.filter(item => targets.includes(item.name));
  const isColorDecl = decl => !decl.prop.startsWith('--') && COLOR_PROPS.test(decl.prop);
  const skip = (file, rule, decl, reason) => skipped.push({ file: file.name, selector: rule.selectors.join(', '), prop: decl.prop, value: decl.value, reason });
  const constantFor = color => {
    const known = tokens.find(token => !token.varying && token.dark === color) ?? created.get(color);
    if (known) return known;
    const token = { name: `--c-${slug(color)}`, dark: color, light: color, varying: false };
    created.set(color, token);
    stats.created++;
    return token;
  };

  // Passo 1: pares (cor no escuro + sobrescrita clara vencedora) que têm variável medida.
  for (const file of targetFiles) {
    for (const rule of file.rules) {
      if (isOverrideRule(rule)) continue;
      for (const decl of rule.decls.filter(isColorDecl)) {
        const colors = findColors(decl.value).filter(color => color.normalized && color.normalized !== 'transparent');
        if (colors.length !== 1) continue;
        const lists = rule.selectors.map(selector => groups.get(groupKey(rule.context, selector, decl.prop)) ?? []);
        if (lists.every(list => list.length === 0)) continue;
        if (lists.some(list => list.length === 0)) { skip(file, rule, decl, 'sobrescrita parcial'); continue; }
        if (rule.selectors.some(selector => hasStateRule(selector, decl.prop))) { skip(file, rule, decl, 'regra com estado na mesma propriedade'); continue; }
        const winners = lists.map(winnerLight);
        const failed = winners.find(winner => winner.reason);
        if (failed) { skip(file, rule, decl, failed.reason); continue; }
        if (new Set(winners.map(winner => winner.light)).size !== 1) { skip(file, rule, decl, 'sobrescritas diferentes'); continue; }
        const token = tokens.find(item => item.varying && item.dark === colors[0].normalized && item.light === winners[0].light);
        if (!token) { skip(file, rule, decl, 'sem variável medida para o par'); continue; }
        edits[file.name].push({ start: decl.valueStart + colors[0].start, end: decl.valueStart + colors[0].end, text: `var(${token.name})` });
        handled.set(decl, winners[0].light);
        stats.replaced++;
        stats.paired++;
      }
    }
  }

  // Um grupo só sai quando TODAS as declarações originais que ele cobre (qualquer arquivo ou contexto) foram emparelhadas
  // com a luz da vencedora, não há !important nem regra com estado; então a vencedora e as perdedoras saem juntas.
  const removableGroup = new Set();
  for (const [key, entries] of groups) {
    const [, base, family] = key.split('||');
    const winner = winnerLight(entries);
    if (winner.reason) continue;
    const props = aliasesOf(family);
    const matches = props.flatMap(prop => baseDecls.get(`${base}||${prop}`) ?? []);
    if (matches.length === 0 || !matches.every(match => handled.get(match) === winner.light)) continue;
    if (hasStateRule(base, family)) continue;
    removableGroup.add(key);
  }
  const removed = new Set();
  for (const file of parsed) {
    for (const rule of file.rules) {
      if (!isOverrideRule(rule)) continue;
      const removable = rule.decls.filter(decl => rule.selectors.every(selector => removableGroup.has(groupKey(rule.context, baseSelector(selector), decl.prop))));
      if (removable.length === 0) continue;
      removable.forEach(decl => removed.add(decl));
      stats.removed += removable.length;
      if (removable.length === rule.decls.length) edits[file.name].push({ ...ruleSpan(file.text, rule), text: '' });
      else for (const decl of removable) edits[file.name].push({ ...declarationSpan(file.text, decl), text: '' });
    }
  }

  // Passo 2: toda outra cor escrita à mão vira variável constante (mesmo valor nos dois temas: neutro por construção).
  for (const file of targetFiles) {
    for (const rule of file.rules) {
      for (const decl of rule.decls.filter(isColorDecl)) {
        if (handled.has(decl) || removed.has(decl)) continue;
        for (const color of findColors(decl.value)) {
          if (!color.normalized || color.normalized === 'transparent') continue;
          edits[file.name].push({ start: decl.valueStart + color.start, end: decl.valueStart + color.end, text: `var(${constantFor(color.normalized).name})` });
          stats.replaced++;
        }
      }
    }
  }
  return { edits, skipped, stats, created: [...created.values()] };
}
