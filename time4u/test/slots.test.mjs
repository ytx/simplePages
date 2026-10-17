process.env.TZ = 'Asia/Tokyo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';
const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));

const S = { interval: 10, pmStart: 12, eveStart: 17, rangeStartDays: 1, rangeDays: 21, defaultSlot: 90 };
const NOW = new Date(2026, 9, 17, 10, 0);
const base = () => ({ version: 1, clients: [{ id: 'c_1', name: 'A', reading: '', createdAt: '' }, { id: 'c_2', name: 'B', reading: '', createdAt: '' }], bands: [], blocks: [], proposals: [] });
const cond = (o) => ({ from: '2026-10-19', to: '2026-10-31', weekdays: [0, 1, 2, 3, 4, 5, 6], timeOfDay: ['am', 'pm', 'eve'], slotMin: 90, ...o });
const times = (slots) => slots.map((s) => `${s.date} ${s.start}-${s.end}`);

test('band 13-17, 90 min → candidates step by slot length, no interval between them', () => {
  const d = base(); d.bands.push({ id: 'b', date: '2026-10-20', start: '13:00', end: '17:00' });
  assert.deepEqual(times(Logic.freeSlots(d, cond(), S, NOW)), ['2026-10-20 13:00-14:30', '2026-10-20 14:30-16:00']);
});

test('band 13-17, 120 min, interval 30 → 13:00-15:00 and 15:00-17:00', () => {
  const d = base(); d.bands.push({ id: 'b', date: '2026-10-20', start: '13:00', end: '17:00' });
  assert.deepEqual(times(Logic.freeSlots(d, cond({ slotMin: 120 }), { ...S, interval: 30 }, NOW)), ['2026-10-20 13:00-15:00', '2026-10-20 15:00-17:00']);
});

test('hold at the band start keeps the grid: interval after a hold', () => {
  const d = base(); d.bands.push({ id: 'b', date: '2026-10-20', start: '13:00', end: '17:00' });
  d.proposals.push({ id: 'p_1', clientId: 'c_1', status: 'pending', slots: [{ date: '2026-10-20', start: '13:00', end: '14:30' }], deadline: '2026-10-01', message: '', conditions: {}, createdAt: '' });
  assert.deepEqual(times(Logic.freeSlots(d, cond(), S, NOW)), ['2026-10-20 14:40-16:10']);
  assert.deepEqual(Logic.freeIntervals(d, '2026-10-20', 10), [{ start: '14:40', end: '17:00' }]);
});

test('busy block splits a band without adding interval', () => {
  const d = base(); d.bands.push({ id: 'b', date: '2026-10-20', start: '10:00', end: '15:00' });
  d.blocks.push({ id: 'k', date: '2026-10-20', start: '12:00', end: '13:00', kind: 'busy', title: 'lunch' });
  assert.deepEqual(times(Logic.freeSlots(d, cond(), S, NOW)), ['2026-10-20 10:00-11:30', '2026-10-20 13:00-14:30']);
});

test('meeting adds interval before and after', () => {
  const d = base(); d.bands.push({ id: 'b', date: '2026-10-20', start: '09:00', end: '18:00' });
  d.blocks.push({ id: 'k', date: '2026-10-20', start: '12:00', end: '13:00', kind: 'meeting', clientId: 'c_2' });
  assert.deepEqual(Logic.freeIntervals(d, '2026-10-20', 10), [{ start: '09:00', end: '11:50' }, { start: '13:10', end: '18:00' }]);
});

test('expired pending proposal still holds; confirmed releases the rest but not other clients', () => {
  const d = base(); d.bands.push({ id: 'b', date: '2026-10-20', start: '09:00', end: '18:00' });
  d.proposals.push(
    { id: 'p_1', clientId: 'c_1', status: 'pending', slots: [{ date: '2026-10-20', start: '09:00', end: '10:30' }, { date: '2026-10-20', start: '10:40', end: '12:10' }, { date: '2026-10-20', start: '12:20', end: '13:50' }], deadline: '2026-10-01', message: '', conditions: {}, createdAt: '' },
    { id: 'p_2', clientId: 'c_2', status: 'pending', slots: [{ date: '2026-10-20', start: '16:00', end: '17:30' }], deadline: '2026-10-30', message: '', conditions: {}, createdAt: '' },
  );
  assert.deepEqual(times(Logic.freeSlots(d, cond(), S, NOW)), ['2026-10-20 14:00-15:30']);
  d.proposals[0].status = 'confirmed'; d.proposals[0].confirmedSlot = 1;
  d.blocks.push({ id: 'k', date: '2026-10-20', start: '10:40', end: '12:10', kind: 'meeting', clientId: 'c_1', proposalId: 'p_1' });
  assert.deepEqual(times(Logic.freeSlots(d, cond(), S, NOW)), ['2026-10-20 09:00-10:30', '2026-10-20 12:20-13:50', '2026-10-20 13:50-15:20']);
});

test('excludeProposalId returns the own held slots (re-propose)', () => {
  const d = base(); d.bands.push({ id: 'b', date: '2026-10-20', start: '13:00', end: '17:00' });
  d.proposals.push({ id: 'p_1', clientId: 'c_1', status: 'pending', slots: [{ date: '2026-10-20', start: '13:00', end: '14:30' }], deadline: '2026-10-01', message: '', conditions: {}, createdAt: '' });
  assert.deepEqual(times(Logic.freeSlots(d, cond(), S, NOW, 'p_1')), ['2026-10-20 13:00-14:30', '2026-10-20 14:30-16:00']);
});

test('filters: range, weekday, time of day, past slots, interval 0', () => {
  const d = base();
  d.bands.push({ id: 'b1', date: '2026-10-17', start: '09:00', end: '13:00' }, { id: 'b2', date: '2026-10-20', start: '09:00', end: '21:00' }, { id: 'b3', date: '2026-10-24', start: '09:00', end: '12:00' });
  const all = Logic.freeSlots(d, cond({ from: '2026-10-17', to: '2026-10-24' }), S, NOW);
  assert.deepEqual(times(all.filter((s) => s.date === '2026-10-17')), ['2026-10-17 10:30-12:00']); // 09:00 starts before NOW
  assert.deepEqual(times(Logic.freeSlots(d, cond({ from: '2026-10-17', to: '2026-10-24', weekdays: [2] }), S, NOW)).every((t) => t.startsWith('2026-10-20')), true);
  assert.deepEqual(times(Logic.freeSlots(d, cond({ weekdays: [2], timeOfDay: ['eve'] }), S, NOW)), ['2026-10-20 18:00-19:30', '2026-10-20 19:30-21:00']);
  assert.deepEqual(times(Logic.freeSlots(d, cond({ weekdays: [2], timeOfDay: ['am'], slotMin: 60 }), { ...S, interval: 0 }, NOW)), ['2026-10-20 09:00-10:00', '2026-10-20 10:00-11:00', '2026-10-20 11:00-12:00']);
});

test('defaultConditions from settings', () => {
  assert.deepEqual(Logic.defaultConditions(S, '2026-10-17'), { from: '2026-10-18', to: '2026-11-07', weekdays: [1, 2, 3, 4, 5], timeOfDay: ['am', 'pm'], slotMin: 90 });
});

test('pickSpread keeps selection, spreads across dates, fills what it can', () => {
  const slots = [
    { date: '2026-10-20', start: '09:00', end: '10:30' }, { date: '2026-10-20', start: '13:00', end: '14:30' },
    { date: '2026-10-21', start: '09:00', end: '10:30' }, { date: '2026-10-21', start: '13:00', end: '14:30' },
    { date: '2026-10-27', start: '09:00', end: '10:30' }, { date: '2026-10-27', start: '13:00', end: '14:30' },
  ];
  const three = Logic.pickSpread(slots, [], 3);
  assert.equal(three.length, 3);
  assert.equal(new Set(three.map((s) => s.date)).size, 3);
  const kept = Logic.pickSpread(slots, [slots[1]], 3);
  assert.ok(kept.includes(slots[1]));
  assert.equal(kept.length, 3);
  assert.equal(new Set(kept.map((s) => s.date)).size, 3);
  assert.equal(Logic.pickSpread(slots.slice(0, 2), [], 5).length, 2);
  assert.deepEqual(Logic.pickSpread(slots, slots.slice(0, 3), 3), slots.slice(0, 3));
});
