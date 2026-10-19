process.env.TZ = 'Asia/Tokyo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));

test('local time and mid-sleep', () => {
  assert.equal(Logic.formatLocal(Logic.parseLocal('2026-10-19T23:12')), '2026-10-19T23:12');
  assert.equal(Logic.minutesOfDay('2026-10-19T23:12'), 1392);
  assert.equal(Logic.durationMin('2026-10-19T23:12', '2026-10-20T06:31'), 439);
  assert.equal(Logic.midMinutes('2026-10-19T23:12', '2026-10-20T06:31'), 171);
  assert.equal(Logic.midMinutes('2026-10-20T13:05', '2026-10-20T13:50'), 807);
});

test('circular mean and diff', () => {
  assert.equal(Logic.circularMean([1380, 60]), 0);
  assert.equal(Logic.circularMean([180, 180, 190, 170]), 180);
  assert.equal(Logic.circularMean([184]), 184);
  assert.equal(Logic.circularMean([]), null);
  assert.equal(Logic.circularDiff(171, 184), -13);
  assert.equal(Logic.circularDiff(10, 1430), 20);
  assert.equal(Logic.circularDiff(900, 180), 720);
});

test('formatting', () => {
  assert.equal(Logic.formatHM(8), '0:08');
  assert.equal(Logic.formatHM(1392), '23:12');
  assert.equal(Logic.formatHM(-240), '20:00');
  assert.equal(Logic.formatHM(1500), '1:00');
  assert.equal(Logic.formatDuration(439, 'ja'), '7 時間 19 分');
  assert.equal(Logic.formatDuration(439, 'en'), '7 h 19 min');
  assert.equal(Logic.formatDuration(45, 'ja'), '45 分');
  assert.equal(Logic.formatDuration(45, 'en'), '45 min');
  assert.equal(Logic.formatDuration(480, 'en'), '8 h');
  assert.equal(Logic.formatDuration(480, 'ja'), '8 時間');
  assert.equal(Logic.formatDateShort('2026-10-20T06:31', 'ja'), '10/20(火)');
  assert.equal(Logic.formatDateShort('2026-10-20', 'en'), 'Oct 20 (Tue)');
  assert.equal(Logic.addDays('2026-10-01', -1), '2026-09-30');
  assert.equal(Logic.todayStr(new Date(2026, 9, 5, 3, 0)), '2026-10-05');
});

test('durationParts', () => {
  assert.deepEqual(Logic.durationParts(254, 'ja'), [{ n: '4', u: '時間' }, { n: '14', u: '分' }]);
  assert.deepEqual(Logic.durationParts(254, 'en'), [{ n: '4', u: 'h' }, { n: '14', u: 'm' }]);
  assert.deepEqual(Logic.durationParts(120, 'ja'), [{ n: '2', u: '時間' }]);
  assert.deepEqual(Logic.durationParts(0, 'en'), [{ n: '0', u: 'm' }]);
});
test('midOf', () => {
  assert.equal(Logic.midOf(new Date(2026, 9, 20, 0, 40), new Date(2026, 9, 20, 6, 0)), 200);   // 3:20
  assert.equal(Logic.midOf(new Date(2026, 9, 19, 23, 0), new Date(2026, 9, 20, 1, 0)), 0);     // 0:00
});
