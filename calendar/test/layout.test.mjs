// calendar/test/layout.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';
const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));

const d = (y, m, day) => new Date(y, m - 1, day);
const events = Logic.normalizeResponse(JSON.parse(readFileSync(new URL('./fixtures/gas-events.json', import.meta.url), 'utf8'))).events;
const byId = (id) => events.find((e) => e.id === id);
const week = Logic.daysInRange({ from: d(2026, 10, 11), to: d(2026, 10, 18) });

test('isAllDayLike: allDay flag or >= 24h', () => {
  assert.equal(Logic.isAllDayLike(byId('e6')), true);
  assert.equal(Logic.isAllDayLike(byId('e9')), true);
  assert.equal(Logic.isAllDayLike(byId('e5')), false);
});

test('segmentsByDay: midnight split, all-day separation', () => {
  const days = Logic.segmentsByDay(events, week);
  assert.equal(days.length, 7);
  const tue = days[2]; // 10-13
  assert.deepEqual(tue.timed.map((s) => s.event.id), ['e1', 'e2', 'e3', 'e4']);
  assert.deepEqual(tue.allDay.map((e) => e.id), []);
  assert.deepEqual(days[1].allDay.map((e) => e.id), ['e6']); // 10-12
  const wed = days[3], thu = days[4]; // 10-14, 10-15
  const s1 = wed.timed.find((s) => s.event.id === 'e5');
  assert.deepEqual([s1.start, s1.end, s1.continuesBefore, s1.continuesAfter], [new Date(2026, 9, 14, 23, 30), d(2026, 10, 15), false, true]);
  const s2 = thu.timed.find((s) => s.event.id === 'e5');
  assert.deepEqual([s2.start, s2.end, s2.continuesBefore, s2.continuesAfter], [d(2026, 10, 15), new Date(2026, 9, 15, 0, 30), true, false]);
  assert.deepEqual(thu.allDay.map((e) => e.id).sort(), ['e7', 'e9']);
  assert.deepEqual(days[5].allDay.map((e) => e.id).sort(), ['e7', 'e8', 'e9']); // 10-16
});

test('allDayBars: columns, spans, continuation and row packing', () => {
  const bars = Logic.allDayBars(events, week);
  const by = (id) => bars.find((b) => b.event.id === id);
  assert.deepEqual([by('e6').startCol, by('e6').span, by('e6').row], [1, 1, 0]);
  assert.deepEqual([by('e7').startCol, by('e7').span, by('e7').row], [3, 3, 0]);
  assert.deepEqual([by('e9').startCol, by('e9').span, by('e9').row], [4, 2, 1]);
  assert.deepEqual([by('e8').startCol, by('e8').span, by('e8').continuesRight, by('e8').row], [5, 2, true, 2]);
  assert.equal(by('e8').continuesLeft, false);
  // a bar starting before the week
  const early = Logic.allDayBars([{ id: 'x', allDay: true, start: d(2026, 10, 9), end: d(2026, 10, 13) }], week)[0];
  assert.deepEqual([early.startCol, early.span, early.continuesLeft], [0, 2, true]);
  assert.deepEqual(Logic.allDayBars(events, []), []);
});

test('layoutColumns: clusters and column reuse', () => {
  const tue = Logic.segmentsByDay(events, [d(2026, 10, 13)])[0].timed;
  const laid = Logic.layoutColumns(tue);
  const by = (id) => laid.find((x) => x.seg.event.id === id);
  assert.deepEqual([by('e1').col, by('e1').cols], [0, 1]);
  assert.deepEqual([by('e2').col, by('e2').cols], [0, 2]);
  assert.deepEqual([by('e3').col, by('e3').cols], [1, 2]);
  assert.deepEqual([by('e4').col, by('e4').cols], [1, 2]); // reuses e3's column after it ends
  assert.deepEqual(Logic.layoutColumns([]), []);
});

test('clipToHours', () => {
  const fri = Logic.segmentsByDay(events, [d(2026, 10, 16)])[0].timed;
  const early = Logic.clipToHours(fri.find((s) => s.event.id === 'e10'), 6, 23);
  assert.equal(early.topPct, 0);
  assert.ok(Math.abs(early.heightPct - (60 / 1020) * 100) < 1e-9);
  assert.deepEqual([early.clippedTop, early.clippedBottom], [true, false]);
  const late = Logic.clipToHours(fri.find((s) => s.event.id === 'e11'), 6, 23);
  assert.ok(Math.abs(late.topPct + late.heightPct - 100) < 1e-9);
  assert.deepEqual([late.clippedTop, late.clippedBottom], [false, true]);
  const out = Logic.clipToHours(fri.find((s) => s.event.id === 'e10'), 8, 23);
  assert.equal(out, null);
  const midnight = Logic.segmentsByDay(events, [d(2026, 10, 14)])[0].timed.find((s) => s.event.id === 'e5');
  const c = Logic.clipToHours(midnight, 0, 24);
  assert.ok(Math.abs(c.topPct - (1410 / 1440) * 100) < 1e-9);
  assert.ok(Math.abs(c.heightPct - (30 / 1440) * 100) < 1e-9);
});

test('monthCells: all-day first, overflow count', () => {
  const days = Logic.monthGridDays(d(2026, 10, 13), 0);
  const cells = Logic.monthCells(events, days, 2);
  assert.equal(cells.length, 42);
  const tue = cells.find((c) => c.date.getTime() === d(2026, 10, 13).getTime());
  assert.equal(tue.items.length, 2);
  assert.equal(tue.more, 2);
  assert.deepEqual(tue.items.map((i) => i.event.id), ['e1', 'e2']);
  const mon = cells.find((c) => c.date.getTime() === d(2026, 10, 12).getTime());
  assert.deepEqual(mon.items.map((i) => [i.event.id, i.allDay]), [['e6', true]]);
  assert.equal(mon.more, 0);
  const fri = cells.find((c) => c.date.getTime() === d(2026, 10, 16).getTime());
  assert.deepEqual(fri.items.map((i) => i.event.id), ['e7', 'e8']);
  assert.equal(fri.more, 3); // e9 (all-day-like), e10, e11
});
