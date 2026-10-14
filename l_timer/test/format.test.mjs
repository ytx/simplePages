import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));

test('formatClock: ceil while counting down, +MM:SS in overtime, 00:00 under one second over', () => {
  assert.equal(Logic.formatClock(0), '00:00');
  assert.equal(Logic.formatClock(999), '00:01');
  assert.equal(Logic.formatClock(59999), '01:00');
  assert.equal(Logic.formatClock(3000000), '50:00');
  assert.equal(Logic.formatClock(18000000), '300:00');
  assert.equal(Logic.formatClock(-500), '00:00');
  assert.equal(Logic.formatClock(-1500), '+00:01');
  assert.equal(Logic.formatClock(-61000), '+01:01');
});

test('formatMinutes', () => {
  assert.equal(Logic.formatMinutes(15), '15:00');
  assert.equal(Logic.formatMinutes(5), '05:00');
  assert.equal(Logic.formatMinutes(120), '120:00');
});

test('formatEndAt: local HH:MM:SS, placeholder for null', () => {
  assert.equal(Logic.formatEndAt(new Date(2026, 9, 15, 14, 5, 9).getTime()), '14:05:09');
  assert.equal(Logic.formatEndAt(null), '--:--:--');
  assert.equal(Logic.formatEndAt(undefined), '--:--:--');
});

test('progress: 0..100, overtime is 100, no total is 0', () => {
  assert.equal(Logic.progress(600000, 600000), 0);
  assert.equal(Logic.progress(600000, 300000), 50);
  assert.equal(Logic.progress(600000, 0), 100);
  assert.equal(Logic.progress(600000, -5000), 100);
  assert.equal(Logic.progress(600000, 700000), 0, 'extended past the original total clamps to 0');
  assert.equal(Logic.progress(0, 0), 0);
  assert.equal(Logic.progress(0, null), 0);
});

test('stepEditorZoom walks the level list and stops at the ends', () => {
  assert.equal(Logic.stepEditorZoom(100, 1), 150);
  assert.equal(Logic.stepEditorZoom(100, -1), 75);
  assert.equal(Logic.stepEditorZoom(400, 1), 400);
  assert.equal(Logic.stepEditorZoom(75, -1), 75);
  assert.equal(Logic.stepEditorZoom(300, -1), 200);
  assert.equal(Logic.stepEditorZoom(125, 1), 150, 'unknown level snaps to the nearest first');
  assert.equal(Logic.stepEditorZoom('abc', 1), 150);
});
