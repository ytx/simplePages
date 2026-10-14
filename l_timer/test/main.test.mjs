import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));
const MIN = 60000;
// 2026-10-15 13:00:00 local (TZ=Asia/Tokyo via load-logic)
const T0 = new Date(2026, 9, 15, 13, 0, 0).getTime();

function run(s, from, to, warning = 3, tick = 60, step = 250) {
  // simulate 250 ms ticks from `from` (exclusive) to `to` (inclusive); collect events
  const events = [];
  let state = s;
  for (let now = from + step; now <= to; now += step) {
    const r = Logic.tickMain(state, now, warning, tick);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

test('initialMain and ADJUST_STEPS', () => {
  assert.deepEqual(Logic.initialMain(), { mode: 'idle', breakType: null, startedAt: null, endAt: null, totalMs: 0, overtime: false, lastTickAt: null });
  assert.deepEqual(Logic.ADJUST_STEPS, [-10, -1, 1, 10]);
  assert.equal(Logic.remainingMain(Logic.initialMain(), T0), null);
});

test('startLecture / startBreak / stopMain', () => {
  const l = Logic.startLecture(Logic.initialMain(), T0, 50);
  assert.deepEqual(l, { mode: 'lecture', breakType: null, startedAt: T0, endAt: T0 + 50 * MIN, totalMs: 50 * MIN, overtime: false, lastTickAt: T0 });
  assert.equal(Logic.remainingMain(l, T0 + 10 * MIN), 40 * MIN);
  const b = Logic.startBreak(l, T0 + 5 * MIN, 2, 60);
  assert.equal(b.mode, 'break');
  assert.equal(b.breakType, 2);
  assert.equal(b.endAt, T0 + 65 * MIN);
  assert.equal(b.overtime, false);
  // break after overtime clears overtime
  const ot = { ...l, overtime: true };
  assert.equal(Logic.startBreak(ot, T0, 1, 10).overtime, false);
  assert.deepEqual(Logic.stopMain(b), Logic.initialMain());
  // startLecture during break ends the break
  assert.equal(Logic.startLecture(b, T0 + 6 * MIN, 50).mode, 'lecture');
  assert.equal(Logic.startLecture(b, T0 + 6 * MIN, 50).breakType, null);
});

test('floorToMinute drops seconds and milliseconds in local time', () => {
  assert.equal(Logic.floorToMinute(new Date(2026, 9, 15, 14, 40, 37, 123).getTime()), new Date(2026, 9, 15, 14, 40, 0, 0).getTime());
  assert.equal(Logic.floorToMinute(T0), T0);
});

test('adjustEnd floors to the minute and refuses a past end unless in overtime', () => {
  const l = Logic.startLecture(Logic.initialMain(), T0 + 37 * 1000, 50); // ends 13:50:37
  const a = Logic.adjustEnd(l, 1, T0 + MIN);
  assert.equal(a.endAt, new Date(2026, 9, 15, 13, 51, 0).getTime());
  assert.equal(a.totalMs, 50 * MIN, 'totalMs unchanged');
  assert.equal(Logic.adjustEnd(l, -10, T0 + 45 * MIN), l, 'would end in the past -> ignored');
  const idle = Logic.initialMain(); assert.equal(Logic.adjustEnd(idle, 1, T0), idle, 'idle ignored');
  // overtime: +1 that lands in the future returns to countdown
  const ot = { ...l, overtime: true };
  const back = Logic.adjustEnd(ot, 1, l.endAt + 20 * 1000); // now = 13:50:57, new end 13:51:00
  assert.equal(back.overtime, false);
  assert.equal(back.endAt, new Date(2026, 9, 15, 13, 51, 0).getTime());
  // overtime: -1 stays in the past and stays overtime
  const still = Logic.adjustEnd(ot, -1, l.endAt + 20 * 1000);
  assert.equal(still.overtime, true);
  assert.equal(still.endAt, new Date(2026, 9, 15, 13, 49, 0).getTime());
  // break never goes to the past
  const b = Logic.startBreak(Logic.initialMain(), T0, 1, 10);
  assert.equal(Logic.adjustEnd(b, -10, T0 + MIN), b);
});

test('lecture: warning once at 3 min, end once at 0, tick every 60 s in overtime', () => {
  const l = Logic.startLecture(Logic.initialMain(), T0, 5);
  const { state, events } = run(l, T0, T0 + 7 * MIN + 500);
  assert.deepEqual(events, ['warning', 'end', 'tick', 'tick']);
  assert.equal(state.overtime, true);
  assert.equal(state.mode, 'lecture');
  assert.equal(state.lastTickAt, T0 + 7 * MIN + 500);
});

test('a tick in idle changes nothing', () => {
  const r = Logic.tickMain(Logic.initialMain(), T0, 3, 60);
  assert.deepEqual(r, { state: Logic.initialMain(), events: [] });
});

test('background tab: one big jump fires end and tick once each, warning once', () => {
  const l = Logic.startLecture(Logic.initialMain(), T0, 5);
  const r = Logic.tickMain(l, T0 + 10 * MIN, 3, 60); // jumped 10 minutes
  assert.deepEqual(r.events, ['warning', 'end', 'tick']);
  const r2 = Logic.tickMain(r.state, T0 + 10 * MIN + 250, 3, 60);
  assert.deepEqual(r2.events, []);
  const r3 = Logic.tickMain(r2.state, T0 + 11 * MIN, 3, 60);
  assert.deepEqual(r3.events, ['tick']);
});

test('warning fires again after an extension and end fires again at the new end', () => {
  const l = Logic.startLecture(Logic.initialMain(), T0, 5);
  let r = run(l, T0, T0 + 2 * MIN + 30 * 1000); // past the 3-min warning
  assert.deepEqual(r.events, ['warning']);
  const ext = Logic.adjustEnd(r.state, 10, T0 + 2 * MIN + 30 * 1000); // ends 13:15:00
  r = run(ext, T0 + 2 * MIN + 30 * 1000, T0 + 15 * MIN + 500);
  assert.deepEqual(r.events, ['warning', 'end']);
});

test('no warning when the remaining time is already below the warning at start', () => {
  const b = Logic.startBreak(Logic.initialMain(), T0, 1, 2); // 2-min break, warning 3
  const r = run(b, T0, T0 + 2 * MIN + 500, 3, 60);
  assert.deepEqual(r.events, ['end', 'break_end']);
});

test('break: warning, then end + break_end; mode stays break; no ticks', () => {
  const b = Logic.startBreak(Logic.initialMain(), T0, 1, 10);
  const r = run(b, T0, T0 + 12 * MIN, 3, 60);
  assert.deepEqual(r.events, ['warning', 'end', 'break_end']);
  assert.equal(r.state.mode, 'break');
  assert.equal(r.state.overtime, false);
});

test('shortening into the past is refused, so end can never be skipped', () => {
  const l = Logic.startLecture(Logic.initialMain(), T0, 50);
  const r = run(l, T0, T0 + MIN);
  assert.equal(Logic.adjustEnd(r.state, -10, T0 + 45 * MIN), r.state);
});

test('thresholdEvents is exposed for the exercise timer', () => {
  assert.deepEqual(Logic.thresholdEvents(T0, T0 + 250, T0, T0 + 5 * MIN, 3, 60), { warning: false, end: false, tick: false });
  assert.deepEqual(Logic.thresholdEvents(T0 + 2 * MIN - 100, T0 + 2 * MIN, T0, T0 + 5 * MIN, 3, 60), { warning: true, end: false, tick: false });
  assert.deepEqual(Logic.thresholdEvents(T0 + 5 * MIN + 59 * 1000, T0 + 6 * MIN, T0, T0 + 5 * MIN, 3, 60), { warning: false, end: false, tick: true });
});
