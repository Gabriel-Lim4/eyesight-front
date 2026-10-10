// Auditoria de acessibilidade em navegador real, em modo demonstração (sem login e sem backend).
// Uso: npm run a11y   (sai com código 1 se houver problema bloqueante no app ou nas telas de autenticação)
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { runChecks } from './a11y/checks.mjs';
import { APP_SCREENS, AUTH_SCREENS, LANDING_SCREENS, STATES, THEMES, VIEWPORTS } from './a11y/matrix.mjs';
import { blockingResults, formatTable, isExpectedPath } from './a11y/report.mjs';

const { env, exit, execPath, stdout } = process;
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
const PAGE_TIMEOUT = 20000;
const SETTLE_MS = 800;
// Roda o vite direto pelo node (sem o envoltório do npx) para que encerrar o processo encerre o servidor de verdade.
const VITE = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin', 'vite.js');
const REAL_FONTS = env.A11Y_REAL_FONTS === '1';
const SCREENS = [...APP_SCREENS, ...AUTH_SCREENS, ...LANDING_SCREENS];

function build() {
  const run = spawnSync(execPath, [VITE, 'build', '--logLevel', 'error'], { stdio: 'inherit' });
  if (run.status !== 0) throw new Error('vite build falhou');
}

async function startPreview() {
  const server = spawn(execPath, [VITE, 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(BASE)).ok) return server; } catch { /* ainda subindo */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  server.kill();
  throw new Error('o servidor de pré-visualização não subiu');
}

async function openState(page, state) {
  if (state === 'explainer') {
    await page.getByRole('button', { name: /^Explicar: Como estão seus anúncios/ }).click({ timeout: 8000 });
    await page.getByRole('dialog').waitFor({ timeout: 8000 });
  } else if (state === 'goals') {
    await page.locator('summary', { hasText: 'Suas metas' }).click({ timeout: 8000 });
  }
  await page.waitForTimeout(SETTLE_MS / 2);
}

// Uma segunda tentativa evita contar como falha do app um atraso de rede (fontes externas, por exemplo).
async function auditOne(browser, screen, theme, viewport, state) {
  const first = await auditAttempt(browser, screen, theme, viewport, state);
  return first.loadError ? auditAttempt(browser, screen, theme, viewport, state) : first;
}

async function auditAttempt(browser, screen, theme, viewport, state) {
  const base = { screen: screen.id, group: screen.group, theme, viewport: viewport.id, ...(state ? { state } : {}) };
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  await context.addInitScript(({ themeName, demo }) => {
    try {
      localStorage.setItem('eyesight-theme', themeName);
      if (demo) localStorage.setItem('eyesight-demo', '1');
    } catch { /* sem armazenamento */ }
  }, { themeName: theme, demo: screen.group === 'app' });
  // A auditoria não depende da rede externa: as fontes do Google respondem vazias (a página usa as fontes de reserva).
  if (!REAL_FONTS) {
    await context.route(/^https:\/\/fonts\.googleapis\.com\//, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await context.route(/^https:\/\/fonts\.gstatic\.com\//, route => route.abort());
  }
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}${screen.path}`, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
    await page.locator('h1, h2').first().waitFor({ timeout: PAGE_TIMEOUT });
    await page.waitForTimeout(SETTLE_MS);
    if (!isExpectedPath(page.url(), screen.path, screen.expectPath)) {
      throw new Error(`a tela terminou em ${new URL(page.url()).pathname} em vez de ${screen.expectPath}`);
    }
    if (state) await openState(page, state);
    return { ...base, ...(await runChecks(page)) };
  } catch (error) {
    return { ...base, loadError: String(error.message ?? error).split('\n')[0], violations: [], incomplete: [], overflow: false, focusMissing: [], smallTargets: 0 };
  } finally {
    await context.close();
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
