// Verificações feitas dentro do navegador para uma tela já aberta.
import AxeBuilder from '@axe-core/playwright';
import { hasFocusIndicator } from './report.mjs';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const FOCUSABLE = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
const MAX_TAB_STOPS = 60;

async function runAxe(page) {
  const { violations, incomplete } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return {
    violations: violations.map(item => ({ id: item.id, impact: item.impact ?? 'minor', nodes: item.nodes.length, help: item.help, targets: item.nodes.slice(0, 3).map(node => [node.target].flat().join(' ').slice(0, 120)) })),
    incomplete: incomplete.map(item => ({ id: item.id })),
  };
}

const hasOverflow = page => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

// Anota o estilo de cada elemento focável antes do foco para comparar com o estilo focado.
function snapshotFocusables(selector) {
  const read = el => {
    const cs = getComputedStyle(el);
    return { outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor, boxShadow: cs.boxShadow, borderColor: cs.borderTopColor, backgroundColor: cs.backgroundColor, textDecoration: cs.textDecorationLine };
  };
  window.__a11yRead = read;
  window.__a11yBefore = {};
  document.querySelectorAll(selector).forEach((el, index) => {
    el.dataset.a11yId = String(index);
    window.__a11yBefore[index] = read(el);
  });
}

function inspectActive() {
  const el = document.activeElement;
  if (!el || el === document.body || el.dataset.a11yId === undefined) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return { visited: true, hidden: true };
  const name = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '');
  const visited = el.dataset.a11yVisited === '1';
  el.dataset.a11yVisited = '1';
  return { visited, name: name.slice(0, 80), before: window.__a11yBefore[el.dataset.a11yId], after: window.__a11yRead(el) };
}

async function missingFocusIndicators(page) {
  await page.evaluate(snapshotFocusables, FOCUSABLE);
  const missing = [];
  let truncated = true;
  for (let stop = 0; stop < MAX_TAB_STOPS; stop++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(inspectActive);
    if (!info) continue;
    if (info.visited) { truncated = false; break; }
    if (!info.hidden && !hasFocusIndicator(info.before, info.after)) missing.push(info.name);
  }
  return { missing, truncated };
}

// Elementos de toque menores que 44px nos dois eixos (links dentro de parágrafos não contam).
const countSmallTargets = page => page.evaluate(() => {
  const selector = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button]';
  return [...document.querySelectorAll(selector)].filter(el => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    if (el.tagName === 'A' && el.closest('p')) return false;
    return rect.width < 44 && rect.height < 44;
  }).length;
});

export async function runChecks(page) {
  const axe = await runAxe(page);
  const focus = await missingFocusIndicators(page);
  return {
    ...axe,
    overflow: await hasOverflow(page),
    focusMissing: focus.missing,
    focusTruncated: focus.truncated,
    smallTargets: await countSmallTargets(page),
  };
}
