process.env.TZ = 'Asia/Tokyo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';
const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));

test('minutes round-trip', () => {
  assert.equal(Logic.toMin('13:05'), 785);
  assert.equal(Logic.toHHMM(785), '13:05');
  assert.equal(Logic.toHHMM(1440), '24:00');
});

test('date arithmetic stays on date strings across DST-like boundaries', () => {
  assert.equal(Logic.todayStr(new Date(2026, 9, 17, 23, 59)), '2026-10-17');
  assert.equal(Logic.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(Logic.addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(Logic.addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(Logic.weekdayOf('2026-10-17'), 6);
  assert.equal(Logic.weekStartOf('2026-10-17', 1), '2026-10-12');
  assert.equal(Logic.weekStartOf('2026-10-17', 0), '2026-10-11');
  assert.equal(Logic.weekStartOf('2026-10-12', 1), '2026-10-12');
  assert.deepEqual(Logic.weekDates('2026-10-12'), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
});

test('formatting ja/en', () => {
  assert.equal(Logic.formatDateShort('2026-10-22', 'ja'), '10/22(木)');
  assert.equal(Logic.formatDateShort('2026-10-22', 'en'), 'Thu 10/22');
  assert.equal(Logic.formatDateLong('2026-10-22', 'ja'), '10月22日(木)');
  assert.equal(Logic.formatDateLong('2026-10-22', 'en'), 'Thu, Oct 22');
  assert.equal(Logic.formatRange('13:00', '14:30', 'ja'), '13:00〜14:30');
  assert.equal(Logic.formatRange('13:00', '14:30', 'en'), '13:00–14:30');
  assert.equal(Logic.formatSlotLong({ date: '2026-10-22', start: '13:00', end: '14:30' }, 'ja'), '10月22日(木) 13:00〜14:30');
  assert.equal(Logic.formatWeekTitle('2026-10-19', 'ja'), '10/19 – 10/25');
  assert.equal(Logic.formatMonthTitle(2026, 10, 'ja'), '2026年10月');
  assert.equal(Logic.formatMonthTitle(2026, 10, 'en'), 'October 2026');
});

test('deadline helpers', () => {
  const p = { deadline: '2026-10-22' };
  assert.equal(Logic.isExpired(p, '2026-10-22'), false);
  assert.equal(Logic.isExpired(p, '2026-10-23'), true);
  assert.equal(Logic.daysUntil('2026-10-22', '2026-10-20'), 2);
  assert.equal(Logic.daysUntil('2026-10-22', '2026-10-25'), -3);
});

test('timeOfDay follows settings boundaries', () => {
  const s = { pmStart: 12, eveStart: 17 };
  assert.equal(Logic.timeOfDay('11:59', s), 'am');
  assert.equal(Logic.timeOfDay('12:00', s), 'pm');
  assert.equal(Logic.timeOfDay('16:59', s), 'pm');
  assert.equal(Logic.timeOfDay('17:00', s), 'eve');
  assert.equal(Logic.timeOfDay('13:00', { pmStart: 14, eveStart: 18 }), 'am');
});

test('displayName appends honorific, empty allowed', () => {
  assert.equal(Logic.displayName({ name: '田中' }, { honorific: 'さん' }), '田中さん');
  assert.equal(Logic.displayName({ name: 'Tanaka' }, { honorific: '' }), 'Tanaka');
});
