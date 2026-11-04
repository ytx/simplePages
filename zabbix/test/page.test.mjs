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
  assert.doesNotMatch(src, /https?:\/\/(?!github\.com\/ytx\/simplePages|www\.zabbix\.com)/);
  assert.doesNotMatch(src, /innerHTML/);
  assert.doesNotMatch(src, /\bconfirm\(/);
});

test('no emoji and no bold', () => {
  assert.doesNotMatch(src, /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  assert.doesNotMatch(src, /font-weight:\s*(bold|[5-9]00)/);
  assert.doesNotMatch(src, /<(b|strong)[\s>]/);
});

test('app-logic and app-ui scripts parse, only Logic and App at top level', () => {
  assert.ok(logic && ui);
  assert.doesNotThrow(() => new Function(logic[1]));
  assert.doesNotThrow(() => new Function(ui[1]));
  assert.equal((src.match(/^(?:const|let|var|function|class) \w+/gm) || []).filter((l) => !/ (Logic|App)$/.test(l)).length, 0);
});

test('shell ids exist and settings tabs are in order', () => {
  const ids = ['toolbar', 'btn-theme', 'btn-zoom-out', 'btn-zoom-in', 'btn-fullscreen', 'btn-lang', 'btn-settings',
    'content', 'page-title', 'status-bar', 'clock', 'status-message', 'status-dot', 'settings', 'banner', 'pane-hosts', 'pane-problems', 'measure', 'data-text'];
  for (const id of ids) assert.match(src, new RegExp(`id="${id}"`), id);
  const order = ['general', 'display', 'data', 'about'].map((t) => src.indexOf(`data-tab="${t}"`));
  assert.ok(order.every((n) => n >= 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('every data-i18n key and every t() / tr() key exists in ja and en, key sets identical', () => {
  const keys = new Set();
  for (const m of src.matchAll(/data-i18n(?:-label)?="([\w-]+)"/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\b(?:tr|t)\((?:settings\.lang, |lang, )?'([\w-]+)'/g)) keys.add(m[1]);
  for (const k of keys) {
    assert.equal(typeof Logic.I18N.ja[k], 'string', `ja ${k}`);
    assert.equal(typeof Logic.I18N.en[k], 'string', `en ${k}`);
  }
  assert.deepEqual(Object.keys(Logic.I18N.ja).sort(), Object.keys(Logic.I18N.en).sort());
});

test('template refresh-minutes setting is gone; token input is plain text; every data-setting is in SCHEMA', () => {
  assert.doesNotMatch(src, /id="set-refresh"|refreshMinutes/);
  assert.match(src, /<input[^>]*type="text"[^>]*data-setting="token"|<input[^>]*data-setting="token"[^>]*type="text"/);
  const schema = ui[1].match(/const SCHEMA = (\{[\s\S]*?\n  \});/)[1];
  for (const m of src.matchAll(/data-setting="(\w+)"/g)) assert.match(schema, new RegExp(`\\b${m[1]}:`), m[1]);
});

test('zabbix i18n strings carry the placeholders', () => {
  assert.equal(Logic.t('en', 'more', { n: 3, total: 9 }), '+ 3 more (out of 9)');
  assert.equal(Logic.t('ja', 'conn_failed', { reason: 'x' }), 'CONNECTION FAILED — x');
  assert.equal(Logic.t('en', 'tab_general'), 'Connection');
});

test('light theme values are defined for both the attribute and the OS preference', () => {
  assert.match(src, /prefers-color-scheme/);
  assert.match(src, /html\[data-theme="light"\]\s*\{[^}]*--bg:/);
  assert.match(src, /@media \(prefers-color-scheme: light\)\s*\{\s*html:not\(\[data-theme="dark"\]\)\s*\{[^}]*--bg:/);
});

test('summary-right span sits after the status dot', () => {
  assert.match(src, /id="summary-right"/);
  assert.ok(src.indexOf('id="summary-right"') > src.indexOf('id="status-dot"'));
});

test('classes used by the panes are styled in CSS', () => {
  const css = src.match(/<style>([\s\S]*?)<\/style>/)[1];
  for (const c of ['tile', 'problem', 'more', 'sev', 'name', 'sub', 'host', 'desc', 'error', 'stale']) assert.match(css, new RegExp(`\\.${c}\\b`), c);
  for (let i = 0; i <= 5; i++) assert.match(css, new RegExp(`\\.sev${i}\\b`), `sev${i}`);
  for (const c of ['ok', 'disabled']) assert.match(css, new RegExp(`\\.tile\\.${c}\\b`), c);
  assert.match(css, /body\s*\{[^}]*overflow:\s*hidden/);
});

test('the API call uses requestTimeoutSec, POST JSON and never an Authorization header', () => {
  assert.match(ui[1], /AbortSignal\.timeout\(\s*settings\.requestTimeoutSec\s*\*\s*1000\s*\)/);
  assert.match(ui[1], /method:\s*'POST'/);
  assert.match(ui[1], /\/api_jsonrpc\.php/);
  assert.doesNotMatch(src, /Authorization/i);
});

test('request options and wire details', () => {
  assert.match(ui[1], /monitored: true/);
  assert.match(ui[1], /sortorder: 'DESC'/);
  assert.match(ui[1], /cache: 'no-store'/);
  const css = src.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.match(css, /\.tile\s*\{[^}]*color:\s*#000/);
  assert.ok('mixed_content' in Logic.I18N.ja && 'mixed_content' in Logic.I18N.en);
  assert.ok(!('credit_zabbix' in Logic.I18N.ja));
});
