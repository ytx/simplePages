import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const html = fileURLToPath(new URL('../index.html', import.meta.url));
const src = readFileSync(html, 'utf8');
const Logic = loadLogic(html);
const logic = src.match(/<script id="app-logic">([\s\S]*?)<\/script>/);
const ui = src.match(/<script id="app-ui">([\s\S]*?)<\/script>/);

test('no external resources and no innerHTML with external data', () => {
  assert.doesNotMatch(src, /<link\s/);
  assert.doesNotMatch(src, /<script\s[^>]*src=/);
});

test('app-logic and app-ui scripts parse', () => {
  assert.ok(logic && ui);
  assert.doesNotThrow(() => new Function(logic[1]));
  assert.doesNotThrow(() => new Function(ui[1]));
});

test('Courier Prime is bundled and used for the timer digits', () => {
  const faces = src.match(/@font-face/g) || [];
  assert.equal(faces.length, 123);
  const zmg = [...new Set([...src.matchAll(/url\((fonts\/zen-maru-gothic\/zmg-400-\d{3}\.woff2)\)/g)].map((m) => m[1]))];
  assert.equal(zmg.length, 122);
  for (const u of zmg) assert.ok(existsSync(fileURLToPath(new URL('../' + u, import.meta.url))), u);
  assert.ok(existsSync(fileURLToPath(new URL('../fonts/zen-maru-gothic/OFL.txt', import.meta.url))));
  assert.match(src, /--font: 'Zen Maru Gothic', system-ui/);
  assert.match(src, /name: 'Zen Maru Gothic', url: 'https:\/\/github\.com\/googlefonts\/zen-marugothic'/);
  assert.match(src, /font-family: 'Courier Prime';/);
  assert.match(src, /url\(fonts\/courier-prime\/CourierPrime-Regular-latin\.woff2\) format\('woff2'\)/);
  assert.ok(existsSync(fileURLToPath(new URL('../fonts/courier-prime/CourierPrime-Regular-latin.woff2', import.meta.url))));
  assert.ok(existsSync(fileURLToPath(new URL('../fonts/courier-prime/OFL.txt', import.meta.url))));
  assert.match(src, /--font-num: 'Courier Prime', ui-monospace/);
  for (const sel of ['#main-remaining', '.end-row', '.ex-time', '.ex-next-time', '#ed-zoom-level']) {
    const rule = src.match(new RegExp(`^${sel.replace('.', '\\.')} \\{[^}]*\\}`, 'm'));
    assert.ok(rule, sel);
    assert.match(rule[0], /font-family: var\(--font-num\)/, sel);
    assert.doesNotMatch(rule[0], /font-weight: 700/, sel);
  }
  assert.match(src, /name: 'Courier Prime', url: 'https:\/\/github\.com\/quoteunquoteapps\/CourierPrime'/);
});

test('every data-i18n key and every t() key exists in ja and en', () => {
  const keys = new Set();
  for (const m of src.matchAll(/data-i18n(?:-label|-placeholder)?="([\w-]+)"/g)) keys.add(m[1]);
  for (const k of keys) {
    assert.equal(typeof Logic.I18N.ja[k], 'string', `ja ${k}`);
    assert.equal(typeof Logic.I18N.en[k], 'string', `en ${k}`);
  }
  assert.deepEqual(Object.keys(Logic.I18N.ja).sort(), Object.keys(Logic.I18N.en).sort());
});
