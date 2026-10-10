// Regras de decisão e texto do relatório da auditoria de acessibilidade (funções puras).
const GATED_GROUPS = ['app', 'auth'];
const BLOCKING_IMPACTS = ['serious', 'critical'];
const ORDER = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const rank = impact => ORDER[impact] ?? 4;

/** Só as telas do app e de autenticação bloqueiam; landing e avisos de área de toque nunca bloqueiam. */
export function isBlocking(result) {
  if (!GATED_GROUPS.includes(result.group)) return false;
  return Boolean(result.loadError)
    || result.overflow
    || result.focusMissing.length > 0
    || result.violations.some(violation => BLOCKING_IMPACTS.includes(violation.impact));
}

const isTransparent = color => color === 'transparent' || /^rgba\(.*,\s*0\)$/.test(color);
const outlineShown = style => style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 && !isTransparent(style.outlineColor);
const outlineSignature = style => `${style.outlineStyle}|${style.outlineWidth}|${style.outlineColor}`;

/** Só conta como indicador de foco o que o foco cria ou muda: contorno novo, sombra nova, borda, fundo ou sublinhado diferentes. */
export function hasFocusIndicator(before, after) {
  return (outlineShown(after) && outlineSignature(before) !== outlineSignature(after))
    || (after.boxShadow !== 'none' && before.boxShadow !== after.boxShadow)
    || before.borderColor !== after.borderColor
    || before.backgroundColor !== after.backgroundColor
    || before.textDecoration !== after.textDecoration;
}

/** A tela auditada tem de ser a esperada: um redirecionamento (para o login, por exemplo) não pode contar como a tela do app. */
export function isExpectedPath(finalUrl, screenPath, expectedPath = screenPath) {
  return new URL(finalUrl).pathname === expectedPath.split('?')[0];
}

export const blockingResults = results => results.filter(isBlocking);

export function summarize(results) {
  const byGroup = {};
  const rules = new Map();
  for (const result of results) {
    const group = byGroup[result.group] ?? (byGroup[result.group] = { screenIds: new Set(), violations: 0 });
    group.screenIds.add(result.screen);
    group.violations += result.violations.length;
    for (const violation of result.violations) {
      const rule = rules.get(violation.id) ?? { id: violation.id, impact: violation.impact, nodes: 0, screenIds: new Set() };
      if (rank(violation.impact) < rank(rule.impact)) rule.impact = violation.impact;
      rule.nodes += violation.nodes;
      rule.screenIds.add(result.screen);
      rules.set(violation.id, rule);
    }
  }
  return {
    total: results.length,
    blocking: blockingResults(results).length,
    byGroup: Object.fromEntries(Object.entries(byGroup).map(([name, data]) => [name, { screens: data.screenIds.size, violations: data.violations }])),
    rules: [...rules.values()]
      .map(({ screenIds, ...rule }) => ({ ...rule, screens: screenIds.size }))
      .sort((a, b) => rank(a.impact) - rank(b.impact) || b.nodes - a.nodes),
  };
}

const label = result => [result.group, result.screen, result.theme, result.viewport, result.state].filter(Boolean).join(' · ');

export function formatTable(results) {
  const lines = [];
  const incomplete = new Map();
  for (const result of results) {
    const flags = [result.overflow && 'rolagem horizontal', result.focusMissing.length > 0 && `sem indicador de foco (${result.focusMissing.length})`, result.smallTargets > 0 && `alvos pequenos: ${result.smallTargets}`].filter(Boolean);
    if (!result.loadError && result.violations.length === 0 && flags.length === 0) continue;
    lines.push(`${isBlocking(result) ? '✗' : '·'} ${label(result)}`);
    if (result.loadError) lines.push(`    não abriu: ${result.loadError}`);
    for (const violation of [...result.violations].sort((a, b) => rank(a.impact) - rank(b.impact))) {
      lines.push(`    - ${violation.id} (${violation.impact}) × ${violation.nodes}: ${violation.help}`);
      for (const target of violation.targets ?? []) lines.push(`        ${target}`);
    }
    if (flags.length) lines.push(`    - ${flags.join('; ')}`);
    for (const item of result.focusMissing) lines.push(`      foco: ${item}`);
  }
  for (const result of results) {
    for (const item of result.incomplete) {
      const set = incomplete.get(item.id) ?? new Set();
      set.add(result.screen);
      incomplete.set(item.id, set);
    }
  }
  if (incomplete.size) {
    lines.push('', 'Regras incompletas (o axe não conseguiu decidir; conferir à mão):');
    for (const [id, screens] of incomplete) lines.push(`    - ${id}: ${[...screens].join(', ')}`);
  }
  const truncated = results.filter(result => result.focusTruncated).length;
  if (truncated > 0) lines.push('', `Foco verificado só até 60 paradas de Tab em ${truncated} combinação(ões).`);
  const summary = summarize(results);
  const undecided = results.reduce((total, result) => total + result.incomplete.length, 0);
  const undecidedNote = undecided > 0 ? ` (${undecided} verificações indecisas de contraste; conferir à mão)` : '';
  lines.push('', summary.blocking === 0 ? `Resultado: nenhum problema bloqueante${undecidedNote}.` : `Resultado: ${summary.blocking} combinação(ões) com problemas bloqueantes de ${summary.total}.`);
  return lines.join('\n');
}
