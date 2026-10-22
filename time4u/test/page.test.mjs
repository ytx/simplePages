import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const html = fileURLToPath(new URL('../index.html', import.meta.url));
const src = readFileSync(html, 'utf8');
const Logic = loadLogic(html);

test('no external resources and no innerHTML', () => {
  for (const m of src.matchAll(/<link\s[^>]*>/g)) {
    assert.match(m[0], /rel="(manifest|apple-touch-icon)"/, m[0]);
    assert.match(m[0], /href="(manifest\.webmanifest|icons\/[\w.-]+\.png)"/, m[0]);
  }
  assert.doesNotMatch(src, /<script\s[^>]*src=/);
  assert.doesNotMatch(src, /https?:\/\/(?!github\.com\/ytx\/simplePages|fonts\.google\.com\/specimen|openfontlicense\.org)/);
  assert.doesNotMatch(src, /innerHTML/);
});

test('no emoji and no bold', () => {
  assert.doesNotMatch(src, /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  assert.doesNotMatch(src, /font-weight:\s*(bold|[5-9]00)/);
});

test('font faces reference files that exist', () => {
  const faces = src.match(/@font-face/g) || [];
  assert.equal(faces.length, 122);
  const urls = [...new Set([...src.matchAll(/url\((fonts\/zen-kurenaido\/zk-\d{3}\.woff2)\)/g)].map((m) => m[1]))];
  assert.equal(urls.length, 122);
  for (const u of urls) assert.ok(existsSync(fileURLToPath(new URL('../' + u, import.meta.url))), u);
  assert.ok(existsSync(fileURLToPath(new URL('../fonts/zen-kurenaido/OFL.txt', import.meta.url))));
  assert.match(src, /'Zen Kurenaido', system-ui/);
});

test('tabs, views, dialogs and settings sections exist; no settings modal', () => {
  for (const id of ['tab-clients', 'tab-week', 'tab-month', 'tab-settings', 'view-clients-list', 'view-slots', 'view-message', 'view-respond', 'view-reminder', 'view-week', 'view-day', 'dialog', 'sheet', 'status-bar', 'clock']) {
    assert.match(src, new RegExp(`id="${id}"`), id);
  }
  for (const s of ['display', 'time', 'message', 'data', 'about']) assert.match(src, new RegExp(`data-section="${s}"`), s);
  assert.doesNotMatch(src, /data-section="general"/);
  for (const k of ['lang', 'theme', 'zoom']) assert.doesNotMatch(src, new RegExp(`data-setting="${k}"`), k);
  assert.ok(src.indexOf('data-section="time"') < src.indexOf('data-section="message"'), 'time before message');
  for (const t of ['clients', 'week', 'month', 'settings']) assert.match(src, new RegExp(`data-tab="${t}"`), t);
  assert.doesNotMatch(src, /<dialog id="settings"/);
  for (const icon of ['icon-person', 'icon-week', 'icon-month', 'icon-back', 'icon-add', 'icon-more', 'icon-copy', 'icon-chevron-left', 'icon-chevron-right', 'icon-check']) assert.match(src, new RegExp(`<symbol id="${icon}"`), icon);
});

test('every data-i18n key and every t() key exists in ja and en', () => {
  const keys = new Set();
  for (const m of src.matchAll(/data-i18n(?:-label|-placeholder)?="([^"]+)"/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\bt\(\s*[^,]+,\s*'([^']+)'/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\btr\(\s*'([^']+)'/g)) keys.add(m[1]);
  for (const k of keys) {
    assert.equal(typeof Logic.I18N.ja[k], 'string', `ja ${k}`);
    assert.equal(typeof Logic.I18N.en[k], 'string', `en ${k}`);
  }
  assert.deepEqual(Object.keys(Logic.I18N.ja).sort(), Object.keys(Logic.I18N.en).sort());
});

test('clients tab markup', () => {
  for (const id of ['client-search', 'client-add']) assert.match(src, new RegExp(`id="${id}"`), id);
  for (const s of ['confirmed', 'pending', 'past', 'other']) assert.match(src, new RegExp(`class="client-section" data-section="${s}"`), s);
  assert.match(src, /compositionupdate/);
  assert.match(src, /simplePages\.time4u\.data/);
});

test('proposal flow markup', () => {
  for (const id of ['cond-card', 'cond-summary', 'pick-auto', 'pick-clear', 'slot-list', 'to-message', 'deadline', 'message-text', 'copy-hold', 'respond-slots', 'respond-confirm', 'respond-extend', 'respond-cancel', 'respond-repropose', 'reminder-text', 'reminder-copy']) {
    assert.match(src, new RegExp(`id="${id}"`), id);
  }
  assert.match(src, /navigator\.clipboard/);
  assert.match(src, /execCommand\('copy'\)/);
});

test('calendar markup', () => {
  for (const id of ['week-prev', 'week-title', 'week-next', 'week-copy', 'week-grid', 'day-prev', 'day-title', 'day-next', 'day-close', 'day-lane', 'day-add', 'month-prev', 'month-title', 'month-next', 'month-grid']) {
    assert.match(src, new RegExp(`id="${id}"`), id);
  }
  assert.match(src, /window\.addEventListener\('pointerup'/);
});

test('app-ui has no duplicate top-level function declarations', () => {
  const m = src.match(/<script id="app-ui">([\s\S]*?)<\/script>/);
  assert.ok(m);
  const names = [...m[1].matchAll(/^  (?:async )?function (\w+)\(/gm)].map((x) => x[1]);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dup, []);
});

test('follow-up UI: week bulk add, today buttons, deadline steppers, sticky footer, 相手 wording', () => {
  for (const id of ['week-add', 'deadline-prev', 'deadline-next', 'btn-help', 'help', 'help-close']) assert.match(src, new RegExp(`id="${id}"`), id);
  for (const id of ['week-today', 'month-today']) assert.doesNotMatch(src, new RegExp(`id="${id}"`), id);
  assert.doesNotMatch(src, /btn-fullscreen|requestFullscreen/);
  assert.match(src, /<header id="toolbar">\s*<button id="btn-help"/);
  assert.equal(typeof Logic.I18N.ja.free_count, 'string');
  assert.match(src, /id="week-add" class="icon-btn fab"/);
  assert.match(src, /class="help-body" data-lang="ja"/);
  assert.match(src, /class="help-body" data-lang="en"/);
  assert.match(src, /simplePages\.time4u\.helpSeen/);
  assert.match(src, /TPL_DEFAULT = Logic\.DEFAULT_TEMPLATES\[[^\]]+\]\.friendly/);
  assert.match(src, /class="sticky-foot"/);
  assert.doesNotMatch(src, /#to-message \{[^}]*position: sticky/);
  assert.doesNotMatch(src, /クライアント/);
  for (const k of ['select_all', 'select_none', 'search', 'week_add']) {
    assert.equal(typeof Logic.I18N.ja[k], 'string', k);
    assert.equal(typeof Logic.I18N.en[k], 'string', k);
  }
});

test('settings fields cannot be widened by input intrinsic width (iOS)', () => {
  assert.match(src, /\.field \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(src, /\.field > input, \.field > select \{ width: 100%; min-width: 0;/);
});

test('week day headers stay visible while the grid scrolls', () => {
  assert.match(src, /#week-grid \.dh \{ position: sticky; top: 0;/);
});

test('confirmed section has a copy-all button', () => {
  assert.match(src, /id="confirmed-copy"/);
  assert.equal(typeof Logic.I18N.ja.copy_all_confirmed, 'string');
  assert.equal(typeof Logic.I18N.en.copied_n, 'string');
});

test('data tab has a copy-text button before import-from-text', () => {
  // データタブ: ファイル経由 / クリップボード経由 / 直接編集 の順。各行はラベル + 書き出し + 読み込み。
  const dataPane = src.slice(src.indexOf('data-section="data"'), src.indexOf('data-section="about"'));
  const order = ['data-export', 'data-import', 'data-copy-text', 'data-paste-text', 'data-text', 'data-import-text', 'data-clear'].map((id) => dataPane.indexOf(`id="${id}"`));
  assert.ok(order.every((i) => i >= 0), 'all data buttons exist');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'data buttons in use-case order');
  for (const k of ['data_via_file', 'data_via_clipboard', 'data_edit_text', 'paste_text', 'paste_failed']) assert.ok(k in Logic.I18N.ja && k in Logic.I18N.en, k);
  assert.match(src, /textarea#data-text \{[^}]*font-size: max\(16px, var\(--fs-small\)\)/, 'iOS zoom guard on the data textarea');
  assert.match(src, /\.fab \{[^}]*z-index: 4/, 'fab above day/week items');
  assert.match(src, /#day-scroll \{[^}]*isolation: isolate/);
  assert.match(src, /#view-week #week-grid \{[^}]*isolation: isolate/);
});

test('PWA manifest and icons', () => {
  const dir = new URL('../', import.meta.url);
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('manifest.webmanifest', dir)), 'utf8'));
  assert.equal(manifest.name, 'time4u');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.ok(manifest.icons.length >= 2);
  for (const icon of manifest.icons) {
    assert.match(icon.src, /^icons\//);
    assert.ok(existsSync(fileURLToPath(new URL(icon.src, dir))), icon.src);
  }
  assert.ok(existsSync(fileURLToPath(new URL('icons/apple-touch-icon.png', dir))));
  assert.match(src, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(src, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/);
  assert.match(src, /<meta name="theme-color"/);
  assert.match(src, /apple-mobile-web-app-capable/);
});
