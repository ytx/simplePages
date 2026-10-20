import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const html = fileURLToPath(new URL('../index.html', import.meta.url));
const src = readFileSync(html, 'utf8');
const Logic = loadLogic(html);
const logic = src.match(/<script id="app-logic">([\s\S]*?)<\/script>/);
const ui = src.match(/<script id="app-ui">([\s\S]*?)<\/script>/);

test('no external resources, no innerHTML, no window.confirm', () => {
  assert.doesNotMatch(src, /<link\s/);
  assert.doesNotMatch(src, /<script\s[^>]*src=/);
  assert.doesNotMatch(src, /https?:\/\/(?!github\.com\/ytx\/simplePages)/);
  assert.doesNotMatch(src, /innerHTML/);
  assert.doesNotMatch(src, /\bconfirm\(/);
});

test('no emoji and no bold', () => {
  assert.doesNotMatch(src, /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  assert.doesNotMatch(src, /font-weight:\s*(bold|[5-9]00)/);
  assert.doesNotMatch(src, /<(b|strong)[\s>]/);
});

test('app-logic and app-ui scripts parse', () => {
  assert.ok(logic && ui);
  assert.doesNotThrow(() => new Function(logic[1]));
  assert.doesNotThrow(() => new Function(ui[1]));
  assert.equal((src.match(/^(?:const|let|var|function|class) \w+/gm) || []).filter((l) => !/ (Logic|App)$/.test(l)).length, 0, 'only Logic and App at top level');
});

test('shell ids exist', () => {
  const ids = ['toolbar', 'btn-theme', 'btn-zoom-out', 'btn-zoom-in', 'btn-fullscreen', 'btn-lang', 'btn-settings',
    'content', 'page-title', 'status-bar', 'clock', 'status-message', 'status-dot',
    'settings', 'settings-close', 'btn-export', 'btn-import', 'import-file', 'btn-clear', 'data-text', 'btn-copy-text', 'btn-import-text', 'data-message',
    'dialog', 'dialog-message', 'dialog-ok', 'dialog-cancel'];
  for (const id of ids) assert.match(src, new RegExp(`id="${id}"`), id);
  const order = ['general', 'display', 'data', 'about'].map((t) => src.indexOf(`data-tab="${t}"`));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'settings tabs in order');
  assert.ok(src.indexOf('id="btn-copy-text"') < src.indexOf('id="btn-import-text"'), 'copy button left of import-from-text');
});

test('every data-i18n key and every t() / tr() key exists in ja and en', () => {
  const keys = new Set();
  for (const m of src.matchAll(/data-i18n(?:-label)?="([\w-]+)"/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\b(?:tr|t)\((?:settings\.lang, |lang, )?'([\w-]+)'/g)) keys.add(m[1]);
  for (const k of keys) {
    assert.equal(typeof Logic.I18N.ja[k], 'string', `ja ${k}`);
    assert.equal(typeof Logic.I18N.en[k], 'string', `en ${k}`);
  }
  assert.deepEqual(Object.keys(Logic.I18N.ja).sort(), Object.keys(Logic.I18N.en).sort());
});
