# midsleep Today Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the today tab of `midsleep/index.html` with the "night tile / morning tile" layout from the revised spec, using the bundled Zen Maru Gothic font, without changing any calculation.

**Architecture:** `Logic` gains two tiny pure helpers (`durationParts`, `midOf`); everything else is CSS tokens, markup inside `#tab-today`, and a rewritten `renderToday()`. The bundled font files already exist in `midsleep/fonts/zen-maru-gothic/` (commit `9b4a625`); the generated `@font-face` block to paste is at `.superpowers/sdd-input/font-faces.css` (1863 lines, git-ignored).

**Tech Stack:** Vanilla HTML/CSS/JS, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-19-midsleep-design.md`, section 「今日タブ」 (lines 74–145). It is the authority. The previous plan `docs/superpowers/plans/2026-10-19-midsleep.md` describes the code that exists now.

## Global Constraints

- One page = `midsleep/index.html`. Same-directory font files are allowed (`fonts/zen-maru-gothic/*.woff2`, `url(fonts/...)` in `@font-face` only). No other external resources.
- Only two globals `Logic` / `App`. No `innerHTML`. Strings via `textContent`. No emoji. Icons = inline `<symbol>` + `<use>`.
- `font-weight: 700` is allowed **only** in `@font-face` blocks and in the single CSS rule `.tile-big`. Nothing else may be bold.
- i18n: `Logic.I18N.ja` / `.en` identical key sets; every `tr('…')` key must exist (page test enforces). Times `H:MM` via `Logic.formatHM`. Durations via `Logic.formatDuration` (ja `4 時間 14 分`, en `4 h 14 min`).
- Sizes use `--zoom` through `--fs-*` variables. Tap targets ≥ 44px.
- Keep existing ids the page test needs: `today-body`, `btn-sleep`, `btn-wake`. Keep `Logic.adviceFlags` and its tests (unused by UI now).
- Tests: `node --test midsleep/test/*.test.mjs` (glob form). `process.env.TZ = 'Asia/Tokyo'` at the top of test files touching `Date`.
- Commit footer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. Awake at 14:00 with a target: night tile shows wake next day 16:08 with no NaN and no warning text (Task 3 manual + existing `wakeFor daytime` test).
2. Awake, bed time already passed (00:40, wakeTarget 06:00, target 2:55): morning big time dimmed, sub = 「もう過ぎています ・ 今寝ると中央は 3:20(目標 2:55 より 25 分遅い)」 (Task 2 `midOf` test, Task 3).
3. Fewer than 2 records: both tiles show `--:--`, stepper still changes `wakeTarget` (Task 3).
4. Sleeping and stale: warn card inside night tile, morning time dimmed, `btn-wake` still works (Task 4).
5. Zoom 200 on a 375px-wide phone: big times must not overflow the tile; `.tile-big` uses `clamp` with a `vw` middle (Task 3 CSS).

---

### Task 1: Font faces, tokens, page test

**Files:**
- Modify: `midsleep/index.html` (`<style>` head, `:root`, i18n credits, `ABOUT.credits`)
- Modify: `midsleep/test/page.test.mjs`
- Modify: `midsleep/README.md` (ライセンスとクレジット)

**Interfaces:**
- Produces CSS tokens: `--tile-night-bg`, `--tile-night-fg`, `--tile-night-deep`, `--tile-morning-bg`, `--tile-morning-fg`, `--tile-warn-bg`, `--tile-warn-fg` (values from the spec table 「色」, light in `:root`, dark in both `html[data-theme="dark"]` and the `prefers-color-scheme` block), and `--font: 'Zen Maru Gothic', system-ui, …` (prepend the family to the existing list).

- [ ] **Step 1: Update `page.test.mjs`**

Replace `assert.doesNotMatch(src, /@font-face/);` and the bold check with:

```js
// in 'no external resources and no innerHTML'
assert.doesNotMatch(src, /https?:\/\/(?!github\.com\/ytx\/simplePages)/);
// 'no emoji and no bold' → bold allowed only in @font-face and .tile-big
const noFaces = src.replace(/@font-face \{[\s\S]*?\}/g, '');
const bolds = [...noFaces.matchAll(/font-weight:\s*(bold|[5-9]00)/g)];
assert.equal(bolds.length, 1, 'exactly one bold rule outside @font-face');
assert.match(noFaces.slice(Math.max(0, bolds[0].index - 80), bolds[0].index), /\.tile-big\s*\{[^}]*$/);
```

Add:

```js
test('font faces reference files that exist', () => {
  const faces = src.match(/@font-face/g) || [];
  assert.equal(faces.length, 124);
  const urls = [...new Set([...src.matchAll(/url\((fonts\/zen-maru-gothic\/zmg-[47]00-\d{3}\.woff2)\)/g)].map((m) => m[1]))];
  assert.equal(urls.length, 124);
  for (const u of urls) assert.ok(existsSync(fileURLToPath(new URL('../' + u, import.meta.url))), u);
  assert.ok(existsSync(fileURLToPath(new URL('../fonts/zen-maru-gothic/OFL.txt', import.meta.url))));
  assert.match(src, /--font: 'Zen Maru Gothic'/);
  for (const t of ['--tile-night-bg', '--tile-night-fg', '--tile-night-deep', '--tile-morning-bg', '--tile-morning-fg', '--tile-warn-bg', '--tile-warn-fg']) {
    assert.equal((src.match(new RegExp(`${t}:`, 'g')) || []).length, 3, `${t} defined for light, dark attr, dark media`);
  }
});
```

- [ ] **Step 2: Run, expect failures** — `node --test midsleep/test/page.test.mjs`
- [ ] **Step 3: Implement** — paste `.superpowers/sdd-input/font-faces.css` into `<style>` before `:root`. Add the tokens. Prepend `'Zen Maru Gothic', ` to `--font`. Add i18n `credit_font` (ja `書体: Zen Maru Gothic — SIL Open Font License 1.1`, en `Font: Zen Maru Gothic — SIL Open Font License 1.1`) and push `'credit_font'` into `ABOUT.credits`. The `.tile-big` rule does not exist yet: add a placeholder `.tile-big { font-weight: 700; }` so the bold assertion passes (Task 3 completes it). Set `<meta name="theme-color" content="#1d2b6b">`.
- [ ] **Step 4: README** — in 「ライセンスとクレジット」 add: 書体は Zen Maru Gothic(SIL Open Font License 1.1)を `fonts/zen-maru-gothic/` に同梱(ウェイト 400 の全分割と、大きな時刻にだけ使うウェイト 700 の数字分割 2 つ、合計 2.2 MB)。ライセンス全文は同ディレクトリの `OFL.txt`。
- [ ] **Step 5: Run all tests, expect pass** — `node --test midsleep/test/*.test.mjs`
- [ ] **Step 6: Commit** — `midsleep: font faces, tile color tokens, credits`

### Task 2: Logic helpers `durationParts` and `midOf`

**Files:**
- Modify: `midsleep/index.html` (`app-logic`, export list)
- Modify: `midsleep/test/time.test.mjs`

**Interfaces:**
- Produces `Logic.durationParts(min, lang) → Array<{ n: string, u: string }>`: ja `[{n:'4',u:'時間'},{n:'14',u:'分'}]`, en `[{n:'4',u:'h'},{n:'14',u:'m'}]`. Same part rules as `formatDuration` (hours omitted when 0; minutes omitted when 0 unless hours are 0).
- Produces `Logic.midOf(a, b) → number` minutes-of-day of the midpoint of two `Date`s (rounded), wrapped 0–1439.

- [ ] **Step 1: Tests** (append to `time.test.mjs`)

```js
test('durationParts', () => {
  assert.deepEqual(Logic.durationParts(254, 'ja'), [{ n: '4', u: '時間' }, { n: '14', u: '分' }]);
  assert.deepEqual(Logic.durationParts(254, 'en'), [{ n: '4', u: 'h' }, { n: '14', u: 'm' }]);
  assert.deepEqual(Logic.durationParts(120, 'ja'), [{ n: '2', u: '時間' }]);
  assert.deepEqual(Logic.durationParts(0, 'en'), [{ n: '0', u: 'm' }]);
});
test('midOf', () => {
  assert.equal(Logic.midOf(new Date(2026, 9, 20, 0, 40), new Date(2026, 9, 20, 6, 0)), 200);   // 3:20
  assert.equal(Logic.midOf(new Date(2026, 9, 19, 23, 0), new Date(2026, 9, 20, 1, 0)), 0);     // 0:00
});
```

- [ ] **Step 2: Run, expect fail** — `node --test midsleep/test/time.test.mjs`
- [ ] **Step 3: Implement** next to `formatDuration`; add both to the `return { … }` export list.
- [ ] **Step 4: Run, expect pass**
- [ ] **Step 5: Commit** — `midsleep: durationParts and midOf helpers`

### Task 3: Awake state as night/morning tiles

**Files:**
- Modify: `midsleep/index.html` (`<style>`, `#tab-today` markup, i18n, `renderToday`, helpers)
- Modify: `midsleep/test/page.test.mjs` (markup assertions)

**Interfaces:**
- Consumes `Logic.wakeFor`, `Logic.bedFor`, `Logic.nextOccurrence`, `Logic.stats`, `Logic.midOf`, `Logic.formatDuration`, `Logic.formatHM`, `Logic.formatDateShort`, existing `diffParenT(midMin, targetMin)`, `stepWakeTarget(delta)`, `sleepNow(now)`.
- Produces markup (Task 4 fills the sleeping branch into the same nodes):

```html
<section class="tab-pane active" id="tab-today">
  <div id="tile-night" class="tile tile-night">
    <div id="today-date" class="tile-date"></div>
    <div id="today-body" class="tile-main"></div>
    <div class="tile-foot"><button id="btn-sleep" class="pill fill" type="button" hidden></button></div>
  </div>
  <div id="tile-morning" class="tile tile-morning">
    <div id="today-foot" class="tile-main"></div>
    <div class="tile-foot" id="morning-foot"><button id="btn-wake" class="pill" type="button" hidden></button></div>
  </div>
</section>
```

`#tab-today` gets `data-state="awake"` or `"sleeping"`. CSS:

```css
#tab-today.active { display: flex; flex-direction: column; margin: 0 calc(-1 * var(--gap)); padding-bottom: 0; overflow: hidden; }
.tile { display: flex; flex-direction: column; padding: var(--gap) calc(var(--gap) * 1.5); min-height: 0; position: relative; }
.tile-night { background: var(--tile-night-bg); color: var(--tile-night-fg); flex: 5 1 0; }
.tile-morning { background: var(--tile-morning-bg); color: var(--tile-morning-fg); flex: 5 1 0; }
#tab-today[data-state="sleeping"] .tile-night { background: var(--tile-night-deep); flex: 7 1 0; }
#tab-today[data-state="sleeping"] .tile-morning { flex: 3 1 0; }
.tile-date { font-size: var(--fs-small); opacity: 0.7; }
.tile-main { flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 0; }
.tile-label { font-size: calc(var(--fs-base) * 0.9); opacity: 0.9; }
.tile-big { font-weight: 700; font-size: clamp(2.4em, 16vw, calc(var(--fs-base) * 3.8)); line-height: 1.05; letter-spacing: -0.02em; }
.tile-big.dim { opacity: 0.55; } .tile-big.none { opacity: 0.35; }
.tile-big .tile-unit { font-size: 0.45em; font-weight: 400; }
#tab-today[data-state="sleeping"] .tile-morning .tile-big { font-size: clamp(1.8em, 11vw, calc(var(--fs-base) * 2.7)); }
.tile-sub { font-size: var(--fs-small); opacity: 0.8; margin-top: calc(var(--gap) / 2); line-height: 1.5; }
.tile-foot { display: flex; justify-content: flex-end; align-items: center; gap: calc(var(--gap) / 2); }
.pill { font: inherit; font-size: var(--fs-small); min-height: 44px; padding: 0 1.2em; border-radius: 999px; border: 1.5px solid currentColor; background: none; color: inherit; cursor: pointer; }
.pill.fill { background: var(--tile-night-fg); color: var(--tile-night-bg); border-color: var(--tile-night-fg); }
.pill[hidden] { display: none; }
.stepper { display: flex; align-items: center; gap: 4px; }
.stepper .icon-btn { background: none; border-color: currentColor; color: inherit; }
.stepper .stepper-val { font-size: var(--fs-base); padding: 0 0.3em; }
```

Remove `.today-*`, `.advice-*`, `.card-actions`, `.big-btn*`, `.link-row` rules that nothing uses after this task (keep `.link-btn`, Task 4 restyles it). Keep `.tile-warn` for Task 4.

i18n — add (ja / en):

| key | ja | en |
|---|---|---|
| `tile_if_sleep_now` | `今寝ると、起きるのは` | `Sleep now and wake at` |
| `tile_sleep_mid` | `睡眠 {d} ・ 中央 {m}` | `Sleep {d} · mid {m}` |
| `tile_wake_target` | `{t} に起きるなら、寝るのは` | `To wake at {t}, go to bed at` |
| `tile_sleep_left` | `睡眠 {d} ・ あと {r}` | `Sleep {d} · in {r}` |
| `tile_passed` | `もう過ぎています ・ 今寝ると中央は {m}{diff}` | `Already passed · sleeping now puts mid at {m}{diff}` |
| `tile_need_more` | `記録があと {n} 回たまると目安が出ます` | `{n} more night(s) of records and the advice appears` |
| `tile_first_night` | `まずは今夜の記録から` | `Start with tonight` |
| `no_time` | `--:--` | `--:--` |

Remove keys no longer used: `need_more`, `target_line`, `target_sub`, `card_if_sleep_now`, `wake_at`, `sleep_for`, `flag_short`, `flag_long`, `card_wake_target`, `bed_at`, `already_passed`, `last_today`, `last_day`, `diff_paren`, `diff_early`, `diff_late`, `diff_on` (only if `diffParen` is deleted; `diffParenT` and its `_t` keys stay). Delete `adviceCard`, `flagLine`, `lastRecordLine`, `diffParen` if unused.

- [ ] **Step 1: Page test additions**

```js
test('today tab is two tiles', () => {
  const pane = src.match(/<section class="tab-pane active" id="tab-today">([\s\S]*?)<\/section>/)[1];
  assert.match(pane, /id="tile-night" class="tile tile-night"/);
  assert.match(pane, /id="tile-morning" class="tile tile-morning"/);
  assert.ok(pane.indexOf('id="tile-night"') < pane.indexOf('id="btn-sleep"') && pane.indexOf('id="btn-sleep"') < pane.indexOf('id="tile-morning"'));
  assert.ok(pane.indexOf('id="tile-morning"') < pane.indexOf('id="btn-wake"'));
  assert.doesNotMatch(src, /big-btn|advice-card|today-last|flagLine|lastRecordLine|adviceCard/);
  for (const k of ['tile_if_sleep_now', 'tile_sleep_mid', 'tile_wake_target', 'tile_sleep_left', 'tile_passed', 'tile_need_more', 'tile_first_night', 'no_time']) assert.ok(k in Logic.I18N.ja, k);
  for (const k of ['need_more', 'target_line', 'target_sub', 'flag_short', 'flag_long', 'last_today', 'already_passed']) assert.ok(!(k in Logic.I18N.ja), 'removed ' + k);
});
```

- [ ] **Step 2: Run, expect fail**
- [ ] **Step 3: Implement `renderToday()` awake branch** per spec 「起きているとき」:
  - `#tab-today.dataset.state = rec ? 'sleeping' : 'awake'`; `#today-date` = `${formatDateShort} ${formatHM(now)}`.
  - Night `#today-body`: `.tile-label` `tile_if_sleep_now`; `.tile-big` = `formatHM(minutesOfDay(wakeAt))` (or `no_time` with class `none` when `targetMin === null`); `.tile-sub` = `tile_sleep_mid` `{d: formatDuration(sleepMin), m: formatHM(targetMin)}` (or `tile_need_more {n: max(0, 2 − count)}`). `btn-sleep` visible with `sleep_now`.
  - Morning `#today-foot`: label `tile_wake_target {t: formatHM(wakeTarget)}`; big = `formatHM(bedAt)`; sub = `tile_sleep_left {d, r: formatDuration(round((bedAt − now)/60000))}`. If `bedAt < now`: big gets class `dim`, sub = `tile_passed {m: formatHM(midOf(nowM, nextWake)), diff: diffParenT(midOf(nowM, nextWake), targetMin)}`. No target: big `no_time none`, sub `tile_first_night`.
  - `#morning-foot`: in awake state replace children with a `.stepper` (chevron-left icon-btn, `.stepper-val` = `formatHM(wakeTarget)`, chevron-right) **and** keep `btn-wake` hidden in the DOM (append it after the stepper so the id survives). Sleeping state (Task 4) removes the stepper and shows `btn-wake`.
  - No flag text anywhere. No last-record line.
- [ ] **Step 4: Run all tests, expect pass**
- [ ] **Step 5: Browser check** (`python3 -m http.server` from repo root or any static server; open `midsleep/`): awake normal, no-target (`localStorage.clear()`), passed-bed case (set wakeTarget so bed is in the past), zoom 200, dark theme, en. Fix overflow if any.
- [ ] **Step 6: Commit** — `midsleep: today tab awake state as night/morning tiles`

### Task 4: Sleeping state, stale card, links

**Files:**
- Modify: `midsleep/index.html` (`renderToday` sleeping branch, CSS `.tile-warn`, `.tile-links`)

**Interfaces:**
- Consumes `Logic.sleepingRecord`, `Logic.isStale`, `Logic.durationMin`, `Logic.durationParts`, `Logic.midMinutes`, `Logic.wakeFor`, `diffParenT`, `wakeNow`, `fixBedTime`, `cancelSleep`, `enterWakeTime`.

i18n add: `tile_sleeping_since` ja `{t} から寝ています` / en `Asleep since {t}`; `tile_if_wake_now` ja `いま起きると 中央 {m}{diff}` / en `Wake now and mid is {m}{diff}`; `tile_on_target` ja `目標どおりなら` / en `On target, wake at`. Remove `sleeping_since`, `if_wake_now`.

CSS:

```css
.tile-warn { background: var(--tile-warn-bg); color: var(--tile-warn-fg); border-radius: var(--radius); padding: calc(var(--gap) * 0.75) var(--gap); margin-top: var(--gap); font-size: var(--fs-small); line-height: 1.5; }
.tile-warn .card-actions { display: flex; flex-wrap: wrap; gap: calc(var(--gap) / 2); margin-top: calc(var(--gap) / 2); }
.tile-warn .btn { background: none; color: inherit; border-color: currentColor; border-radius: 999px; }
.tile-links { display: flex; flex-wrap: wrap; gap: var(--gap); margin-top: var(--gap); opacity: 0.7; }
.link-btn { font: inherit; font-size: var(--fs-small); color: inherit; background: none; border: 0; padding: 0.5em 0; min-height: 44px; cursor: pointer; text-decoration: underline; }
```

- [ ] **Step 1: Implement** per spec 「就寝中」:
  - Night `#today-body`: label `tile_sleeping_since {t: formatHM(minutesOfDay(bedAt))}`; big = `durationParts(dur, lang)` rendered as `span.tile-num` + `span.tile-unit` pairs (ja `4時間14分` no spaces; en `4h 14m`, a space between pairs); sub = `tile_if_wake_now {m: formatHM(midMinutes(bedAt, nowStr)), diff: targetMin === null ? '' : diffParenT(mid, targetMin)}` (only when `nowStr > bedAt`); then if stale the `.tile-warn` card (existing `stale_text`, buttons `enter_wake_time` / `cancel_sleep` with class `btn`); then `.tile-links` with `fix_bed_time` / `cancel_sleep` link buttons.
  - `btn-sleep` hidden.
  - Morning `#today-foot`: label `tile_on_target`; big = `formatHM(minutesOfDay(wakeFor(parseLocal(bedAt), targetMin).wakeAt))` or `no_time none`; class `dim` when stale.
  - `#morning-foot`: remove stepper, show `btn-wake` (`wake_now`).
- [ ] **Step 2: Page test** — add to 'today tab is two tiles': `for (const k of ['tile_sleeping_since','tile_if_wake_now','tile_on_target']) assert.ok(k in Logic.I18N.ja, k); assert.ok(!('sleeping_since' in Logic.I18N.ja));`
- [ ] **Step 3: Run all tests, expect pass**
- [ ] **Step 4: Browser check**: tap 今から寝る → sleeping layout; fix bed time to 20 hours ago → stale card appears and morning time dims; 今起きた works; 取り消す works; en + dark.
- [ ] **Step 5: Commit** — `midsleep: today tab sleeping state as tiles with stale card`

### Task 5: Docs and tidy

**Files:**
- Modify: `midsleep/README.md` (機能 section: describe the two tiles briefly; remove mentions of cards / 1 行要約 / 短めです if present)
- Modify: `CLAUDE.md` midsleep row (add `書体 midsleep/fonts/ を同梱` in the API column like time4u)
- Modify: `docs/superpowers/specs/2026-10-19-midsleep-design.md` 「構成」 tree: add `fonts/zen-maru-gothic/` line.

- [ ] **Step 1: Edit the three files.** Grep README for `カード|要約|短め|目標の中央時刻` and rewrite those sentences to match the tiles.
- [ ] **Step 2: Run all tests** — `node --test midsleep/test/*.test.mjs` and `node --test time4u/test/*.test.mjs`
- [ ] **Step 3: Commit** — `midsleep: docs for the tile layout and bundled font`
