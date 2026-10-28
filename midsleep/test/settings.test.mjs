import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const html = fileURLToPath(new URL('../index.html', import.meta.url));
const Logic = loadLogic(html);
const src = readFileSync(html, 'utf8');
const resolve = (stored = {}, query = {}) => Logic.fixupSettings(Logic.resolveSettings(Logic.SCHEMA, stored, query));

test('schema has exactly the spec keys and all are display-only', () => {
  const expected = ['avgDays', 'chartDays', 'lang', 'minSleepMin', 'staleHours', 'targetBed', 'targetMode', 'targetSleepMin', 'targetWake', 'theme', 'wakeTarget', 'zoom'];
  assert.deepEqual(Object.keys(Logic.SCHEMA).sort(), expected);
  const only = src.match(/DISPLAY_ONLY_KEYS = new Set\(\[([^\]]*)\]\)/)[1];
  for (const k of expected) assert.match(only, new RegExp(`'${k}'`), k);
  assert.equal(only.match(/'/g).length / 2, expected.length);
});

test('defaults', () => {
  const s = resolve();
  assert.equal(s.chartDays, 14);
  assert.equal(s.wakeTarget, '06:00');
  assert.equal(s.avgDays, 7);
  assert.equal(s.minSleepMin, 360);
  assert.equal(s.staleHours, 18);
  assert.equal(s.zoom, 100);
  assert.equal(s.theme, 'auto');
  assert.equal(s.targetMode, '');
  assert.equal(s.targetBed, '23:00');
  assert.equal(s.targetWake, '06:00');
  assert.equal(s.targetSleepMin, 420);
});

test('integers are clamped into range', () => {
  assert.equal(resolve({ avgDays: 99 }).avgDays, 30);
  assert.equal(resolve({ avgDays: 1 }).avgDays, 3);
  assert.equal(resolve({ staleHours: 1 }).staleHours, 10);
  assert.equal(resolve({ staleHours: '99' }).staleHours, 36);
  assert.equal(resolve({ minSleepMin: 10 }).minSleepMin, 180);
  assert.equal(resolve({ minSleepMin: 9999 }).minSleepMin, 720);
  assert.equal(resolve({ avgDays: 'abc' }).avgDays, 7);
});

test('chartDays accepts only 14 or 30', () => {
  assert.equal(resolve({ chartDays: 20 }).chartDays, 14);
  assert.equal(resolve({ chartDays: '30' }).chartDays, 30);
  assert.equal(resolve({}, { chartDays: '30' }).chartDays, 30);
});

test('wakeTarget must be HH:MM', () => {
  assert.equal(resolve({ wakeTarget: 'abc' }).wakeTarget, '06:00');
  assert.equal(resolve({ wakeTarget: '6:00' }).wakeTarget, '06:00');
  assert.equal(resolve({ wakeTarget: '24:00' }).wakeTarget, '06:00');
  assert.equal(resolve({ wakeTarget: '07:30' }).wakeTarget, '07:30');
  assert.equal(resolve({ targetBed: '25:00' }).targetBed, '23:00');
  assert.equal(resolve({ targetWake: 'x' }).targetWake, '06:00');
});

test('URL query beats stored settings', () => {
  assert.equal(resolve({ avgDays: 10 }, { avgDays: '12' }).avgDays, 12);
});

test('normalizeData tolerates non-record input', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(Logic.normalizeData(null))), { version: 1, records: [] });
  assert.deepEqual(JSON.parse(JSON.stringify(Logic.normalizeData({ records: 'x' }))), { version: 1, records: [] });
  assert.equal(Logic.normalizeData({ records: [{}] }).records.length, 0);
  assert.equal(Logic.VERSION, 1);
  assert.equal(Logic.DATA_VERSION, 1);
});

test('parseImportAll accepts settings, data or both; invalid input fails', () => {
  const r = Logic.parseImportAll(JSON.stringify({ version: 1, settings: { avgDays: 10 }, data: { version: 1, records: [] } }), 1, 1);
  assert.equal(r.ok, true);
  assert.equal(r.settings.avgDays, 10);
  assert.equal(r.data.records.length, 0);
  const onlyData = Logic.parseImportAll(JSON.stringify({ version: 1, data: { version: 1, records: [] } }), 1, 1);
  assert.equal(onlyData.ok, true);
  assert.equal(onlyData.settings, undefined);
  assert.equal(Logic.parseImportAll('nope', 1, 1).ok, false);
  assert.equal(Logic.parseImportAll(JSON.stringify({ version: 9, settings: {} }), 1, 1).ok, false);
  assert.equal(Logic.parseImportAll(JSON.stringify({ version: 1 }), 1, 1).ok, false);
  assert.equal(Logic.parseImportAll(JSON.stringify({ version: 1, settings: {}, data: { version: 9 } }), 1, 1).ok, false);
});
