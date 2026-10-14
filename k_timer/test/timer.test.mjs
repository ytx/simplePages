import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));
const T0 = Date.UTC(2026, 9, 14, 5, 0, 0); // 2026-10-14 14:00:00 JST
const MIN = 60000;

test('initialState: idle with preset as start and remaining; clamped to MAX_MS', () => {
  assert.deepEqual(Logic.initialState(5), { phase: 'idle', startMs: 5 * MIN, remainingMs: 5 * MIN, endAt: null });
  assert.equal(Logic.initialState(999).startMs, Logic.MAX_MS);
});

test('start from idle runs with endAt = now + remaining; start again pauses with the live remaining', () => {
  const s0 = Logic.initialState(5);
  const s1 = Logic.start(s0, T0);
  assert.deepEqual(s1, { phase: 'running', startMs: 5 * MIN, remainingMs: 5 * MIN, endAt: T0 + 5 * MIN });
  const s2 = Logic.start(s1, T0 + 90 * 1000);
  assert.deepEqual(s2, { phase: 'paused', startMs: 5 * MIN, remainingMs: 5 * MIN - 90 * 1000, endAt: null });
  const s3 = Logic.start(s2, T0 + 100 * 1000);
  assert.equal(s3.phase, 'running');
  assert.equal(s3.endAt, T0 + 100 * 1000 + 5 * MIN - 90 * 1000);
  assert.notEqual(s1, s0, 'returns a new object');
});

test('start with 0 remaining stays idle', () => {
  const s = Logic.adjust(Logic.initialState(5), -10 * MIN, T0);
  assert.equal(s.remainingMs, 0);
  assert.equal(Logic.start(s, T0), s);
});

test('reset returns to idle with the start value from any phase', () => {
  const idle = Logic.initialState(5);
  const running = Logic.start(idle, T0);
  const paused = Logic.start(running, T0 + 1000);
  const alarm = Logic.tick(running, T0 + 5 * MIN);
  for (const s of [idle, running, paused, alarm]) {
    assert.deepEqual(Logic.reset(s), { phase: 'idle', startMs: 5 * MIN, remainingMs: 5 * MIN, endAt: null });
  }
});

test('preset sets start and remaining, stops a running timer, silences an alarm', () => {
  const running = Logic.start(Logic.initialState(5), T0);
  assert.deepEqual(Logic.preset(running, 12), { phase: 'idle', startMs: 12 * MIN, remainingMs: 12 * MIN, endAt: null });
  const alarm = Logic.tick(running, T0 + 5 * MIN);
  assert.equal(Logic.preset(alarm, 3).phase, 'idle');
});

test('adjust while idle/paused moves remaining AND start, clamped to [0, MAX_MS]', () => {
  const s = Logic.initialState(5);
  assert.deepEqual(Logic.adjust(s, 30000, T0), { phase: 'idle', startMs: 5 * MIN + 30000, remainingMs: 5 * MIN + 30000, endAt: null });
  assert.equal(Logic.adjust(s, -10 * MIN, T0).remainingMs, 0);
  assert.equal(Logic.adjust(Logic.initialState(175), 10 * MIN, T0).remainingMs, Logic.MAX_MS);
  const paused = Logic.start(Logic.start(s, T0), T0 + 1000);
  const adj = Logic.adjust(paused, MIN, T0 + 2000);
  assert.equal(adj.phase, 'paused');
  assert.equal(adj.remainingMs, paused.remainingMs + MIN);
  assert.equal(adj.startMs, adj.remainingMs);
});

test('adjust while running moves endAt only; startMs unchanged; clamped to now + MAX_MS', () => {
  const running = Logic.start(Logic.initialState(5), T0);
  const later = Logic.adjust(running, MIN, T0 + 1000);
  assert.equal(later.endAt, T0 + 6 * MIN);
  assert.equal(later.startMs, 5 * MIN);
  assert.equal(later.phase, 'running');
  const capped = Logic.adjust(Logic.start(Logic.initialState(175), T0), 10 * MIN, T0 + 1000);
  assert.equal(capped.endAt, T0 + 1000 + Logic.MAX_MS);
});

test('adjust while running to zero or below -> alarm with endAt = now', () => {
  const running = Logic.start(Logic.initialState(5), T0);
  const a = Logic.adjust(running, -10 * MIN, T0 + 1000);
  assert.equal(a.phase, 'alarm');
  assert.equal(a.endAt, T0 + 1000);
});

test('adjust and zero are ignored during alarm', () => {
  const alarm = Logic.tick(Logic.start(Logic.initialState(1), T0), T0 + MIN);
  assert.equal(Logic.adjust(alarm, MIN, T0 + MIN + 5000), alarm);
  assert.equal(Logic.zero(alarm, T0 + MIN + 5000), alarm);
});

test('zero while idle truncates remaining (and start) to whole minutes', () => {
  const s = Logic.adjust(Logic.initialState(4), 37 * 1000, T0); // 4:37
  const z = Logic.zero(s, T0);
  assert.equal(z.remainingMs, 4 * MIN);
  assert.equal(z.startMs, 4 * MIN);
  assert.equal(Logic.zero(z, T0).remainingMs, 4 * MIN, 'already on :00 -> unchanged');
});

test('zero while running floors endAt to the minute in local time', () => {
  // endAt 14:32:37 JST
  const endAt = Date.UTC(2026, 9, 14, 5, 32, 37);
  const running = { phase: 'running', startMs: 5 * MIN, remainingMs: 5 * MIN, endAt };
  const z = Logic.zero(running, T0);
  assert.equal(z.endAt, Date.UTC(2026, 9, 14, 5, 32, 0));
  assert.equal(z.startMs, 5 * MIN);
  const already = { ...running, endAt: Date.UTC(2026, 9, 14, 5, 32, 0) };
  assert.deepEqual(Logic.zero(already, T0), already);
});

test('zero while running that lands at or before now -> alarm', () => {
  const endAt = T0 + 20 * 1000; // 14:00:20 -> floors to 14:00:00 = T0
  const running = { phase: 'running', startMs: MIN, remainingMs: MIN, endAt };
  const z = Logic.zero(running, T0 + 5000);
  assert.equal(z.phase, 'alarm');
  assert.equal(z.endAt, T0 + 5000);
});

test('tick: running -> alarm at endAt, otherwise unchanged; alarm/idle/paused untouched', () => {
  const running = Logic.start(Logic.initialState(1), T0);
  assert.equal(Logic.tick(running, T0 + MIN - 1), running);
  const alarm = Logic.tick(running, T0 + MIN);
  assert.equal(alarm.phase, 'alarm');
  assert.equal(alarm.endAt, T0 + MIN);
  assert.equal(Logic.tick(alarm, T0 + 2 * MIN), alarm);
  const idle = Logic.initialState(1);
  assert.equal(Logic.tick(idle, T0), idle);
});

test('start during alarm silences and returns to idle with the start value', () => {
  const alarm = Logic.tick(Logic.start(Logic.initialState(3), T0), T0 + 3 * MIN);
  assert.deepEqual(Logic.start(alarm, T0 + 4 * MIN), { phase: 'idle', startMs: 3 * MIN, remainingMs: 3 * MIN, endAt: null });
});

test('remainingFor: stored value when idle/paused, endAt - now when running (negative in alarm)', () => {
  const idle = Logic.initialState(2);
  assert.equal(Logic.remainingFor(idle, T0), 2 * MIN);
  const running = Logic.start(idle, T0);
  assert.equal(Logic.remainingFor(running, T0 + 30000), 2 * MIN - 30000);
  const alarm = Logic.tick(running, T0 + 2 * MIN);
  assert.equal(Logic.remainingFor(alarm, T0 + 2 * MIN + 42000), -42000);
});
