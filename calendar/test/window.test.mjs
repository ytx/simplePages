// calendar/test/window.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';
const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));
const gas = readFileSync(new URL('../gas/Code.gs', import.meta.url), 'utf8');
const MAX_DAYS = Number(/const MAX_DAYS = (\d+);/.exec(gas)[1]);
const days = (w) => Math.round((w.to - w.from) / Logic.DAY_MS);

test('every requested window fits within the GAS MAX_DAYS', () => {
  for (const view of ['day', 'week', 'month']) {
    for (const weekStart of [0, 1]) {
      for (let m = 0; m < 12; m++) {
        for (const day of [1, 15]) {
          const anchor = new Date(2026, m, day);
          const w = Logic.windowFor(Logic.rangeForView(view, anchor, weekStart));
          assert.ok(days(w) <= MAX_DAYS, `${view} ws=${weekStart} ${anchor.toDateString()}: ${days(w)} > ${MAX_DAYS}`);
        }
      }
    }
  }
});

test('month window is 104 days (42 + 31 * 2)', () => {
  const w = Logic.windowFor(Logic.rangeForView('month', new Date(2026, 9, 13), 0));
  assert.equal(days(w), 104);
});
