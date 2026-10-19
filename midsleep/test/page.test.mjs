import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const html = fileURLToPath(new URL('../index.html', import.meta.url));
const src = readFileSync(html, 'utf8');
const Logic = loadLogic(html);
const ui = src.match(/<script id="app-ui">([\s\S]*?)<\/script>/);

test('no external resources and no innerHTML', () => {
  for (const m of src.matchAll(/<link\s[^>]*>/g)) {
    assert.match(m[0], /rel="(manifest|apple-touch-icon)"/, m[0]);
    assert.match(m[0], /href="(manifest\.webmanifest|icons\/[\w.-]+\.png)"/, m[0]);
  }
  assert.doesNotMatch(src, /<script\s[^>]*src=/);
  assert.doesNotMatch(src, /https?:\/\/(?!github\.com\/ytx\/simplePages)/);
  assert.doesNotMatch(src, /innerHTML/);
  assert.doesNotMatch(src, /@font-face/);
});

test('no emoji and no bold', () => {
  assert.doesNotMatch(src, /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  assert.doesNotMatch(src, /font-weight:\s*(bold|[5-9]00)/);
});

test('script ids, ids and sections the shell needs exist', () => {
  assert.match(src, /<script id="app-logic">/);
  assert.match(src, /<script id="app-ui">/);
  assert.match(src, /^const Logic = /m);
  assert.match(src, /^const App = /m);
  assert.equal((src.match(/^(?:const|let|var|function|class) \w+/gm) || []).filter((l) => !/ (Logic|App)$/.test(l)).length, 0, 'only Logic and App at top level');
  const ids = ['toolbar', 'page-title', 'status-bar', 'tabbar', 'tab-today', 'tab-history', 'tab-settings', 'sheet', 'sheet-title', 'sheet-body', 'sheet-ok', 'sheet-cancel', 'sheet-delete', 'dialog', 'data-text', 'data-copy-text', 'data-import-text', 'data-export', 'data-import', 'data-file', 'data-clear', 'data-message', 'today-body', 'btn-sleep', 'btn-wake', 'history-chart', 'history-list', 'chart-days', 'history-stats', 'history-add'];
  for (const id of ids) assert.match(src, new RegExp(`id="${id}"`), id);
  assert.match(src, /<svg id="history-chart"/);
  for (const s of ['display', 'calc', 'data', 'about']) assert.match(src, new RegExp(`data-section="${s}"`), s);
  const order = ['display', 'calc', 'data', 'about'].map((s) => src.indexOf(`data-section="${s}"`));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'sections in order');
  assert.doesNotMatch(src, /data-section="general"/);
  for (const k of ['lang', 'theme', 'zoom']) assert.doesNotMatch(src, new RegExp(`data-setting="${k}"`), k);
  assert.doesNotMatch(src, /<dialog id="settings"/);
});

test('tab bar has exactly three tabs with the spec icons', () => {
  const tabs = [...src.matchAll(/<button class="tab"[^>]*data-tab="(\w+)"[^>]*><svg[^>]*><use href="#([\w-]+)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(tabs, [['today', 'icon-bedtime'], ['history', 'icon-bar-chart'], ['settings', 'icon-settings']]);
  assert.equal((src.match(/data-tab="/g) || []).length, 3);
  for (const icon of ['icon-bedtime', 'icon-bar-chart', 'icon-chevron-left', 'icon-chevron-right', 'icon-add', 'icon-close', 'icon-settings', 'icon-translate', 'icon-zoom-in', 'icon-zoom-out', 'icon-dark-mode', 'icon-light-mode', 'icon-copy']) {
    assert.match(src, new RegExp(`<symbol id="${icon}"`), icon);
  }
});

test('toolbar has theme, zoom, lang and settings only', () => {
  const bar = src.match(/<header id="toolbar">([\s\S]*?)<\/header>/)[1];
  assert.deepEqual([...bar.matchAll(/id="(btn-[\w-]+)"/g)].map((m) => m[1]), ['btn-theme', 'btn-zoom-out', 'btn-zoom-in', 'btn-lang', 'btn-settings']);
  assert.doesNotMatch(src, /btn-fullscreen|requestFullscreen|btn-help/);
});

test('every data-i18n key and every tr() / t() key exists in ja and en', () => {
  const keys = new Set();
  for (const m of src.matchAll(/data-i18n(?:-label|-placeholder)?="([^"]+)"/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\bt\(\s*[^,]+,\s*'([^']+)'/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\btr\(\s*'([^']+)'/g)) keys.add(m[1]);
  for (const m of src.matchAll(/ABOUT = \{[\s\S]*?credits: \[([^\]]*)\]/g)) for (const k of m[1].matchAll(/'(\w+)'/g)) keys.add(k[1]);
  for (const k of keys) {
    assert.equal(typeof Logic.I18N.ja[k], 'string', `ja ${k}`);
    assert.equal(typeof Logic.I18N.en[k], 'string', `en ${k}`);
  }
  assert.deepEqual(Object.keys(Logic.I18N.ja).sort(), Object.keys(Logic.I18N.en).sort());
});

test('app-ui has no duplicate top-level function declarations', () => {
  assert.ok(ui);
  const names = [...ui[1].matchAll(/^  (?:async )?function (\w+)\(/gm)].map((x) => x[1]);
  assert.ok(names.length > 10);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dup, []);
});

test('storage keys and display-only keys', () => {
  assert.match(ui[1], /STORAGE_KEY = `simplePages\.\$\{PAGE\}`/);
  assert.match(ui[1], /PAGE = 'midsleep'/);
  assert.match(ui[1], /DATA_KEY = `simplePages\.\$\{PAGE\}\.data`/);
  assert.match(src, /<title>midsleep<\/title>/);
  assert.match(ui[1], /ABOUT = \{\s*page: 'midsleep'/);
});

test('settings fields cannot be widened by input intrinsic width (iOS)', () => {
  assert.match(src, /\.field \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(src, /\.field > input, \.field > select \{ width: 100%; min-width: 0;/);
  assert.match(src, /input, select, textarea \{ font-size: max\(16px, var\(--fs-base\)\); \}/);
});

test('data tab has a copy-text button before import-from-text', () => {
  assert.match(src, /id="data-copy-text"[^>]*>[\s\S]{0,200}id="data-import-text"/);
  assert.match(src, /navigator\.clipboard/);
  assert.match(src, /execCommand\('copy'\)/);
});

test('sheet keeps the date-input focus guard', () => {
  assert.match(src, /\['date', 'datetime-local', 'time'\]\.includes\(document\.activeElement\.type\)\) \$\('#sheet-title'\)\.focus\(\)/);
});

test('PWA manifest and icons', () => {
  const dir = new URL('../', import.meta.url);
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('manifest.webmanifest', dir)), 'utf8'));
  assert.equal(manifest.name, 'midsleep');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.theme_color, '#5b6ee1');
  assert.ok(manifest.icons.length >= 2);
  for (const icon of manifest.icons) {
    assert.match(icon.src, /^icons\//);
    assert.ok(existsSync(fileURLToPath(new URL(icon.src, dir))), icon.src);
  }
  assert.ok(existsSync(fileURLToPath(new URL('icons/icon-192.png', dir))));
  assert.ok(existsSync(fileURLToPath(new URL('icons/icon-512.png', dir))));
  assert.ok(existsSync(fileURLToPath(new URL('icons/apple-touch-icon.png', dir))));
  assert.match(src, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(src, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/);
  assert.match(src, /<meta name="theme-color" content="#5b6ee1">/);
  assert.match(src, /apple-mobile-web-app-capable/);
});

test('today tab big buttons', () => {
  for (const id of ['btn-sleep', 'btn-wake']) assert.match(src, new RegExp(`id="${id}" class="[^"]*big-btn`), id);
});
