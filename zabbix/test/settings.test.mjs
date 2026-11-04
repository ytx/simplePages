// zabbix/test/settings.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { loadLogic } from './load-logic.mjs';

const htmlPath = fileURLToPath(new URL('../index.html', import.meta.url));
const Logic = loadLogic(htmlPath);
const src = readFileSync(htmlPath, 'utf8');
const ui = src.match(/<script id="app-ui">([\s\S]*?)<\/script>/)[1];

// app-ui の SCHEMA リテラルだけを取り出して評価する(Logic.detectLang は本物を渡す)。
function loadSchema() {
  const m = ui.match(/const SCHEMA = (\{[\s\S]*?\n  \});/);
  assert.ok(m, 'SCHEMA literal');
  return vm.runInNewContext(`(${m[1]})`, { Logic, navigator: { language: 'ja' } });
}

test('SCHEMA key set', () => {
  assert.deepEqual(Object.keys(loadSchema()).sort(), ['hostGroups', 'hosts', 'lang', 'problemMaxRows', 'refreshSec',
    'requestTimeoutSec', 'severityMin', 'staleSec', 'theme', 'tileMinChars', 'tileMinFont', 'token', 'zabbixUrl', 'zoom']);
});

test('SCHEMA defaults', () => {
  const s = Logic.resolveSettings(loadSchema(), {}, {});
  assert.deepEqual(
    { ...s, lang: undefined },
    { zabbixUrl: '', token: '', hostGroups: '', hosts: '', severityMin: 2, refreshSec: 60, requestTimeoutSec: 10,
      staleSec: 150, problemMaxRows: 20, tileMinChars: 10, tileMinFont: 16, theme: 'auto', zoom: 100, lang: undefined });
});

test('int settings clamp to their range', () => {
  const schema = loadSchema();
  const s = Logic.resolveSettings(schema, {}, { severityMin: '9', refreshSec: '1', requestTimeoutSec: '999', staleSec: '0', tileMinFont: '5' });
  assert.equal(s.severityMin, 5);
  assert.equal(s.refreshSec, 15);
  assert.equal(s.requestTimeoutSec, 60);
  assert.equal(s.staleSec, 30);
  assert.equal(s.tileMinFont, 10);
  assert.equal(Logic.resolveSettings(schema, {}, { refreshSec: 'abc' }).refreshSec, 60);
});

test('DISPLAY_ONLY_KEYS is exactly the display settings', () => {
  const m = ui.match(/DISPLAY_ONLY_KEYS = new Set\(\[([^\]]*)\]\)/);
  assert.ok(m);
  const keys = [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(keys, ['lang', 'problemMaxRows', 'staleSec', 'theme', 'tileMinChars', 'tileMinFont', 'zoom']);
});
