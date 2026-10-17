process.env.TZ = 'Asia/Tokyo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';
const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));

const data = {
  version: 1,
  clients: [{ id: 'c_1', name: '田中', reading: '', createdAt: '' }],
  bands: [{ id: 'b_1', date: '2026-10-20', start: '13:00', end: '17:00' }, { id: 'b_2', date: '2026-10-21', start: '07:00', end: '09:00' }],
  blocks: [{ id: 'k_1', date: '2026-10-20', start: '12:00', end: '13:00', kind: 'busy', title: 'ランチ' }, { id: 'k_2', date: '2026-10-20', start: '15:00', end: '16:30', kind: 'meeting', clientId: 'c_1' }],
  proposals: [{ id: 'p_1', clientId: 'c_1', status: 'pending', slots: [{ date: '2026-10-20', start: '13:00', end: '14:30' }], deadline: '2026-10-22', message: '', conditions: {}, createdAt: '' }],
};

test('itemsForDay stacks bands first then items by start', () => {
  const items = Logic.itemsForDay(data, '2026-10-20');
  assert.deepEqual(items.map((i) => [i.kind, i.start]), [['band', '13:00'], ['busy', '12:00'], ['hold', '13:00'], ['meeting', '15:00']]);
  assert.equal(items[2].deadline, '2026-10-22');
  assert.equal(items[2].clientId, 'c_1');
  assert.deepEqual(Logic.itemsForDay(data, '2026-10-20', 'p_1').map((i) => i.kind), ['band', 'busy', 'meeting']);
});

test('itemsForWeek has 7 keys', () => {
  const w = Logic.itemsForWeek(data, '2026-10-19');
  assert.deepEqual(Object.keys(w), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  assert.equal(w['2026-10-21'].length, 1);
});

test('axisRange extends to cover items and pct maps minutes', () => {
  const w = Logic.itemsForWeek(data, '2026-10-19');
  assert.deepEqual(Logic.axisRange(w, 8, 21), { startMin: 420, endMin: 1260 });
  assert.deepEqual(Logic.axisRange({}, 8, 21), { startMin: 480, endMin: 1260 });
  assert.equal(Logic.pct(480, 480, 1260), 0);
  assert.equal(Logic.pct(870, 480, 1260), 50);
});

test('monthCells: 42 cells, week start, markers', () => {
  const cells = Logic.monthCells(data, 2026, 10, 1, '2026-10-17');
  assert.equal(cells.length, 42);
  assert.equal(cells[0].date, '2026-09-28');
  assert.equal(cells[0].inMonth, false);
  assert.equal(cells.find((c) => c.date === '2026-10-17').isToday, true);
  const d20 = cells.find((c) => c.date === '2026-10-20');
  assert.deepEqual([d20.hasBand, d20.meetings, d20.holds], [true, 1, 1]);
  assert.equal(Logic.monthCells(data, 2026, 10, 0, '2026-10-17')[0].date, '2026-09-27');
  assert.equal(Logic.monthCells(data, 2026, 2, 1, '2026-10-17')[0].date, '2026-01-26');
});
