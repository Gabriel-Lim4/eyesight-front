// Orquestração comum a `theme:snapshot` e `theme:compare`: percorre as telas e grava/lê as capturas.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { STATES, THEMES, VIEWPORTS } from '../a11y/matrix.mjs';
import { SCREENS, build, specKey, startPreview, withScreen } from '../lib/session.mjs';
import { capturePage } from './capture.mjs';

export const BASELINE_DIR = '.theme-baseline';
export const CURRENT_DIR = '.theme-current';

export function parseOnly(argv) {
  const index = argv.findIndex(item => item === '--only' || item.startsWith('--only='));
  if (index < 0) return null;
  const value = argv[index].includes('=') ? argv[index].split('=')[1] : argv[index + 1];
  return value ? value.split(',').map(item => item.trim()).filter(Boolean) : null;
}

const fileFor = key => `${key.replaceAll('|', '__')}.json`;

export function specs(only) {
  const screens = SCREENS.filter(screen => screen.group !== 'landing' && (!only || only.includes(screen.id)));
  const list = [];
  for (const screen of screens) for (const theme of THEMES) for (const viewport of VIEWPORTS) list.push({ screen, theme, viewport });
  for (const state of STATES) {
    const screen = screens.find(item => item.id === state.screen);
    if (!screen) continue;
    for (const theme of THEMES) for (const viewport of VIEWPORTS) list.push({ screen, theme, viewport, state: state.id });
  }
  return list;
}

export async function captureAll({ only, dir }) {
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) if (name.endsWith('.json')) writeFileSync(join(dir, name), '{}');
  build();
  const server = await startPreview();
  const stop = () => { server.kill(); process.exit(130); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  let browser;
  const keys = [];
  try {
    browser = await chromium.launch();
    for (const spec of specs(only)) {
      const key = specKey(spec);
      const captured = await withScreen(browser, spec, capturePage, { freezeMotion: true });
      writeFileSync(join(dir, fileFor(key)), JSON.stringify({ key, elements: captured }));
      keys.push(key);
      process.stdout.write('.');
    }
  } finally {
    await browser?.close();
    server.kill();
  }
  console.log(`\n${keys.length} capturas em ${dir}`);
  return keys;
}

export function loadDir(dir, only) {
  const snapshot = {};
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const { key, elements } = JSON.parse(readFileSync(join(dir, name), 'utf8'));
    if (!key) continue;
    if (only && !only.includes(key.split('|')[0])) continue;
    snapshot[key] = elements;
  }
  return snapshot;
}
