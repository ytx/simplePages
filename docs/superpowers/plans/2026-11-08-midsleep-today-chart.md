# midsleep Today Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rearrange the midsleep today tab (sleep button top-right, texts pushed to the outer edges, tiles always 50:50) and draw a 7-day chart across the night/morning boundary where the boundary is the target mid-sleep time and a red polyline shows the measured mid-sleep times.

**Architecture:** `Logic.todayChart(records, today, targetMin, days)` returns normalized coordinates (0–1); `App` draws them into `svg#today-chart` with `createElementNS`, positioned absolutely over `#tab-today`. CSS changes the tile alignment and removes the 70:30 sleeping ratio.

**Tech Stack:** Vanilla HTML/CSS/JS, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-19-midsleep-design.md`, section 「今日タブの改訂(2026-11-08)」 (authority for this plan) plus the existing 今日タブ sections for everything it does not change.

## Global Constraints

- No `innerHTML`; `textContent`; SVG via `createElementNS` (namespace from the svg element); no emoji; no bold outside `@font-face` and `.tile-big`; only `Logic`/`App` globals; i18n ja/en identical key sets and every `tr('…')` literal exists.
- Tiles always `flex: 5 1 0` each (remove the `data-state="sleeping"` flex overrides; keep the `--tile-night-deep` background override).
- Chart geometry: `y = round6(0.5 + rel / (2 * half))` (6 decimals), `half = max(240, ceil(maxAbs / 60) * 60)` where `maxAbs` = max over drawn records of `|bedRel|`, `|wakeRel|`; `rel = Logic.circularDiff(Logic.minutesOfDay(t), targetMin)`; mid via `Logic.midMinutes(bedAt, wakeAt)`; columns are wake dates `today−(days−1)` … `today` (x = 0 … days−1); naps (`Logic.isNap`) and open records excluded; segments connect points whose columns are consecutive (`x2 === x1 + 1`); ticks every 60 min from `−half` to `+half` excluding 0, labels (`'-4h'`, `'-2h'`, `'+2h'`, `'+4h'` — ASCII `-`/`+`, `h`) only where `rel % 120 === 0`; `targetMin === null` → `null`.
- Tests: `node --test midsleep/test/*.test.mjs` (glob form). `process.env.TZ = 'Asia/Tokyo'` in test files touching `Date`.
- Commit footer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. A day with a record whose bed is after the target mid (bedRel positive, e.g. bed 4:00 with target 3:00): bar drawn as given, no crash, axis still includes it (Task 1 test `late bed`).
2. Sleeping state keeps 50:50 and the chart still shows the last 7 completed nights while the stale card (if any) stays readable above the chart (Task 2 CSS stacking).
3. No target (`source: null`): no `<svg>` content, texts unchanged, no errors (Task 2).
4. Zoom 200 on 375×667: night texts, chart band and morning texts must not overlap each other; the chart band is sized from the pane, not from font size (Task 2 CSS, measured in the browser).
5. Records on only one of two adjacent days → a lone point without a segment; two adjacent days → one segment (Task 1 `segments` test).

---

### Task 1: `Logic.todayChart`

**Files:**
- Modify: `midsleep/index.html` (`app-logic`, export list)
- Modify: `midsleep/test/chart.test.mjs`

**Interfaces:**
- Produces `Logic.todayChart(records, today, targetMin, days = 7)` → `{ half, cols: [{ x, date, label }], bars: [{ x, yBed, yWake }], points: [{ x, y }], segments: [[i, j]], ticks: [{ y, rel, label }] } | null`. `segments` holds index pairs into `points`.

- [ ] **Step 1: Tests** (append to `chart.test.mjs`; `R = (id, bedAt, wakeAt) => ({ id, bedAt, wakeAt, createdAt: '' })`, today `'2026-11-08'`, target 180 = 3:00)

```js
test('todayChart: columns, bars, points, segments, ticks', () => {
  const recs = [
    R('a', '2026-11-01T23:00', '2026-11-02T06:30'),   // x0: bedRel -240, wakeRel 210, mid 2:45 → -15
    R('b', '2026-11-03T00:30', '2026-11-03T07:00'),   // x1: -150, 240, mid 3:45 → +45
    R('nap', '2026-11-04T14:00', '2026-11-04T15:00'), // nap, excluded
    R('c', '2026-11-05T22:00', '2026-11-06T05:00'),   // x4: -300, 120, mid 1:30 → -90
    R('open', '2026-11-07T23:00', null),               // open, excluded
  ];
  const m = Logic.todayChart(recs, '2026-11-08', 180);
  assert.equal(m.half, 300);
  assert.deepEqual(m.cols.map((c) => [c.x, c.date, c.label]), [[0, '2026-11-02', '2'], [1, '2026-11-03', '3'], [2, '2026-11-04', '4'], [3, '2026-11-05', '5'], [4, '2026-11-06', '6'], [5, '2026-11-07', '7'], [6, '2026-11-08', '8']]);
  assert.deepEqual(m.bars, [{ x: 0, yBed: 0.1, yWake: 0.85 }, { x: 1, yBed: 0.25, yWake: 0.9 }, { x: 4, yBed: 0, yWake: 0.7 }]);
  assert.deepEqual(m.points, [{ x: 0, y: 0.475 }, { x: 1, y: 0.575 }, { x: 4, y: 0.35 }]);
  assert.deepEqual(m.segments, [[0, 1]]);
  assert.deepEqual(m.ticks.map((t) => [t.rel, t.y, t.label]), [[-300, 0, ''], [-240, 0.1, '-4h'], [-180, 0.2, ''], [-120, 0.3, '-2h'], [-60, 0.4, ''], [60, 0.6, ''], [120, 0.7, '+2h'], [180, 0.8, ''], [240, 0.9, '+4h'], [300, 1, '']]);
});
test('todayChart: empty, no target, late bed, custom days', () => {
  const e = Logic.todayChart([], '2026-11-08', 180);
  assert.equal(e.half, 240); assert.deepEqual(e.bars, []); assert.deepEqual(e.points, []); assert.deepEqual(e.segments, []);
  assert.deepEqual(e.ticks.map((t) => [t.rel, t.label]), [[-240, '-4h'], [-180, ''], [-120, '-2h'], [-60, ''], [60, ''], [120, '+2h'], [180, ''], [240, '+4h']]);
  assert.equal(Logic.todayChart([], '2026-11-08', null), null);
  const late = Logic.todayChart([R('l', '2026-11-08T04:00', '2026-11-08T10:00')], '2026-11-08', 180); // bedRel +60, wakeRel 420, mid 7:00 → +240
  assert.equal(late.half, 420);
  assert.deepEqual(late.bars, [{ x: 6, yBed: 0.571429, yWake: 1 }]);
  assert.deepEqual(late.points, [{ x: 6, y: 0.785714 }]);
  assert.equal(Logic.todayChart([], '2026-11-08', 180, 3).cols.length, 3);
});
```

(`todayChart` rounds every `y` to 6 decimals — `Math.round(v * 1e6) / 1e6` — so `0.5 + (-240) / 600` becomes exactly `0.1` and the expected values above compare equal with `assert.deepEqual`.)

- [ ] **Step 2: Run, expect fail** — [ ] **Step 3: Implement** next to `chartModel`, export — [ ] **Step 4: Full suite green** — [ ] **Step 5: Commit** `midsleep: todayChart model for the boundary chart`

### Task 2: Layout and chart rendering

**Files:**
- Modify: `midsleep/index.html` (markup, CSS, `renderToday`, i18n), `midsleep/test/page.test.mjs`

**Interfaces:**
- Consumes `Logic.todayChart`, `Logic.targetFor`, existing `renderToday` structure (`#today-date`, `#today-body`, `#btn-sleep`, `#today-foot`, `#morning-foot`, `#btn-wake`).
- Produces markup: in `#tile-night`, a first row `div.tile-head` containing `#today-date` and `#btn-sleep` (move the button out of `.tile-foot`; delete the night `.tile-foot`); `<svg id="today-chart" aria-hidden="true"></svg>` as the last child of `#tab-today`; i18n `target_label` ja `目標 {t}` / en `Target {t}`.

CSS (binding values):

```css
#tab-today.active { position: relative; }
.tile-night, .tile-morning { flex: 5 1 0; }           /* remove the sleeping 7/3 overrides */
.tile-head { display: flex; justify-content: space-between; align-items: center; gap: var(--gap); }
.tile-night .tile-main { justify-content: flex-start; }
.tile-morning .tile-main { justify-content: flex-end; }
.tile > * { position: relative; z-index: 1; }         /* text, buttons, cards above the chart */
#today-chart { position: absolute; left: calc(var(--gap) * 1.5); right: calc(var(--gap) * 1.5); top: 28%; height: 44%; pointer-events: none; z-index: 0; overflow: visible; }
#today-chart .bar-top { fill: rgba(255,255,255,0.35); } #today-chart .bar-bottom { fill: rgba(0,0,0,0.12); }
#today-chart .tick-top { stroke: rgba(255,255,255,0.25); } #today-chart .tick-bottom { stroke: rgba(0,0,0,0.12); }
#today-chart .mid-line { fill: none; stroke: #e45959; stroke-width: 2.5; stroke-linejoin: round; } #today-chart .mid-point { fill: #e45959; }
#today-chart text { font-size: 10px; } #today-chart .lbl-top { fill: rgba(255,255,255,0.8); } #today-chart .lbl-bottom { fill: rgba(0,0,0,0.55); }
```

Since `.tile` children get `z-index: 1`, the chart must be a sibling of the tiles inside `#tab-today` (not inside a tile) so the tile backgrounds stay below it: tiles themselves have no z-index (auto) and the svg `z-index: 0` paints above the tile backgrounds but below the tiles' positioned children.

- [ ] **Step 1: Page test** — `#tab-today` contains `id="today-chart"` as an `<svg>`; `btn-sleep` appears inside `.tile-head` together with `today-date`; no `flex: 7 1 0` anywhere; `target_label` in ja and en; CSS has `.tile-morning .tile-main { justify-content: flex-end` and `#today-chart`.
- [ ] **Step 2: Run, expect fail**
- [ ] **Step 3: Implement `drawTodayChart(model)`** in `app-ui`: clear the svg; use `viewBox="0 0 W H"` with `W = 700`, `H = 440` and `preserveAspectRatio="none"` so 0–1 coordinates map by multiplication (`xOf(col) = (col + 0.5) * W / days`, `yOf(y) = y * H`); bar width `W / days * 0.6`, `rx` 4; for each bar draw `rect.bar-top` from `yBed` to `0.5` (if `yBed < 0.5`) and `rect.bar-bottom` from `0.5` to `yWake` (if `yWake > 0.5`); a bar entirely on one side is drawn as one rect of that side's class; ticks as `line` from x = 0 to W with class by sign; tick labels at x = 2, `text-anchor: start`, baseline 4px above the line, class by sign; day labels at y = 10 for each col (`lbl-top`); the mid polyline as one `polyline.mid-line` per segment (points of the two indices) and `circle.mid-point` r 3.5 for every point; the target label `text` at x = W − 2, y = H/2 − 4, `text-anchor: end`, class `lbl-top`, text `tr('target_label', { t: Logic.formatHM(targetMin) })`. Text elements use `textContent`. `aria-hidden="true"` stays.
- [ ] **Step 4: Wire it** — in `renderToday`, after the tiles: `const st = Logic.targetFor(...)` (already there); `drawTodayChart(st.targetMin === null ? null : Logic.todayChart(data.records, Logic.todayStr(now), st.targetMin))`; `null` clears the svg. Move `btn-sleep` handling: it lives in `.tile-head` now, `hidden` toggling unchanged. Remove the night `.tile-foot` and the sleeping-state flex CSS. Keep the stale card, links and all texts as before (they are now top-aligned in the night tile, bottom-aligned in the morning tile). The redraw on `resize`/zoom is not needed (viewBox scales), but `renderToday` already runs on settings change.
- [ ] **Step 5: Full suite green**
- [ ] **Step 6: Browser check** (local server, Claude-in-Chrome or headless): seed 7 records around a 3:00 target with one late night and one gap day; verify awake layout (button top-right, texts at the edges, chart across the boundary, labels readable in light and dark theme, ja/en), sleeping layout (50:50, chart still visible, links under the sub), stale case (card above the chart), no-target case (empty svg), zoom 200 at 375×667 (no overlap of text and chart band: report bounding rects).
- [ ] **Step 7: Commit** — `midsleep: sleep button top-right, edge-aligned texts, 7-day boundary chart`

### Task 3: Docs

**Files:**
- Modify: `midsleep/README.md` (機能 今日タブ: button position, 50:50 always, the boundary chart and what the line/bars/ticks mean, 7 days fixed), `docs/superpowers/specs/2026-10-19-midsleep-design.md` (verify the 就寝中 diagram note points to the revision section; fix 「高さ 70%」 mentions by a one-line note if still present).

- [ ] **Step 1: Edit** — [ ] **Step 2: Run** `node --test midsleep/test/*.test.mjs`, commit `midsleep: README for the today chart`
