# midsleep Initial Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a new user enter two of {bedtime, wake time, sleep length} on first open so midsleep shows a target mid-sleep time from day one; once two real records exist the manual target is no longer used.

**Architecture:** `Logic` gains `manualTarget(settings)` and `targetFor(records, settings, today)`; every place that needs the target reads `targetFor` instead of `stats`. `App` gains one sheet (`openTargetSheet`) reused by the first-open prompt, the today-tab link and the settings row. Four new settings keys, all display-only.

**Tech Stack:** Vanilla HTML/CSS/JS, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-19-midsleep-design.md`, section 「初期目標(導入時の手入力。2026-10-28 追加)」 (lines 194–240) plus the Logic table rows for `manualTarget` / `targetFor`. The spec is the authority.

## Global Constraints

- One page `midsleep/index.html`; no `innerHTML`; `textContent` only; no emoji; no bold outside `@font-face` and `.tile-big`; only `Logic`/`App` globals.
- i18n: `Logic.I18N.ja` / `.en` identical key sets; every `tr('…')` literal exists (page test enforces). Times via `Logic.formatHM` (`H:MM`), durations via `Logic.formatDuration`.
- New settings keys (exact): `targetMode` enum `['', 'bed_wake', 'bed_sleep', 'wake_sleep']` default `''`; `targetBed` string default `'23:00'`; `targetWake` string default `'06:00'`; `targetSleepMin` int 240–720 default 420. All in `DISPLAY_ONLY_KEYS`. `fixupSettings` resets non-`HH:MM` `targetBed` / `targetWake` to their defaults (same rule as `wakeTarget`).
- Minute arithmetic on a 1440-minute ring: `sleep = ((wake − bed) % 1440 + 1440) % 1440`, 0 means invalid; `mid = (bed + round(sleep / 2)) mod 1440`.
- Tap targets ≥ 44px; inputs `font-size: max(16px, …)`; `input type="time"` gets `step="300"`.
- Tests: `node --test midsleep/test/*.test.mjs` (glob form). `process.env.TZ = 'Asia/Tokyo'` in test files that touch `Date`.
- Commit footer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. A user with 2+ real records who never saw the prompt: the sheet must never auto-open, and the manual values (if any) must not affect the target (Task 1 `targetFor` test; Task 2 init condition).
2. Deleting records back below 2 must fall back to the manual target, and `--:--` only when neither exists (Task 1 test, Task 2 render).
3. `bed_wake` with bed 23:00 / wake 23:00 (sleep 0): sheet save disabled with the message; `manualTarget` returns null (Task 1 test, Task 2 validate).
4. Saving `wake_sleep` or `bed_wake` must update `wakeTarget`; saving `bed_sleep` must leave it alone (Task 2 handler + settings test on `fixupSettings` only; UI behavior checked in the browser).
5. Clear-all must remove `simplePages.midsleep.targetAsked` so the prompt returns for a fresh start (Task 2).

---

### Task 1: Logic — settings keys, `manualTarget`, `targetFor`

**Files:**
- Modify: `midsleep/index.html` (`app-logic`: `SCHEMA`, `fixupSettings`, new functions, export list; `app-ui`: `DISPLAY_ONLY_KEYS`)
- Modify: `midsleep/test/settings.test.mjs`, `midsleep/test/stats.test.mjs`

**Interfaces:**
- Produces `Logic.manualTarget(settings) → { targetMin, bedMin, wakeMin, sleepMin } | null`.
- Produces `Logic.targetFor(records, settings, today) → { targetMin, sdMin, avgSleepMin, count, source: 'records' | 'manual' | null }` (window = `settings.avgDays`).

- [ ] **Step 1: Tests** — in `settings.test.mjs` extend the key list to `['avgDays', 'chartDays', 'lang', 'minSleepMin', 'staleHours', 'targetBed', 'targetMode', 'targetSleepMin', 'targetWake', 'theme', 'wakeTarget', 'zoom']` (all display-only), add defaults `targetMode: ''`, `targetBed: '23:00'`, `targetWake: '06:00'`, `targetSleepMin: 420`, and extend the `HH:MM` test so `targetBed: '25:00'` → `'23:00'` and `targetWake: 'x'` → `'06:00'`. Append to `stats.test.mjs`:

```js
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
```

- [ ] **Step 2: Run, expect failures** — `node --test midsleep/test/settings.test.mjs midsleep/test/stats.test.mjs`
- [ ] **Step 3: Implement** — add the four `SCHEMA` entries after `staleHours`; `fixupSettings` validates `targetBed` / `targetWake` like `wakeTarget`; add `manualTarget` and `targetFor` next to `stats` (reuse `stats` for the records branch); export both; add the four keys to `DISPLAY_ONLY_KEYS`.
- [ ] **Step 4: Full suite green** — `node --test midsleep/test/*.test.mjs`
- [ ] **Step 5: Commit** — `midsleep: manualTarget and targetFor with initial-target settings keys`

### Task 2: Target sheet, first-open prompt, today/history/settings display

**Files:**
- Modify: `midsleep/index.html` (`app-ui`, settings markup, i18n, CSS)
- Modify: `midsleep/test/page.test.mjs`

**Interfaces:**
- Consumes `Logic.manualTarget`, `Logic.targetFor`, `openSheet({ title, build, validate, onOk })`, `updateSettings(patch)`, `renderAll()`, `tr`, `el`, `$`.
- Produces `openTargetSheet()` in `App` scope; `#btn-target` link on the today tab; settings row `#target-summary` + `#target-edit` + `#target-clear`; localStorage key `simplePages.midsleep.targetAsked`.

i18n (ja / en):

| key | ja | en |
|---|---|---|
| `target_title` | `目標の中央時刻を決める` | `Set your target mid-sleep time` |
| `target_intro` | `3 つのうち 2 つを入れると、最初の目標ができます。記録が 2 回たまったら記録の平均に切り替わります` | `Enter two of the three and you get a first target. After two recorded nights the average of your records takes over` |
| `mode_bed_wake` | `寝る時刻と起きる時刻` | `Bed and wake times` |
| `mode_bed_sleep` | `寝る時刻と睡眠時間` | `Bed time and sleep length` |
| `mode_wake_sleep` | `起きる時刻と睡眠時間` | `Wake time and sleep length` |
| `label_target_bed` | `寝る時刻` | `Bed time` |
| `label_target_wake` | `起きる時刻` | `Wake time` |
| `label_target_sleep` | `睡眠時間` | `Sleep length` |
| `target_preview` | `中央時刻 {m} ・ 睡眠 {d}` | `Mid {m} · sleep {d}` |
| `err_same_time` | `寝る時刻と起きる時刻が同じです` | `Bed and wake times are the same` |
| `later` | `あとで` | `Later` |
| `set_target` | `目標を決める` | `Set a target` |
| `target_src_manual` | `(設定から)` | `(from settings)` |
| `target_src_records` | `(直近 {d} 日)` | `(last {d} days)` |
| `history_stats_manual` | `目標 {t}(設定から) · 記録 {n} 件` | `Target {t} (from settings) · {n} records` |
| `initial_target` | `初期目標` | `Initial target` |
| `target_none` | `なし` | `None` |
| `target_summary_bed_wake` | `寝る {b} ・ 起きる {w} → 中央 {m}` | `Bed {b} · wake {w} → mid {m}` |
| `target_summary_bed_sleep` | `寝る {b} ・ 睡眠 {d} → 中央 {m}` | `Bed {b} · sleep {d} → mid {m}` |
| `target_summary_wake_sleep` | `起きる {w} ・ 睡眠 {d} → 中央 {m}` | `Wake {w} · sleep {d} → mid {m}` |
| `change` | `変更` | `Change` |
| `clear` | `消す` | `Clear` |

Change `tile_sleep_mid` to `'睡眠 {d} ・ 中央 {m}{src}'` / `'Sleep {d} · mid {m}{src}'` (callers pass `src` = `' ' + tr('target_src_manual')` or `' ' + tr('target_src_records', { d: settings.avgDays })`).

Markup: in `data-section="calc"` after the `staleHours` field:

```html
<div class="field">
  <span data-i18n="initial_target"></span>
  <div><span id="target-summary"></span>
    <div class="row"><button type="button" class="btn" id="target-edit" data-i18n="change"></button><button type="button" class="btn" id="target-clear" data-i18n="clear"></button></div></div>
</div>
```

- [ ] **Step 1: Page test** — add to `page.test.mjs`: ids `target-summary`, `target-edit`, `target-clear` exist inside `data-section="calc"`; `btn-target` appears in the `app-ui` script; every key in the table above exists in ja and en; `/targetAsked/` appears in the source; the `data-clear` handler removes it (`assert.match(ui[1], /removeItem\('simplePages\.midsleep\.targetAsked'\)/)` or via a constant — the test checks the literal string appears exactly twice: once as the constant, once is fine too; keep it simple: `assert.match(src, /simplePages\.midsleep\.targetAsked/)`).
- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement `openTargetSheet()`** per spec 「入力」: `openSheet({ title: tr('target_title'), okLabel: 'save', build, validate, onOk })`; body = intro paragraph (`.sheet-label`), a 3-button `toggle-row` radiogroup for the mode (initial = `settings.targetMode || 'bed_wake'`), the two relevant inputs (`input type="time" step="300"` for bed/wake with values from settings; `select` 240…720 step 15 labelled with `formatDuration` for sleep), and a preview line updated on every `input`/`change` via `Logic.manualTarget({ ...settings, targetMode, targetBed, targetWake, targetSleepMin })`. `validate` returns false (and shows `err_same_time`) when `manualTarget` is null. `onOk`: `updateSettings({ targetMode, targetBed, targetWake, targetSleepMin, ...(mode !== 'bed_sleep' ? { wakeTarget: targetWake } : {}) })`. Set the cancel button text to `tr('later')` while this sheet is open and restore `tr('cancel')` on close (or add a `cancelLabel` option to `openSheet`); cancel writes `targetAsked`.
- [ ] **Step 4: First-open prompt** — in `init`, after `renderAll()`: `if (!settings.targetMode && Logic.completed(data.records).length < 2 && !storage.getFlag('targetAsked')) openTargetSheet();` where the flag is read/written with try/catch around `localStorage` like `helpSeen` in time4u. Clear-all removes the flag.
- [ ] **Step 5: Use `targetFor` everywhere** — `renderToday`: replace `Logic.stats(...)` with `Logic.targetFor(data.records, settings, today)`; keep `st.count` for `tile_need_more`; add `src` to `tile_sleep_mid`; when `source === null` append `el('button', 'link-btn', tr('set_target'))` with id `btn-target` under the night sub (click → `openTargetSheet()`). `renderHistory`: `avg = Logic.targetFor(...)`; if `avg.source === 'manual'` show `history_stats_manual` `{ t, n: avg.count }`; chart target line uses `avg.targetMin`. Settings: `renderSettings` fills `#target-summary` from `manualTarget(settings)` (or `target_none`), `#target-edit` opens the sheet, `#target-clear` → `updateSettings({ targetMode: '' })`.
- [ ] **Step 6: Full suite green**; browser check: fresh profile (`localStorage.clear()`) → sheet opens automatically; 「あとで」 → closes, reload → does not reopen, today tile shows 「目標を決める」; set bed 23:00 + wake 6:00 → night tile 中央 2:30(設定から), stepper shows 6:00; add two records → source switches to (直近 7 日); settings row shows the summary; 消す → back to `--:--` + link; clear-all → prompt returns.
- [ ] **Step 7: Commit** — `midsleep: initial target sheet on first open, targetFor in today/history/settings`

### Task 3: Docs

**Files:**
- Modify: `midsleep/README.md` (機能: first-open target; 設定項目 table: four keys; データ形式: `targetAsked` key), spec 「設定」 table already updated by the spec section (verify), `CLAUDE.md` unchanged.

- [ ] **Step 1: Edit README** — describe the first-open sheet (two of three, 3 modes), that it is used only until two records exist, the settings row (変更 / 消す), and the `simplePages.midsleep.targetAsked` flag cleared by 全消去.
- [ ] **Step 2: Run** `node --test midsleep/test/*.test.mjs` and commit — `midsleep: README for the initial target`
