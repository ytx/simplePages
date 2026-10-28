process.env.TZ = 'Asia/Tokyo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));
const R = (id, bedAt, wakeAt) => ({ id, bedAt, wakeAt, createdAt: '' });

const recs = [R('f', '2026-10-12T23:00', '2026-10-13T07:00'), R('a', '2026-10-15T23:30', '2026-10-16T06:30'), R('b', '2026-10-16T13:00', '2026-10-16T13:45'), R('c', '2026-10-16T23:30', '2026-10-17T06:30'), R('d', '2026-10-17T23:40', '2026-10-18T06:40'), R('e', '2026-10-18T23:20', '2026-10-19T06:20'), R('s', '2026-10-19T23:12', null)];

test('stats over window', () => {
  assert.deepEqual(Logic.stats(recs, 7, '2026-10-20'), { count: 4, targetMin: 180, sdMin: 7, avgSleepMin: 420 });
  assert.equal(Logic.stats(recs, 14, '2026-10-20').count, 5);
  assert.equal(Logic.stats(recs.slice(0, 2), 7, '2026-10-20').targetMin, null);
  assert.equal(Logic.inWindow(recs[0], 7, '2026-10-20'), false);
  assert.equal(Logic.inWindow(recs[1], 7, '2026-10-20'), true);
  assert.equal(Logic.inWindow(recs[6], 7, '2026-10-20'), false);
});

test('stats with mids straddling midnight', () => {
  const mk = [R('p', '2026-10-17T20:50', '2026-10-18T02:50'), R('q', '2026-10-18T21:10', '2026-10-19T03:10')];
  assert.equal(Logic.midMinutes(mk[0].bedAt, mk[0].wakeAt), 23 * 60 + 50);
  assert.equal(Logic.midMinutes(mk[1].bedAt, mk[1].wakeAt), 10);
  const st = Logic.stats(mk, 7, '2026-10-20');
  assert.equal(st.targetMin, 0);
  assert.equal(st.sdMin, 10);
});

test('manualTarget from any two of bed / wake / sleep', () => {
  const base = { targetBed: '23:00', targetWake: '06:00', targetSleepMin: 420 };
  assert.equal(Logic.manualTarget({ ...base, targetMode: '' }), null);
  assert.deepEqual(Logic.manualTarget({ ...base, targetMode: 'bed_wake' }), { targetMin: 150, bedMin: 1380, wakeMin: 360, sleepMin: 420 });
  assert.deepEqual(Logic.manualTarget({ ...base, targetMode: 'bed_sleep', targetSleepMin: 480 }), { targetMin: 180, bedMin: 1380, wakeMin: 420, sleepMin: 480 });
  assert.deepEqual(Logic.manualTarget({ ...base, targetMode: 'wake_sleep', targetWake: '05:00', targetSleepMin: 450 }), { targetMin: 75, bedMin: 1290, wakeMin: 300, sleepMin: 450 });
  assert.equal(Logic.manualTarget({ ...base, targetMode: 'bed_wake', targetWake: '23:00' }), null, 'zero sleep is invalid');
  assert.deepEqual(Logic.manualTarget({ ...base, targetMode: 'bed_wake', targetBed: '01:00', targetWake: '09:00' }).targetMin, 300);
});

test('targetFor prefers records, falls back to the manual target, else null', () => {
  const S = { avgDays: 7, targetMode: 'bed_wake', targetBed: '23:00', targetWake: '06:00', targetSleepMin: 420 };
  const r = (id, bedAt, wakeAt) => ({ id, bedAt, wakeAt, createdAt: '' });
  const two = [r('a', '2026-10-25T23:30', '2026-10-26T06:30'), r('b', '2026-10-26T23:30', '2026-10-27T06:30')];
  const t2 = Logic.targetFor(two, S, '2026-10-27');
  assert.equal(t2.source, 'records'); assert.equal(t2.targetMin, 180); assert.equal(t2.count, 2);
  const t1 = Logic.targetFor(two.slice(0, 1), S, '2026-10-27');
  assert.deepEqual(t1, { targetMin: 150, sdMin: null, avgSleepMin: null, count: 1, source: 'manual' });
  const t0 = Logic.targetFor([], { ...S, targetMode: '' }, '2026-10-27');
  assert.deepEqual(t0, { targetMin: null, sdMin: null, avgSleepMin: null, count: 0, source: null });
  const sleeping = [...two, r('c', '2026-10-27T23:00', null)];
  assert.equal(Logic.targetFor(sleeping, S, '2026-10-27').source, 'records', 'open record does not count');
});
