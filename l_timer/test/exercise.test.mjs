import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));
const MIN = 60000;
const T0 = new Date(2026, 9, 15, 13, 0, 0).getTime();

function run(e, from, to, warning = 3, tick = 60, step = 250) {
  const events = [];
  let state = e;
  for (let now = from + step; now <= to; now += step) {
    const r = Logic.tickExercise(state, now, warning, tick);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

test('initialExercise, setup panel', () => {
  const e = Logic.initialExercise(15, 10);
  assert.deepEqual(e, { phase: 'none', title: '', setupMinutes: 15, startedAt: null, endAt: null, totalMs: 0, remainingMs: null, overtime: false, lastTickAt: null, next: [{ title: '', minutes: 10 }], nextOpen: false });
  assert.equal(Logic.remainingExercise(e, T0), null);
  const s = Logic.exerciseOpenSetup(e, 20);
  assert.equal(s.phase, 'setup');
  assert.equal(s.setupMinutes, 20);
  assert.equal(Logic.exerciseAdjustSetup(s, -10).setupMinutes, 10);
  assert.equal(Logic.exerciseAdjustSetup(s, -30).setupMinutes, 1);
  assert.equal(Logic.exerciseAdjustSetup(s, 200).setupMinutes, 120);
  assert.equal(Logic.exerciseCancelSetup(s).phase, 'none');
  assert.equal(Logic.EXERCISE_MIN, 1);
  assert.equal(Logic.EXERCISE_MAX, 120);
});

test('exerciseStart trims the title, defaults it, resets next', () => {
  const e = Logic.exerciseOpenSetup(Logic.initialExercise(15, 15), 15);
  const r = Logic.exerciseStart(e, T0, '  演習1 ', 10, 20);
  assert.equal(r.phase, 'running');
  assert.equal(r.title, '演習1');
  assert.equal(r.endAt, T0 + 10 * MIN);
  assert.equal(r.totalMs, 10 * MIN);
  assert.equal(r.startedAt, T0);
  assert.equal(r.lastTickAt, T0);
  assert.deepEqual(r.next, [{ title: '', minutes: 20 }]);
  assert.equal(r.nextOpen, false);
  assert.equal(Logic.exerciseStart(e, T0, '   ', 10, 15).title, '', 'untitled is stored as empty; the UI shows a localized default');
  assert.equal(Logic.DEFAULT_EXERCISE_TITLE, undefined);
  assert.equal(Logic.remainingExercise(r, T0 + MIN), 9 * MIN);
});

test('exerciseStop returns to none and keeps the next defaults', () => {
  const r = Logic.exerciseStart(Logic.initialExercise(15, 15), T0, 'a', 10, 15);
  const s = Logic.exerciseStop(r);
  assert.equal(s.phase, 'none');
  assert.equal(s.endAt, null);
  assert.equal(s.overtime, false);
  assert.equal(s.remainingMs, null);
});

test('running: warning, end, then overtime ticks when no next exercise is set', () => {
  const r = Logic.exerciseStart(Logic.initialExercise(15, 15), T0, 'a', 5, 15);
  const { state, events } = run(r, T0, T0 + 7 * MIN + 500);
  assert.deepEqual(events, ['warning', 'end', 'tick', 'tick']);
  assert.equal(state.overtime, true);
  assert.equal(state.phase, 'running');
});

test('running: end with a next exercise set starts it immediately', () => {
  let r = Logic.exerciseStart(Logic.initialExercise(15, 15), T0, 'a', 5, 15);
  r = Logic.exerciseSetNext(r, 0, 'b', 7);
  const pre = run(r, T0, T0 + 4 * MIN);
  assert.deepEqual(pre.events, ['warning']);
  const res = Logic.tickExercise(pre.state, T0 + 5 * MIN, 3, 60);
  assert.deepEqual(res.events, ['end', 'next_started']);
  assert.equal(res.state.title, 'b');
  assert.equal(res.state.endAt, T0 + 12 * MIN);
  assert.equal(res.state.totalMs, 7 * MIN);
  assert.equal(res.state.overtime, false);
  assert.deepEqual(res.state.next, [{ title: '', minutes: 7 }]);
  assert.equal(res.state.nextOpen, false);
  // a whitespace-only next title does not count
  const r2 = run(Logic.exerciseSetNext(Logic.exerciseStart(Logic.initialExercise(15, 15), T0, 'a', 5, 15), 0, '  ', 7), T0, T0 + 4 * MIN).state;
  assert.deepEqual(Logic.tickExercise(r2, T0 + 5 * MIN, 3, 60).events, ['end']);
});

test('next exercise editing', () => {
  const r = Logic.exerciseStart(Logic.initialExercise(15, 15), T0, 'a', 5, 15);
  assert.equal(Logic.exerciseAdjustNext(r, 0, 10).next[0].minutes, 25);
  assert.equal(Logic.exerciseAdjustNext(r, 0, -20).next[0].minutes, 1);
  assert.equal(Logic.exerciseSetNext(r, 0, 'x', 500).next[0].minutes, 120);
  assert.equal(Logic.exerciseToggleNext(r, true).nextOpen, true);
  assert.equal(Logic.exerciseToggleNext(Logic.exerciseToggleNext(r, true), false).nextOpen, false);
  // out-of-range index leaves the state untouched
  assert.equal(Logic.exerciseSetNext(r, 3, 'x', 5), r);
  assert.equal(Logic.exerciseAdjustNext(r, -1, 5), r);
});

test('next exercise queue: add, edit by index, remove, never empty', () => {
  const r = Logic.exerciseStart(Logic.initialExercise(15, 15), T0, 'a', 5, 15);
  const a = Logic.exerciseAddNext(r, 10);
  assert.deepEqual(a.next, [{ title: '', minutes: 15 }, { title: '', minutes: 10 }]);
  const b = Logic.exerciseSetNext(Logic.exerciseSetNext(a, 0, 'b', 15), 1, 'c', 10);
  assert.deepEqual(Logic.exerciseAdjustNext(b, 1, 10).next[1], { title: 'c', minutes: 20 });
  assert.deepEqual(Logic.exerciseRemoveNext(b, 0).next, [{ title: 'c', minutes: 10 }]);
  // removing the only entry leaves a blank entry with the same minutes
  assert.deepEqual(Logic.exerciseRemoveNext(Logic.exerciseRemoveNext(b, 0), 0).next, [{ title: '', minutes: 10 }]);
  assert.equal(Logic.exerciseRemoveNext(b, 5), b);
  // the first entry's minutes become the next default after stop
  assert.deepEqual(Logic.exerciseStop(b).next, [{ title: '', minutes: 15 }]);
});

test('running: end with a queue starts the head and carries the rest, keeping the panel open', () => {
  let r = Logic.exerciseStart(Logic.initialExercise(15, 15), T0, 'a', 5, 15);
  r = Logic.exerciseSetNext(Logic.exerciseAddNext(r, 15), 0, 'b', 7);
  r = Logic.exerciseSetNext(r, 1, 'c', 3);
  r = Logic.exerciseToggleNext(r, false);
  const res = Logic.tickExercise({ ...r, lastTickAt: T0 + 4 * MIN }, T0 + 5 * MIN, 3, 60);
  assert.deepEqual(res.events, ['end', 'next_started']);
  assert.equal(res.state.title, 'b');
  assert.equal(res.state.endAt, T0 + 12 * MIN);
  assert.deepEqual(res.state.next, [{ title: 'c', minutes: 3 }]);
  assert.equal(res.state.nextOpen, true);
  const res2 = Logic.tickExercise({ ...res.state, lastTickAt: T0 + 11 * MIN }, T0 + 12 * MIN, 3, 60);
  assert.deepEqual(res2.events, ['end', 'next_started']);
  assert.equal(res2.state.title, 'c');
  assert.deepEqual(res2.state.next, [{ title: '', minutes: 3 }]);
  assert.equal(res2.state.nextOpen, false);
  // an empty head does not start even if a later entry has a title
  let q = Logic.exerciseStart(Logic.initialExercise(15, 15), T0, 'a', 5, 15);
  q = Logic.exerciseSetNext(Logic.exerciseAddNext(q, 15), 1, 'z', 3);
  assert.deepEqual(Logic.tickExercise({ ...q, lastTickAt: T0 + 4 * MIN }, T0 + 5 * MIN, 3, 60).events, ['end']);
});

test('exerciseAdjust while running: floor to minute, past refused unless overtime', () => {
  const r = Logic.exerciseStart(Logic.initialExercise(15, 15), T0 + 37 * 1000, 'a', 10, 15); // ends 13:10:37
  const a = Logic.exerciseAdjust(r, 1, T0 + MIN);
  assert.equal(a.endAt, new Date(2026, 9, 15, 13, 11, 0).getTime());
  assert.equal(Logic.exerciseAdjust(r, -10, T0 + 5 * MIN), r);
  const ot = { ...r, overtime: true };
  assert.equal(Logic.exerciseAdjust(ot, 1, r.endAt + 20 * 1000).overtime, false);
  assert.equal(Logic.exerciseAdjust(ot, -1, r.endAt + 20 * 1000).overtime, true);
  assert.equal(Logic.exerciseAdjust(Logic.initialExercise(15, 15), 1, T0).phase, 'none');
});

test('pause keeps the remaining time; resume continues from it', () => {
  const r = Logic.exerciseStart(Logic.initialExercise(15, 15), T0, 'a', 10, 15);
  const p = Logic.exercisePause(r, T0 + 4 * MIN);
  assert.equal(p.phase, 'paused');
  assert.equal(p.remainingMs, 6 * MIN);
  assert.equal(p.endAt, null);
  assert.equal(Logic.remainingExercise(p, T0 + 30 * MIN), 6 * MIN, 'frozen while paused');
  assert.deepEqual(Logic.tickExercise(p, T0 + 30 * MIN, 3, 60), { state: p, events: [] }, 'no events while paused');
  const res = Logic.exerciseResume(p, T0 + 30 * MIN);
  assert.equal(res.phase, 'running');
  assert.equal(res.endAt, T0 + 36 * MIN);
  assert.equal(res.remainingMs, null);
  assert.equal(res.lastTickAt, T0 + 30 * MIN);
  assert.equal(res.overtime, false);
  // warning fires once after resume at the new 3-min mark
  const { events } = run(res, T0 + 30 * MIN, T0 + 36 * MIN + 500);
  assert.deepEqual(events, ['warning', 'end']);
  assert.equal(Logic.exercisePause(p, T0), p, 'pause only from running');
  assert.equal(Logic.exerciseResume(r, T0), r, 'resume only from paused');
});

test('paused in overtime stays in overtime at the same value; end does not fire again', () => {
  const r = Logic.exerciseStart(Logic.initialExercise(15, 15), T0, 'a', 5, 15);
  const o = run(r, T0, T0 + 5 * MIN + 30 * 1000); // -0:30
  const p = Logic.exercisePause(o.state, T0 + 5 * MIN + 30 * 1000);
  assert.equal(p.remainingMs, -30 * 1000);
  const res = Logic.exerciseResume(p, T0 + 15 * MIN + 30 * 1000);
  assert.equal(res.overtime, true);
  assert.equal(Logic.remainingExercise(res, T0 + 15 * MIN + 30 * 1000), -30 * 1000);
  const after = run(res, T0 + 15 * MIN + 30 * 1000, T0 + 16 * MIN + 30 * 1000);
  assert.deepEqual(after.events, ['tick'], 'overtime tick resumes; no second end');
});

test('exerciseAdjust while paused changes remainingMs and the overtime flag', () => {
  const r = Logic.exerciseStart(Logic.initialExercise(15, 15), T0, 'a', 10, 15);
  const p = Logic.exercisePause(r, T0 + 9 * MIN + 30 * 1000); // 0:30 left
  const minus = Logic.exerciseAdjust(p, -1, T0 + 20 * MIN);
  assert.equal(minus.remainingMs, -30 * 1000);
  assert.equal(minus.overtime, true);
  const plus = Logic.exerciseAdjust(minus, 10, T0 + 20 * MIN);
  assert.equal(plus.remainingMs, 9 * MIN + 30 * 1000);
  assert.equal(plus.overtime, false);
});

test('canStartExercise, buttonVisibility, pageTitleKey', () => {
  const idle = Logic.initialMain();
  const lecture = Logic.startLecture(idle, T0, 50);
  const brk = Logic.startBreak(idle, T0, 1, 10);
  const none = Logic.initialExercise(15, 15);
  const running = Logic.exerciseStart(none, T0, 'a', 5, 15);
  assert.equal(Logic.canStartExercise(lecture, none), true);
  assert.equal(Logic.canStartExercise({ ...lecture, overtime: true }, none), true);
  assert.equal(Logic.canStartExercise(lecture, running), false);
  assert.equal(Logic.canStartExercise(idle, none), false);
  assert.equal(Logic.canStartExercise(brk, none), false);
  assert.deepEqual(Logic.buttonVisibility(idle, none), { lecture: true, lectureFromBreak: false, break1: true, break2: true, stop: false, exercise: false });
  assert.deepEqual(Logic.buttonVisibility(lecture, none), { lecture: false, lectureFromBreak: false, break1: true, break2: true, stop: true, exercise: true });
  assert.deepEqual(Logic.buttonVisibility(lecture, running), { lecture: false, lectureFromBreak: false, break1: true, break2: true, stop: true, exercise: false }, 'lecture buttons stay during an exercise');
  assert.deepEqual(Logic.buttonVisibility(brk, Logic.exercisePause(running, T0)), { lecture: false, lectureFromBreak: true, break1: false, break2: false, stop: true, exercise: false });
  assert.equal(Logic.pageTitleKey(idle), 'title_idle');
  assert.equal(Logic.pageTitleKey(lecture), 'title_lecture');
  assert.equal(Logic.pageTitleKey({ ...lecture, overtime: true }), 'title_overtime');
  assert.equal(Logic.pageTitleKey(brk), 'title_break');
});

test('addTitle: dedupe, newest first, cap at 20, skip empty and the default title', () => {
  assert.equal(Logic.MAX_TITLES, 20);
  assert.deepEqual(Logic.addTitle([], ' 演習1 '), ['演習1']);
  assert.deepEqual(Logic.addTitle(['a', 'b'], 'b'), ['b', 'a']);
  assert.deepEqual(Logic.addTitle(['a'], ''), ['a']);
  assert.deepEqual(Logic.addTitle(['a'], '   '), ['a']);
  assert.deepEqual(Logic.addTitle(['a'], '演習'), ['演習', 'a'], 'a typed title is remembered even if it equals the old default');
  const many = Array.from({ length: 20 }, (_, i) => `t${i}`);
  const r = Logic.addTitle(many, 'new');
  assert.equal(r.length, 20);
  assert.equal(r[0], 'new');
  assert.equal(r[19], 't18');
  const list = ['a'];
  Logic.addTitle(list, 'b');
  assert.deepEqual(list, ['a'], 'input not mutated');
});
