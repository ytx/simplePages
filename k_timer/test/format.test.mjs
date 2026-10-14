import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));
const jst = (h, m, s = 0, day = 14) => Date.UTC(2026, 9, day, h - 9, m, s); // JST = UTC+9 (TZ is set by load-logic)

test('formatRemaining: ceiling for positive, floor for overrun, m:ss', () => {
  assert.equal(Logic.formatRemaining(0), '0:00');
  assert.equal(Logic.formatRemaining(999), '0:01');
  assert.equal(Logic.formatRemaining(1000), '0:01');
  assert.equal(Logic.formatRemaining(59999), '1:00');
  assert.equal(Logic.formatRemaining(60000), '1:00');
  assert.equal(Logic.formatRemaining(277000), '4:37');
  assert.equal(Logic.formatRemaining(180 * 60000), '180:00');
  assert.equal(Logic.formatRemaining(-1), '0:00');
  assert.equal(Logic.formatRemaining(-999), '0:00');
  assert.equal(Logic.formatRemaining(-1500), '-0:01');
  assert.equal(Logic.formatRemaining(-42000), '-0:42');
  assert.equal(Logic.formatRemaining(-61000), '-1:01');
});

test('formatEndAt: HH:MM same day; tomorrow variant across midnight', () => {
  assert.equal(Logic.formatEndAt(jst(14, 32, 10), jst(14, 0), 'ja'), '終了 14:32');
  assert.equal(Logic.formatEndAt(jst(14, 32, 10), jst(14, 0), 'en'), 'Ends 14:32');
  assert.equal(Logic.formatEndAt(jst(9, 5), jst(9, 0), 'ja'), '終了 09:05');
  assert.equal(Logic.formatEndAt(jst(0, 5, 0, 15), jst(23, 50), 'ja'), '終了 翌 00:05');
  assert.equal(Logic.formatEndAt(jst(0, 5, 0, 15), jst(23, 50), 'en'), 'Ends tomorrow 00:05');
});

test('formatDateLine', () => {
  const d = new Date(jst(14, 0)); // 2026-10-14 is a Wednesday
  assert.equal(Logic.formatDateLine(d, 'ja'), '2026-10-14 (水)');
  assert.equal(Logic.formatDateLine(d, 'en'), 'Wed, Oct 14, 2026');
  assert.equal(Logic.formatDateLine(new Date(jst(1, 0, 0, 4)), 'ja'), '2026-10-04 (日)');
});

test('handAngles', () => {
  assert.deepEqual(Logic.handAngles(new Date(jst(0, 0, 0))), { hour: 0, minute: 0, second: 0 });
  assert.deepEqual(Logic.handAngles(new Date(jst(12, 0, 0))), { hour: 0, minute: 0, second: 0 });
  assert.deepEqual(Logic.handAngles(new Date(jst(3, 30, 0))), { hour: 105, minute: 180, second: 0 });
  assert.deepEqual(Logic.handAngles(new Date(jst(15, 45, 30))), { hour: 112.75, minute: 273, second: 180 });
});
