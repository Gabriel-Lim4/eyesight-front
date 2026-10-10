// Captura das cores calculadas de uma tela aberta: todos os elementos visíveis, pseudo-elementos e, para os elementos
// interativos, os estados forçados :hover, :focus-visible e :active (pelo protocolo do Chromium).
const INTERACTIVE = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
export const MAX_INTERACTIVE = 60;
export const FORCED_STATES = ['hover', 'focus-visible', 'active'];

function readAll() {
  const PROPS = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'boxShadow', 'fill', 'stroke', 'textDecorationColor', 'opacity'];
  const read = cs => Object.fromEntries(PROPS.map(prop => [prop, cs[prop]]));
  const pathOf = el => {
    const parts = [];
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      const index = Array.prototype.indexOf.call(node.parentElement.children, node) + 1;
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`);
    }
    return parts.join('>');
  };
  const visible = el => {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && (rect.width > 0 || rect.height > 0);
  };
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'TITLE']);
  const out = {};
  for (const el of document.body.querySelectorAll('*')) {
    if (skip.has(el.tagName) || !visible(el)) continue;
    const path = pathOf(el);
    out[path] = read(getComputedStyle(el));
    for (const pseudo of ['::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (cs.content !== 'none' && cs.content !== 'normal') out[path + pseudo] = read(cs);
    }
  }
  window.__themeRead = read;
  window.__themePathOf = pathOf;
  return out;
}

function tagInteractive({ selector, max }) {
  const items = [...document.body.querySelectorAll(selector)].filter(el => {
    const rect = el.getBoundingClientRect();
    return getComputedStyle(el).display !== 'none' && rect.width > 0 && rect.height > 0;
  }).slice(0, max);
  items.forEach((el, index) => el.setAttribute('data-theme-idx', String(index)));
  return items.map(el => window.__themePathOf(el));
}

const readTagged = index => window.__themeRead(getComputedStyle(document.querySelector(`[data-theme-idx="${index}"]`)));

export async function capturePage(page) {
  const out = await page.evaluate(readAll);
  const paths = await page.evaluate(tagInteractive, { selector: INTERACTIVE, max: MAX_INTERACTIVE });
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('DOM.enable');
    await client.send('CSS.enable');
    const { root } = await client.send('DOM.getDocument', { depth: 0 });
    for (let index = 0; index < paths.length; index++) {
      const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-theme-idx="${index}"]` });
      if (!nodeId) continue;
      for (const state of FORCED_STATES) {
        await client.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [state] });
        out[`${paths[index]}@${state}`] = await page.evaluate(readTagged, index);
      }
      await client.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    }
  } finally {
    await client.detach();
  }
  return out;
}
