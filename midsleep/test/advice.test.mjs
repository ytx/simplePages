process.env.TZ = 'Asia/Tokyo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));

test('wakeFor, bedFor, nextOccurrence, flags', () => {
  const S = { minSleepMin: 360 };
  let r = Logic.wakeFor(new Date(2026, 9, 19, 23, 12), 184);
  assert.equal(Logic.formatLocal(r.wakeAt), '2026-10-20T06:56'); assert.equal(r.sleepMin, 464);
  r = Logic.wakeFor(new Date(2026, 9, 19, 14, 0), 184);
  assert.equal(Logic.formatLocal(r.wakeAt), '2026-10-20T16:08'); assert.equal(r.sleepMin, 1568); assert.equal(Logic.adviceFlags(r.sleepMin, S), 'long');
  r = Logic.wakeFor(new Date(2026, 9, 20, 3, 4), 184);
  assert.equal(Logic.formatLocal(r.wakeAt), '2026-10-22T03:04');
  r = Logic.bedFor(new Date(2026, 9, 20, 6, 0), 184);
  assert.equal(Logic.formatLocal(r.bedAt), '2026-10-20T00:08'); assert.equal(r.sleepMin, 352); assert.equal(Logic.adviceFlags(r.sleepMin, S), 'short');
  r = Logic.bedFor(new Date(2026, 9, 20, 7, 0), 184);
  assert.equal(Logic.formatLocal(r.bedAt), '2026-10-19T23:08'); assert.equal(Logic.adviceFlags(r.sleepMin, S), null);
  assert.equal(Logic.formatLocal(Logic.nextOccurrence(new Date(2026, 9, 20, 6, 0), '06:00')), '2026-10-21T06:00');
  assert.equal(Logic.formatLocal(Logic.nextOccurrence(new Date(2026, 9, 20, 5, 59), '06:00')), '2026-10-20T06:00');
});
