process.env.TZ = 'Asia/Tokyo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));
const R = (id, bedAt, wakeAt) => ({ id, bedAt, wakeAt, createdAt: '' });

const recs = [R('f', '2026-10-12T23:00', '2026-10-13T07:00'), R('a', '2026-10-15T23:30', '2026-10-16T06:30'), R('b', '2026-10-16T13:00', '2026-10-16T13:45'), R('c', '2026-10-16T23:30', '2026-10-17T06:30'), R('d', '2026-10-17T23:40', '2026-10-18T06:40'), R('e', '2026-10-18T23:20', '2026-10-19T06:20'), R('s', '2026-10-19T23:12', null)];

test('stats over window', () => {
  assert.deepEqual(Logic.stats(recs, 7, '2026-10-20'), { count: 4, targetMin: 180, sdMin: 7, avgSleepMin: 420 });
  assert.equal(Logic.stats(recs, 14, '2026-10-20').count, 5);
  assert.equal(Logic.stats(recs.slice(0, 2), 7, '2026-10-20').targetMin, null);
  assert.equal(Logic.inWindow(recs[0], 7, '2026-10-20'), false);
  assert.equal(Logic.inWindow(recs[1], 7, '2026-10-20'), true);
  assert.equal(Logic.inWindow(recs[6], 7, '2026-10-20'), false);
});
