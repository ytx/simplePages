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

test('todayChart: columns, bars, points, segments, ticks', () => {
  const recs = [
    R('a', '2026-11-01T23:00', '2026-11-02T06:30'),   // x0: bedRel -240, wakeRel 210, mid 2:45 → -15
    R('b', '2026-11-03T00:30', '2026-11-03T07:00'),   // x1: -150, 240, mid 3:45 → +45
    R('nap', '2026-11-04T14:00', '2026-11-04T15:00'), // nap, excluded
    R('c', '2026-11-05T22:00', '2026-11-06T05:00'),   // x4: -300, 120, mid 1:30 → -90
    R('open', '2026-11-07T23:00', null),               // open, excluded
  ];
  const m = Logic.todayChart(recs, '2026-11-08', 180);
  assert.equal(m.half, 300);
  assert.deepEqual(m.cols.map((c) => [c.x, c.date, c.label]), [[0, '2026-11-02', '2'], [1, '2026-11-03', '3'], [2, '2026-11-04', '4'], [3, '2026-11-05', '5'], [4, '2026-11-06', '6'], [5, '2026-11-07', '7'], [6, '2026-11-08', '8']]);
  assert.deepEqual(m.bars, [{ x: 0, yBed: 0.1, yWake: 0.85 }, { x: 1, yBed: 0.25, yWake: 0.9 }, { x: 4, yBed: 0, yWake: 0.7 }]);
  assert.deepEqual(m.points, [{ x: 0, y: 0.475 }, { x: 1, y: 0.575 }, { x: 4, y: 0.35 }]);
  assert.deepEqual(m.segments, [[0, 1]]);
  assert.deepEqual(m.ticks.map((t) => [t.rel, t.y, t.label]), [[-300, 0, ''], [-240, 0.1, '-4h'], [-180, 0.2, ''], [-120, 0.3, '-2h'], [-60, 0.4, ''], [60, 0.6, ''], [120, 0.7, '+2h'], [180, 0.8, ''], [240, 0.9, '+4h'], [300, 1, '']]);
});
test('todayChart: empty, no target, late bed, custom days', () => {
  const e = Logic.todayChart([], '2026-11-08', 180);
  assert.equal(e.half, 240); assert.deepEqual(e.bars, []); assert.deepEqual(e.points, []); assert.deepEqual(e.segments, []);
  assert.deepEqual(e.ticks.map((t) => [t.rel, t.label]), [[-240, '-4h'], [-180, ''], [-120, '-2h'], [-60, ''], [60, ''], [120, '+2h'], [180, ''], [240, '+4h']]);
  assert.equal(Logic.todayChart([], '2026-11-08', null), null);
  const late = Logic.todayChart([R('l', '2026-11-08T04:00', '2026-11-08T10:00')], '2026-11-08', 180); // bedRel +60, wakeRel 420, mid 7:00 → +240
  assert.equal(late.half, 420);
  assert.deepEqual(late.bars, [{ x: 6, yBed: 0.571429, yWake: 1 }]);
  assert.deepEqual(late.points, [{ x: 6, y: 0.785714 }]);
  assert.equal(Logic.todayChart([], '2026-11-08', 180, 3).cols.length, 3);
});
