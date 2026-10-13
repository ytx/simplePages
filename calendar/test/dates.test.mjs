// calendar/test/dates.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));
const d = (y, m, day) => new Date(y, m - 1, day);

test('ymd / parseYmd round-trip and reject invalid', () => {
  assert.equal(Logic.ymd(d(2026, 10, 13)), '2026-10-13');
  assert.deepEqual(Logic.parseYmd('2026-10-13'), d(2026, 10, 13));
  assert.equal(Logic.parseYmd('2026-02-30'), null);
  assert.equal(Logic.parseYmd('20261013'), null);
  assert.equal(Logic.parseYmd(undefined), null);
});

test('startOfWeek honours weekStart 0 (Sun) and 1 (Mon)', () => {
  // 2026-10-13 is a Tuesday
  assert.deepEqual(Logic.startOfWeek(d(2026, 10, 13), 0), d(2026, 10, 11));
  assert.deepEqual(Logic.startOfWeek(d(2026, 10, 13), 1), d(2026, 10, 12));
  assert.deepEqual(Logic.startOfWeek(d(2026, 10, 11), 1), d(2026, 10, 5)); // Sunday with Monday start
});

test('monthGridDays: 42 days starting on the week containing the 1st', () => {
  const days = Logic.monthGridDays(d(2026, 10, 13), 0);
  assert.equal(days.length, 42);
  assert.deepEqual(days[0].date, d(2026, 9, 27)); // Oct 1 2026 is a Thursday
  assert.deepEqual(days[41].date, d(2026, 11, 7));
  assert.equal(days.filter((x) => x.inMonth).length, 31);
  assert.equal(days[0].inMonth, false);
  assert.equal(days[4].inMonth, true);
});

test('rangeForView: day / week / month', () => {
  const a = d(2026, 10, 13);
  assert.deepEqual(Logic.rangeForView('day', a, 0), { from: d(2026, 10, 13), to: d(2026, 10, 14) });
  assert.deepEqual(Logic.rangeForView('week', a, 0), { from: d(2026, 10, 11), to: d(2026, 10, 18) });
  assert.deepEqual(Logic.rangeForView('week', a, 1), { from: d(2026, 10, 12), to: d(2026, 10, 19) });
  assert.deepEqual(Logic.rangeForView('month', a, 0), { from: d(2026, 9, 27), to: d(2026, 11, 8) });
  assert.equal(Logic.daysInRange(Logic.rangeForView('week', a, 0)).length, 7);
});

test('shiftAnchor', () => {
  assert.deepEqual(Logic.shiftAnchor('day', d(2026, 10, 31), 1), d(2026, 11, 1));
  assert.deepEqual(Logic.shiftAnchor('week', d(2026, 10, 13), -1), d(2026, 10, 6));
  assert.deepEqual(Logic.shiftAnchor('month', d(2026, 10, 31), 1), d(2026, 11, 1));
  assert.deepEqual(Logic.shiftAnchor('month', d(2026, 1, 15), -1), d(2025, 12, 1));
});

test('windowFor / coversRange', () => {
  const r = { from: d(2026, 10, 11), to: d(2026, 10, 18) };
  const w = Logic.windowFor(r);
  assert.deepEqual(w, { from: d(2026, 9, 10), to: d(2026, 11, 18) });
  assert.equal(Logic.coversRange(w, r), true);
  assert.equal(Logic.coversRange(w, { from: d(2026, 9, 9), to: d(2026, 9, 10) }), false);
  assert.equal(Logic.coversRange(null, r), false);
  assert.equal(Logic.coversRange({ from: d(2026, 10, 11), to: d(2026, 10, 18) }, r), true);
});

test('isToday', () => {
  assert.equal(Logic.isToday(new Date(2026, 9, 13, 23, 59), new Date(2026, 9, 13, 0, 1)), true);
  assert.equal(Logic.isToday(d(2026, 10, 14), new Date(2026, 9, 13, 23, 59)), false);
});

test('formatRangeTitle ja', () => {
  const wk = (a, ws = 0) => Logic.formatRangeTitle('week', a, Logic.rangeForView('week', a, ws), 'ja');
  assert.equal(wk(d(2026, 10, 13)), '2026年10月 11日〜17日');
  assert.equal(wk(d(2026, 11, 1), 1), '2026年10月26日〜11月1日');
  assert.equal(wk(d(2026, 12, 31)), '2026年12月27日〜2027年1月2日');
  assert.equal(Logic.formatRangeTitle('day', d(2026, 10, 13), Logic.rangeForView('day', d(2026, 10, 13), 0), 'ja'), '2026年10月13日(火)');
  assert.equal(Logic.formatRangeTitle('month', d(2026, 10, 13), Logic.rangeForView('month', d(2026, 10, 13), 0), 'ja'), '2026年10月');
});

test('formatRangeTitle en', () => {
  const wk = (a, ws = 0) => Logic.formatRangeTitle('week', a, Logic.rangeForView('week', a, ws), 'en');
  assert.equal(wk(d(2026, 10, 13)), 'Oct 11 – 17, 2026');
  assert.equal(wk(d(2026, 11, 1), 1), 'Oct 26 – Nov 1, 2026');
  assert.equal(wk(d(2026, 12, 31)), 'Dec 27, 2026 – Jan 2, 2027');
  assert.equal(Logic.formatRangeTitle('month', d(2026, 10, 13), Logic.rangeForView('month', d(2026, 10, 13), 0), 'en'), 'October 2026');
});
