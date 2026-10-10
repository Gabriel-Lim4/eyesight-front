// Leitor simples de CSS: regras com seletor e declarações (comentários removidos, @media achatado, listas de seletores separadas).
export const COLOR_PROPS = /^(color|background(-color|-image)?|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|box-shadow|text-shadow|fill|stroke|caret-color|accent-color|text-decoration(-color)?|column-rule(-color)?)$/;

function splitDeclarations(body) {
  const out = [];
  let depth = 0;
  let current = '';
  for (const char of body) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ';' && depth === 0) { out.push(current); current = ''; } else current += char;
  }
  out.push(current);
  return out;
}

export function parseRules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = splitDeclarations(match[2])
      .map(item => item.trim())
      .filter(item => item.includes(':'))
      .map(item => { const at = item.indexOf(':'); return { prop: item.slice(0, at).trim(), value: item.slice(at + 1).trim() }; });
    for (const selector of match[1].split(',').map(item => item.trim()).filter(Boolean)) {
      rules.push({ selector, declarations });
    }
  }
  return rules;
}
