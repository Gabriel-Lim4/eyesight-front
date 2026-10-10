// Comparação de duas capturas de cores calculadas. Chave de captura: `tela|tema|largura|estado`.
const MAX_SAMPLES = 10;

export function diffSnapshots(before, after) {
  const byKey = {};
  let total = 0;
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const left = before[key] ?? {};
    const right = after[key] ?? {};
    const entry = { changed: 0, onlyBefore: 0, onlyAfter: 0, samples: [] };
    for (const path of new Set([...Object.keys(left), ...Object.keys(right)])) {
      if (!(path in right)) { entry.onlyBefore++; continue; }
      if (!(path in left)) { entry.onlyAfter++; continue; }
      let differs = false;
      for (const prop of new Set([...Object.keys(left[path]), ...Object.keys(right[path])])) {
        if (left[path][prop] === right[path][prop]) continue;
        differs = true;
        if (entry.samples.length < MAX_SAMPLES) entry.samples.push({ path, prop, before: left[path][prop], after: right[path][prop] });
      }
      if (differs) entry.changed++;
    }
    const count = entry.changed + entry.onlyBefore + entry.onlyAfter;
    if (count > 0) { byKey[key] = entry; total += count; }
  }
  return { total, byKey };
}

/**
 * Chaves `tela|largura|estado` cuja captura no tema claro é igual à do escuro: sinal de que o tema claro não foi aplicado
 * (uma prova de neutralidade feita assim não vale para o claro). `invariant` lista telas que são iguais nos dois temas de propósito.
 */
export function themesWithoutEffect(snapshot, invariant = []) {
  const groups = new Map();
  for (const key of Object.keys(snapshot)) {
    const [screen, theme, viewport, state] = key.split('|');
    const group = `${screen}|${viewport}|${state}`;
    groups.set(group, { ...groups.get(group), [theme]: key });
  }
  const same = [];
  for (const [group, themes] of groups) {
    if (!themes.dark || !themes.light || invariant.includes(group.split('|')[0])) continue;
    if (diffSnapshots({ k: snapshot[themes.dark] }, { k: snapshot[themes.light] }).total === 0) same.push(group);
  }
  return same;
}
