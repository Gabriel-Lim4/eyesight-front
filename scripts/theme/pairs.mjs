// Cruza a captura do tema escuro com a do claro: cada par (valor no escuro → valor no claro) por classe de propriedade.
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const CLASSES = {
  text: ['color'],
  background: ['backgroundColor', 'backgroundImage'],
  border: ['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'],
  shadow: ['boxShadow'],
  svg: ['fill', 'stroke'],
};
const EMPTY = new Set([TRANSPARENT, 'none']);
const EXAMPLES = 3;

export function buildPairs(snapshot) {
  const groups = new Map();
  for (const [key, elements] of Object.entries(snapshot)) {
    const [screen, theme, viewport, state] = key.split('|');
    const group = `${screen}|${viewport}|${state}`;
    groups.set(group, { ...groups.get(group), [theme]: elements });
  }
  const result = Object.fromEntries(Object.keys(CLASSES).map(name => [name, new Map()]));
  for (const [group, themes] of groups) {
    if (!themes.dark || !themes.light) continue;
    for (const [path, dark] of Object.entries(themes.dark)) {
      const light = themes.light[path];
      if (!light) continue;
      for (const [name, props] of Object.entries(CLASSES)) {
        for (const prop of props) {
          if (dark[prop] === undefined || light[prop] === undefined) continue;
          if (EMPTY.has(dark[prop]) && EMPTY.has(light[prop])) continue;
          const id = `${dark[prop]}\u0000${light[prop]}`;
          const entry = result[name].get(id) ?? { dark: dark[prop], light: light[prop], count: 0, examples: [] };
          entry.count++;
          if (entry.examples.length < EXAMPLES) entry.examples.push(`${group.split('|')[0]} ${path}`);
          result[name].set(id, entry);
        }
      }
    }
  }
  return Object.fromEntries(Object.entries(result).map(([name, map]) => [name, [...map.values()].sort((a, b) => b.count - a.count)]));
}
