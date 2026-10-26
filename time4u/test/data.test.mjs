process.env.TZ = 'Asia/Tokyo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';
const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));

const NOW = new Date(2026, 9, 17, 10, 0); // Sat 2026-10-17 10:00

function sample() {
  return {
    version: 1,
    clients: [{ id: 'c_1', name: '田中', reading: 'たなか', createdAt: '2026-10-01T00:00:00' }, { id: 'c_2', name: '佐藤', reading: 'さとう', createdAt: '2026-10-01T00:00:00' }, { id: 'c_3', name: '鈴木', reading: 'すずき', createdAt: '2026-10-01T00:00:00' }],
    bands: [{ id: 'b_1', date: '2026-10-20', start: '13:00', end: '17:00' }],
    blocks: [
      { id: 'k_1', date: '2026-10-20', start: '12:00', end: '13:00', kind: 'busy', title: 'ランチ' },
      { id: 'k_2', date: '2026-10-22', start: '10:00', end: '11:30', kind: 'meeting', clientId: 'c_2', proposalId: 'p_2' },
      { id: 'k_3', date: '2026-09-30', start: '10:00', end: '11:00', kind: 'meeting', clientId: 'c_1' },
      { id: 'k_4', date: '2026-09-12', start: '10:00', end: '11:00', kind: 'meeting', clientId: 'c_3' },
    ],
    proposals: [
      { id: 'p_1', clientId: 'c_1', status: 'pending', slots: [{ date: '2026-10-20', start: '13:00', end: '14:30' }, { date: '2026-10-27', start: '13:00', end: '14:30' }], deadline: '2026-10-22', message: 'm', conditions: {}, createdAt: '2026-10-17T09:00:00' },
      { id: 'p_2', clientId: 'c_2', status: 'confirmed', slots: [{ date: '2026-10-22', start: '10:00', end: '11:30' }], deadline: '2026-10-15', message: 'm', conditions: {}, createdAt: '2026-10-10T09:00:00', confirmedSlot: 0 },
      { id: 'p_3', clientId: 'c_3', status: 'pending', slots: [{ date: '2026-10-23', start: '13:00', end: '14:30' }], deadline: '2026-10-16', message: 'm', conditions: {}, createdAt: '2026-10-12T09:00:00' },
    ],
  };
}

test('normalizeData repairs broken input without throwing', () => {
  assert.deepEqual(Logic.normalizeData(null), Logic.emptyData());
  assert.deepEqual(Logic.normalizeData({ clients: 'x', bands: 5 }), Logic.emptyData());
  const d = Logic.normalizeData({
    version: 1,
    clients: [{ id: 'c_1', name: '田中' }, { name: 'no id' }, 'junk'],
    bands: [{ id: 'b_1', date: '2026-10-20', start: '13:00', end: '17:00' }, { id: 'b_2', date: 'bad', start: '1', end: '2' }],
    blocks: [{ id: 'k_1', date: '2026-10-20', start: '12:00', end: '13:00', kind: 'busy' }, { id: 'k_9', date: '2026-10-20', start: '12:00', end: '13:00', kind: 'meeting', clientId: 'ghost' }],
    proposals: [{ id: 'p_1', clientId: 'c_1', status: 'weird', slots: [], deadline: '2026-10-22' }, { id: 'p_9', clientId: 'ghost', status: 'pending', slots: [], deadline: '2026-10-22' }],
  });
  assert.equal(d.clients.length, 1);
  assert.equal(d.clients[0].reading, '');
  assert.equal(d.bands.length, 1);
  assert.deepEqual(d.blocks.map((b) => b.id), ['k_1']);
  assert.deepEqual(d.proposals.map((p) => [p.id, p.status]), [['p_1', 'cancelled']]);
});

test('newId has prefix, timestamp and 4 digits', () => {
  assert.match(Logic.newId('c', NOW, () => 0.4821), /^c_\d{13}_4821$/);
});

test('mergeBands merges overlapping and touching bands per day', () => {
  const out = Logic.mergeBands([
    { id: 'b_1', date: '2026-10-20', start: '13:00', end: '15:00' },
    { id: 'b_2', date: '2026-10-20', start: '14:00', end: '17:00' },
    { id: 'b_3', date: '2026-10-20', start: '17:00', end: '18:00' },
    { id: 'b_4', date: '2026-10-21', start: '09:00', end: '10:00' },
  ]);
  assert.deepEqual(out.map((b) => [b.date, b.start, b.end]), [['2026-10-20', '13:00', '18:00'], ['2026-10-21', '09:00', '10:00']]);
  assert.equal(out[0].id, 'b_1');
});

test('copyWeekBands shifts by whole weeks, replace vs add, copies busy blocks but never meetings', () => {
  const d = sample();
  d.bands.push({ id: 'b_2', date: '2026-10-28', start: '09:00', end: '10:00' });
  d.blocks.push({ id: 'k_9', date: '2026-10-28', start: '15:00', end: '16:00', kind: 'busy', title: '別件' });
  const rep = Logic.copyWeekBands(d, '2026-10-19', '2026-10-26', 'replace');
  assert.deepEqual(rep.bands.filter((b) => b.date >= '2026-10-26').map((b) => [b.date, b.start, b.end]), [['2026-10-27', '13:00', '17:00']]);
  // 予定(busy)は複写され、置き換えでは対象週の予定は消える。面会(meeting)は複写も削除もされない
  assert.deepEqual(rep.blocks.filter((b) => b.date >= '2026-10-26').map((b) => [b.date, b.start, b.kind, b.title]), [['2026-10-27', '12:00', 'busy', 'ランチ']]);
  assert.ok(rep.blocks.some((b) => b.id === 'k_2'), 'meeting in the source week stays');
  assert.ok(!rep.blocks.some((b) => b.kind === 'meeting' && b.date >= '2026-10-26'), 'meeting is not copied');
  assert.equal(new Set(rep.blocks.map((b) => b.id)).size, rep.blocks.length);
  const add = Logic.copyWeekBands(d, '2026-10-19', '2026-10-26', 'add');
  assert.deepEqual(add.bands.filter((b) => b.date >= '2026-10-26').map((b) => b.date), ['2026-10-27', '2026-10-28']);
  assert.deepEqual(add.blocks.filter((b) => b.date >= '2026-10-26').map((b) => [b.date, b.title]), [['2026-10-28', '別件'], ['2026-10-27', 'ランチ']]);
  // 追加をもう一度しても同じ予定は増えない
  const again = Logic.copyWeekBands(add, '2026-10-19', '2026-10-26', 'add');
  assert.equal(again.blocks.length, add.blocks.length);
  assert.notEqual(add, d);
});

test('weeksWithBands lists past weeks newest first, counting bands and busy blocks', () => {
  const d = sample();
  d.bands.push({ id: 'b_2', date: '2026-10-06', start: '09:00', end: '10:00' }, { id: 'b_3', date: '2026-10-07', start: '09:00', end: '10:00' });
  d.blocks.push({ id: 'k_8', date: '2026-09-29', start: '09:00', end: '10:00', kind: 'busy', title: '予定だけの週' });
  assert.deepEqual(Logic.weeksWithBands(d, '2026-10-26', 1), [
    { weekStart: '2026-10-19', count: 1, busy: 1 },
    { weekStart: '2026-10-05', count: 2, busy: 0 },
    { weekStart: '2026-09-28', count: 0, busy: 1 },
  ]);
  assert.deepEqual(Logic.weeksWithBands(d, '2026-10-19', 1), [{ weekStart: '2026-10-05', count: 2, busy: 0 }, { weekStart: '2026-09-28', count: 0, busy: 1 }]);
});

test('holds are pending slots only, including expired, with exclusion', () => {
  const d = sample();
  assert.deepEqual(Logic.holds(d).map((h) => [h.date, h.proposalId]), [['2026-10-20', 'p_1'], ['2026-10-27', 'p_1'], ['2026-10-23', 'p_3']]);
  assert.deepEqual(Logic.holds(d, 'p_1').map((h) => h.proposalId), ['p_3']);
});

test('clientSections', () => {
  const s = Logic.clientSections(sample(), NOW, { honorific: 'さん' });
  assert.deepEqual(s.confirmed.map((r) => [r.client.id, r.block.id]), [['c_2', 'k_2']]);
  assert.deepEqual(s.pending.map((r) => [r.client.id, r.expired]), [['c_1', false], ['c_3', true]]);
  assert.deepEqual(s.past.map((r) => [r.client.id, r.lastDate]), [['c_1', '2026-09-30'], ['c_3', '2026-09-12']]);
  assert.deepEqual(s.other, []);
  const d = sample(); d.clients.push({ id: 'c_4', name: '山本', reading: '', createdAt: '' });
  assert.deepEqual(Logic.clientSections(d, NOW, {}).other.map((c) => c.id), ['c_4']);
});

test('clientHasActive and deleteClient', () => {
  const d = sample();
  assert.equal(Logic.clientHasActive(d, 'c_1', NOW), true);
  assert.equal(Logic.clientHasActive(d, 'c_2', NOW), true);
  assert.equal(Logic.clientHasActive(d, 'c_3', NOW), true);
  d.proposals[2].status = 'cancelled';
  assert.equal(Logic.clientHasActive(d, 'c_3', NOW), false);
  const out = Logic.deleteClient(d, 'c_3');
  assert.deepEqual(out.clients.map((c) => c.id), ['c_1', 'c_2']);
  assert.ok(!out.blocks.some((b) => b.clientId === 'c_3'));
  assert.ok(!out.proposals.some((p) => p.clientId === 'c_3'));
});

test('copyWeekBands from one week to two weeks yields unique band ids', () => {
  const d = sample();
  const a = Logic.copyWeekBands(d, '2026-10-19', '2026-10-26', 'add');
  const b = Logic.copyWeekBands(a, '2026-10-19', '2026-11-02', 'add');
  const ids = b.bands.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 3);
});
