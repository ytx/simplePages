process.env.TZ = 'Asia/Tokyo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));
const R = (id, bedAt, wakeAt) => ({ id, bedAt, wakeAt, createdAt: '' });

test('chart model and summary line', () => {
  const recs = [R('a', '2026-10-18T23:12', '2026-10-19T06:31'), R('n', '2026-10-19T13:05', '2026-10-19T13:50'), R('b', '2026-10-19T20:30', '2026-10-20T10:15'), R('s', '2026-10-20T23:00', null)];
  const m = Logic.chartModel(recs, 14, '2026-10-20', 184, 'ja');
  assert.equal(m.yMin, -240); assert.equal(m.yMax, 660);
  assert.equal(m.cols.length, 14); assert.equal(m.cols[13].date, '2026-10-20'); assert.equal(m.cols[0].label, '10/7'); assert.equal(m.cols[1].label, '');
  assert.equal(m.bars.length, 3); assert.equal(m.bars.find((b) => b.nap).x, 12);
  assert.equal(m.line.length, 2);
  assert.ok(Math.abs(m.bars[0].yBed - (-48 + 240) / 900) < 1e-9);
  assert.equal(m.yTicks[0].label, '20:00'); assert.equal(m.yTicks.length, 8);
  assert.ok(Math.abs(m.target.y - (184 + 240) / 900) < 1e-9);
  const d = Logic.chartModel([recs[0]], 14, '2026-10-20', null, 'ja');
  assert.equal(d.yMin, -180); assert.equal(d.yMax, 540); assert.equal(d.target, null);
  assert.equal(Logic.relMinutes('2026-10-18T23:12', '2026-10-19'), -48);
  assert.equal(Logic.targetRel(1380), -60);
  assert.equal(Logic.summaryLine(recs[0], 'ja'), '23:12 → 6:31 · 中央 2:51 · 7 時間 19 分');
  assert.equal(Logic.summaryLine(recs[1], 'en'), '13:05 → 13:50 · nap 45 min');
});
