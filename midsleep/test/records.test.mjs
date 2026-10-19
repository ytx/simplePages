process.env.TZ = 'Asia/Tokyo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));
const R = (id, bedAt, wakeAt) => ({ id, bedAt, wakeAt, createdAt: '' });

const recs = [R('a', '2026-10-18T23:40', '2026-10-19T06:20'), R('b', '2026-10-19T13:05', '2026-10-19T13:50'), R('s', '2026-10-19T23:12', null)];

test('nap, wakeDate, sleepingRecord, validate', () => {
  assert.equal(Logic.isNap(recs[1]), true); assert.equal(Logic.isNap(recs[0]), false); assert.equal(Logic.isNap(recs[2]), false);
  assert.equal(Logic.wakeDate(recs[0]), '2026-10-19');
  assert.equal(Logic.sleepingRecord(recs).id, 's');
  assert.equal(Logic.completed(recs).length, 2);
  assert.deepEqual(Logic.validateRecord(R('x', '2026-10-20T06:00', '2026-10-20T06:00'), recs), { ok: false, error: 'order' });
  assert.deepEqual(Logic.validateRecord(R('x', '2026-10-17T06:00', '2026-10-18T06:01'), recs), { ok: false, error: 'too_long' });
  assert.deepEqual(Logic.validateRecord(R('x', '2026-10-19T05:00', '2026-10-19T07:00'), recs), { ok: false, error: 'overlap' });
  assert.deepEqual(Logic.validateRecord(R('x', '2026-10-19T22:00', '2026-10-20T06:00'), recs), { ok: false, error: 'overlap' });
  assert.deepEqual(Logic.validateRecord(R('a', '2026-10-18T23:30', '2026-10-19T06:20'), recs), { ok: true });
  assert.deepEqual(Logic.validateRecord(R('x', '2026-10-19T06:20', '2026-10-19T07:00'), recs), { ok: true });
});

test('normalizeData and invalidCount', () => {
  const raw = { version: 1, records: [R('s1', '2026-10-10T23:00', null), R('bad', '2026-10-10', '2026-10-11T06:00'), R('s2', '2026-10-11T23:00', null), R('z', '2026-10-09T23:00', '2026-10-10T06:00'), { id: 'o', bedAt: '2026-10-12T08:00', wakeAt: '2026-10-12T07:00' }] };
  const n = Logic.normalizeData(raw);
  assert.deepEqual(n.records.map((r) => r.id), ['z', 's2']);
  assert.equal(Logic.invalidCount(raw), 3); // brief said 2; s1, bad, o are dropped
  assert.deepEqual(Logic.normalizeData(null), { version: 1, records: [] });
  assert.deepEqual(Logic.normalizeData({ records: 'x' }), { version: 1, records: [] });
  assert.deepEqual(Logic.normalizeData({ records: [null, 5, 'x', R('m', '2026-13-01T00:00', null)] }).records, []);
  assert.equal(Logic.invalidCount(null), 0);
});

test('stale and newId', () => {
  assert.equal(Logic.isStale(recs[2], new Date(2026, 9, 20, 17, 12), 18), true);
  assert.equal(Logic.isStale(recs[2], new Date(2026, 9, 20, 17, 11), 18), false);
  assert.equal(Logic.isStale(recs[0], new Date(2026, 9, 20, 17, 12), 18), false);
  assert.equal(Logic.newId(new Date(1000)), 'r_1000');
});

test('normalizeData keeps the first record per id and counts the rest as invalid', () => {
  const raw = { version: 1, records: [R('a', '2026-10-10T23:00', '2026-10-11T06:00'), R('a', '2026-10-12T23:00', '2026-10-13T06:00'), R('b', '2026-10-14T23:00', '2026-10-15T06:00')] };
  const n = Logic.normalizeData(raw);
  assert.deepEqual(n.records.map((r) => [r.id, r.bedAt]), [['a', '2026-10-10T23:00'], ['b', '2026-10-14T23:00']]);
  assert.equal(Logic.invalidCount(raw), 1);
});
