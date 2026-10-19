process.env.TZ = 'Asia/Tokyo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));
const rec = { id: 'r_1', bedAt: '2026-10-19T23:12', wakeAt: '2026-10-20T06:31', createdAt: '2026-10-19T23:12:04+09:00' };
const parse = (o) => Logic.parseImportAll(JSON.stringify(o), Logic.VERSION, Logic.DATA_VERSION);

test('full export is accepted and data is normalized', () => {
  const r = parse({ version: 1, settings: { avgDays: 10 }, data: { version: 1, records: [rec] } });
  assert.equal(r.ok, true);
  assert.equal(r.settings.avgDays, 10);
  assert.equal(r.data.records.length, 1);
});

test('invalid records are dropped and counted on the raw object', () => {
  const raw = { version: 1, records: [rec, { id: 'x', bedAt: 'bad', wakeAt: null }] };
  assert.equal(Logic.invalidCount(raw), 1);
  const r = parse({ version: 1, data: raw });
  assert.equal(r.ok, true);
  assert.equal(r.data.records.length, 1);
  assert.equal(r.settings, undefined);
});

test('settings only, data only', () => {
  assert.equal(parse({ version: 1, settings: {} }).data, undefined);
  assert.equal(parse({ version: 1, data: { version: 1, records: [] } }).ok, true);
});

test('rejects newer versions, bad JSON, unknown shapes', () => {
  assert.equal(parse({ version: 99, settings: {} }).ok, false);
  assert.equal(parse({ version: 1, data: { version: 99, records: [] } }).ok, false);
  assert.equal(Logic.parseImportAll('{', 1, 1).reason, 'invalid_json');
  assert.equal(parse({ version: 1 }).ok, false);
});

test('parseImportAll reports skipped record count', () => {
  const r = parse({ version: 1, data: { version: 1, records: [rec, { id: 'x', bedAt: 'bad', wakeAt: null }, { id: 'y' }] } });
  assert.equal(r.skipped, 2);
  assert.equal(parse({ version: 1, data: { version: 1, records: [rec] } }).skipped, 0);
  assert.equal(parse({ version: 1, settings: {} }).skipped, undefined);
});
