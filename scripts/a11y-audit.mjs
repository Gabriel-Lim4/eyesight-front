// Auditoria de acessibilidade em navegador real, em modo demonstração (sem login e sem backend).
// Uso: npm run a11y   (sai com código 1 se houver problema bloqueante no app ou nas telas de autenticação)
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright';
import { runChecks } from './a11y/checks.mjs';
import { STATES, THEMES, VIEWPORTS } from './a11y/matrix.mjs';
import { blockingResults, formatTable } from './a11y/report.mjs';
import { REAL_FONTS, SCREENS, build, startPreview, withScreen } from './lib/session.mjs';

const { exit, stdout } = process;

async function auditOne(browser, screen, theme, viewport, state) {
  const base = { screen: screen.id, group: screen.group, theme, viewport: viewport.id, ...(state ? { state } : {}) };
  try {
    return { ...base, ...(await withScreen(browser, { screen, theme, viewport, state }, page => runChecks(page))) };
  } catch (error) {
    return { ...base, loadError: String(error.message ?? error).split('\n')[0], violations: [], incomplete: [], overflow: false, focusMissing: [], smallTargets: 0 };
  }
}

async function main() {
  console.log(REAL_FONTS ? 'Fontes: reais do Google Fonts (A11Y_REAL_FONTS=1).' : 'Fontes: de reserva (Google Fonts simulado vazio); estouro e alvos são medidos sem as fontes reais. Use A11Y_REAL_FONTS=1 para medir com elas.');
  build();
  const server = await startPreview();
  const stop = () => { server.kill(); exit(130); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const results = [];
  let browser;
  try {
    browser = await chromium.launch();
    for (const screen of SCREENS) {
      for (const theme of THEMES) {
        for (const viewport of VIEWPORTS) {
          results.push(await auditOne(browser, screen, theme, viewport));
          stdout.write('.');
        }
      }
    }
    for (const state of STATES) {
      const screen = SCREENS.find(item => item.id === state.screen);
      for (const theme of THEMES) {
        for (const viewport of VIEWPORTS) {
          results.push(await auditOne(browser, screen, theme, viewport, state.id));
          stdout.write('.');
        }
      }
    }
  } finally {
    await browser?.close();
    server.kill();
  }
  console.log('\n');
  console.log(formatTable(results));
  writeFileSync('a11y-report.json', JSON.stringify(results, null, 2));
  exit(blockingResults(results).length > 0 ? 1 : 0);
}

main().catch(error => { console.error(error); exit(2); });
