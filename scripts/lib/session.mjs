// Peças comuns às ferramentas que abrem o app num navegador real (auditoria de acessibilidade e comparação de tema):
// construir, servir, abrir uma tela com tema e largura, nos mesmos termos em todas.
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { APP_SCREENS, AUTH_SCREENS, LANDING_SCREENS } from '../a11y/matrix.mjs';
import { isExpectedPath } from '../a11y/report.mjs';

const { env, execPath } = process;
export const PORT = 4173;
export const BASE = `http://localhost:${PORT}`;
export const PAGE_TIMEOUT = 20000;
export const SETTLE_MS = 800;
export const SCREENS = [...APP_SCREENS, ...AUTH_SCREENS, ...LANDING_SCREENS];
export const REAL_FONTS = env.A11Y_REAL_FONTS === '1';
// Roda o vite direto pelo node (sem o envoltório do npx) para que encerrar o processo encerre o servidor de verdade.
const VITE = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin', 'vite.js');
const FREEZE_MOTION = '*, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }';

export function build() {
  const run = spawnSync(execPath, [VITE, 'build', '--logLevel', 'error'], { stdio: 'inherit' });
  if (run.status !== 0) throw new Error('vite build falhou');
}

export async function startPreview() {
  const server = spawn(execPath, [VITE, 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  let exited = false;
  server.once('exit', () => { exited = true; });
  for (let attempt = 0; attempt < 60; attempt++) {
    // Se o processo que subimos morreu (porta ocupada, por exemplo), quem responde na porta é OUTRO servidor, possivelmente
    // com outro código: nunca aceitar isso em silêncio.
    if (exited) throw new Error(`a pré-visualização encerrou ao subir (a porta ${PORT} está ocupada por outro processo?)`);
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

async function attempt(browser, { screen, theme, viewport, state }, freezeMotion, run) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  try {
    await context.addInitScript(({ themeName, demo }) => {
      try {
        localStorage.setItem('eyesight-theme', themeName);
        if (demo) localStorage.setItem('eyesight-demo', '1');
      } catch { /* sem armazenamento */ }
    }, { themeName: theme, demo: screen.group === 'app' });
    // Sem depender da rede externa: as fontes do Google respondem vazias (a página usa as fontes de reserva).
    if (!REAL_FONTS) {
      await context.route(/^https:\/\/fonts\.googleapis\.com\//, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await context.route(/^https:\/\/fonts\.gstatic\.com\//, route => route.abort());
    }
    const page = await context.newPage();
    await page.goto(`${BASE}${screen.path}`, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
    await page.locator('h1, h2').first().waitFor({ timeout: PAGE_TIMEOUT });
    if (freezeMotion) await page.addStyleTag({ content: FREEZE_MOTION });
    // A classe do tema só é aplicada por componentes de certas telas (barra lateral, perfil, landing); as outras (login…)
    // a herdam ao navegar a partir delas. Aplicar aqui para todas garante que o tema claro seja realmente exercitado.
    await page.evaluate(themeName => document.body.classList.toggle('light-mode', themeName === 'light'), theme);
    await page.waitForTimeout(SETTLE_MS);
    if (!isExpectedPath(page.url(), screen.path, screen.expectPath)) {
      throw new Error(`a tela terminou em ${new URL(page.url()).pathname} em vez de ${screen.expectPath}`);
    }
    if (state) await openState(page, state);
    return await run(page);
  } finally {
    await context.close();
  }
}

/**
 * Abre a tela no tema e na largura pedidos e chama `run(page)`. Uma segunda tentativa evita contar como falha do app
 * um atraso de rede. `freezeMotion` desliga animações e transições (para capturas de cor).
 */
export async function withScreen(browser, spec, run, { freezeMotion = false } = {}) {
  try {
    return await attempt(browser, spec, freezeMotion, run);
  } catch {
    return attempt(browser, spec, freezeMotion, run);
  }
}

export const specKey = ({ screen, theme, viewport, state }) => [screen.id, theme, viewport.id, state ?? '-'].join('|');
