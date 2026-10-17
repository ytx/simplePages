import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const html = fileURLToPath(new URL('../index.html', import.meta.url));
const src = readFileSync(html, 'utf8');
const Logic = loadLogic(html);

test('no external resources and no innerHTML', () => {
  assert.doesNotMatch(src, /<link\s/);
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
  for (const s of ['general', 'display', 'message', 'time', 'data', 'about']) assert.match(src, new RegExp(`data-section="${s}"`), s);
  for (const t of ['clients', 'week', 'month', 'settings']) assert.match(src, new RegExp(`data-tab="${t}"`), t);
  assert.doesNotMatch(src, /<dialog id="settings"/);
  for (const icon of ['icon-person', 'icon-week', 'icon-month', 'icon-back', 'icon-add', 'icon-more', 'icon-copy', 'icon-chevron-left', 'icon-chevron-right', 'icon-check']) assert.match(src, new RegExp(`<symbol id="${icon}"`), icon);
});

test('every data-i18n key and every t() key exists in ja and en', () => {
  const keys = new Set();
  for (const m of src.matchAll(/data-i18n(?:-label|-placeholder)?="([^"]+)"/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\bt\(\s*[^,]+,\s*'([^']+)'/g)) keys.add(m[1]);
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
