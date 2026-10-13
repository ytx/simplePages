# Weather Toolbar & Settings Modal Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the revised shared UI (top-right icon toolbar, bottom status bar, fixed-size settings modal with data/About tabs, `--zoom`) from `_template/index.html` into `weather/index.html`, with the location name as a centred title and JMA/Open-Meteo credits in About.

**Architecture:** `weather/index.html` is self-contained, so the template's new CSS, markup and `App` functions are copied in verbatim and then adapted at the few weather-specific seams: the `#content` grid gets a title row, `--fs-temp` multiplies by `--zoom`, the location tab stays first in the tab order, `refresh()` drives `setToolbarAttention`, and `ABOUT.credits` lists the two APIs. Logic helpers are copied and re-tested in `weather/test`.

**Tech Stack:** Vanilla HTML/CSS/JS, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-13-toolbar-and-settings-modal-design.md` (weather section) and `docs/superpowers/specs/2026-10-12-weather-design.md`.

**Prerequisite:** The template plan `docs/superpowers/plans/2026-10-13-template-toolbar.md` is merged; `_template/index.html` is the reference copy for every "copy from template" step below.

## Global Constraints

- One page = `weather/index.html` alone. No external resources.
- Only `Logic` and `App` globals. External strings via `textContent`.
- Every size variable, including `--fs-temp`, multiplies by `var(--zoom)`.
- localStorage key `simplePages.weather`, `Logic.VERSION` stays `1`.
- Tests: `node --test weather/test/*.test.mjs` (glob form). No network in tests.
- The 1280×800 and 1920×1080 layouts must not scroll at zoom 100.
- Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. Location unset: the toolbar must not fade and the settings button must be highlighted; after a location is saved the highlight goes and fading resumes. (Task 3 wires `setToolbarAttention` in `refresh()`; manual check.)
2. Title row: with a long name such as 「鹿児島市 / 鹿児島県 薩摩地方」 the title must stay on one line or wrap without pushing the panels off-screen at 1280×800. (Task 2 CSS; manual check.)
3. Zoom 200 on a 1280×800 display will overflow; that is accepted by the spec, but zoom 100 must still fit after the title row and bottom bar are added. (Manual check in Task 4.)
4. Importing a settings JSON whose `location` is malformed must not blank the page: `updateSettings` already runs `validLocation`, and the textarea path must go through the same `updateSettings`. (Task 3 uses `importText` → `updateSettings`.)
5. Language toggle must re-render the forecast text (JMA/WMO text, weekday names), not just the labels. `applySettings` already calls `render(lastModel)`; keep that call. (Task 3.)

---

### Task 1: Logic helpers and i18n keys (copied from template) with tests

**Files:**
- Modify: `weather/index.html` (`<script id="app-logic">`)
- Test: `weather/test/settings.test.mjs`

**Interfaces:**
- Produces: `Logic.stepZoom`, `Logic.toggleTheme`, `Logic.toggleLang`, `Logic.parseImport` with the same signatures as `_template`; i18n keys listed in the test below; `set_location_hint` reworded.

- [ ] **Step 1: Append failing tests to `weather/test/settings.test.mjs`**

```js
test('stepZoom / toggleTheme / toggleLang (shared helpers)', () => {
  assert.equal(Logic.stepZoom(100, 1), 110);
  assert.equal(Logic.stepZoom(200, 1), 200);
  assert.equal(Logic.stepZoom(50, -1), 50);
  assert.equal(Logic.stepZoom(155, 1), 170);
  assert.equal(Logic.toggleTheme('dark'), 'light');
  assert.equal(Logic.toggleTheme('light'), 'dark');
  assert.equal(Logic.toggleLang('ja'), 'en');
  assert.equal(Logic.toggleLang('en'), 'ja');
});

test('parseImport: valid, broken JSON, wrong shape', () => {
  assert.deepEqual(Logic.parseImport('{"version":1,"settings":{"lang":"en"}}', 1), { ok: true, settings: { lang: 'en' } });
  assert.deepEqual(Logic.parseImport('{bad', 1), { ok: false, reason: 'invalid_json' });
  assert.deepEqual(Logic.parseImport('{"lang":"en"}', 1), { ok: false, reason: 'unrecognized_format' });
});

test('i18n has toolbar, data and about keys; hint points to the top-right settings', () => {
  const keys = ['zoom_in', 'zoom_out', 'fullscreen', 'exit_fullscreen', 'toggle_theme', 'toggle_lang', 'tab_about',
    'export_file', 'import_file', 'import_text', 'data_hint', 'import_ok', 'import_failed_json', 'import_failed_format',
    'about_description', 'about_links', 'about_repo', 'about_page', 'about_license', 'about_credits', 'credit_icons'];
  for (const k of keys) {
    assert.equal(typeof Logic.I18N.ja[k], 'string', `ja.${k}`);
    assert.equal(typeof Logic.I18N.en[k], 'string', `en.${k}`);
  }
  assert.equal(Logic.I18N.ja.export_json, undefined);
  assert.equal(Logic.I18N.ja.import_failed, undefined);
  assert.equal(Logic.I18N.ja.set_location_hint, '右上の設定から地点を選んでください');
  assert.equal(Logic.I18N.en.set_location_hint, 'Choose a location from the settings (top right)');
});

test('zoom schema entry coerces URL strings and rejects out-of-range', () => {
  const zoomSchema = { zoom: { type: 'int', min: 50, max: 200, default: 100 } };
  assert.equal(Logic.resolveSettings(zoomSchema, {}, { zoom: '120' }).zoom, 120);
  assert.equal(Logic.resolveSettings(zoomSchema, {}, { zoom: '999' }).zoom, 100);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test weather/test/*.test.mjs`
Expected: 3 new failures (`stepZoom is not a function`, `parseImport is not a function`, missing `ja.zoom_in`).

- [ ] **Step 3: Copy the helpers into weather's `Logic`**

Insert immediately before weather's `return { VERSION, coerce, ... toLocalIso };` line, the exact block from `_template/index.html` starting at `const ZOOM_MIN = 50;` through the end of `function parseImport(...) { ... }`. Then add `stepZoom, toggleTheme, toggleLang, parseImport` to the end of weather's return object list (before `};`).

- [ ] **Step 4: Copy the i18n keys**

In weather's `I18N.ja`: delete `export_json`, `import_json`, `import_failed`; add the same 21 keys as the template's `I18N.ja` block (from `zoom_in` through `credit_icons`), but with:

```js
      about_description: '1 地点の天気予報を横長 1 画面に常時表示します。文言と週間予報は気象庁、数値予報は Open-Meteo を使います。',
```

and change `set_location_hint` to `'右上の設定から地点を選んでください'`.

In `I18N.en`: same deletions and additions with:

```js
      about_description: 'Always-on single-screen forecast for one location. Text and weekly forecast from JMA, numeric forecast from Open-Meteo.',
```

and `set_location_hint: 'Choose a location from the settings (top right)'`.

- [ ] **Step 5: Run tests**

Run: `node --test weather/test/*.test.mjs` → all pass.

- [ ] **Step 6: Commit**

```bash
git add weather/index.html weather/test/settings.test.mjs
git commit -m "Weather: shared zoom/theme/lang/import helpers and toolbar i18n keys

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Markup and CSS port — toolbar, title row, bottom status bar, modal, data and About tabs

**Files:**
- Modify: `weather/index.html` (`<style>`, `<body>` markup)

**Interfaces:**
- Produces the same element ids and icon symbols as the template (`#toolbar`, `#btn-*`, `#settings-close`, `.tab-body`, `#data-text`, `#btn-import-text`, `#data-message`, `#about-*`), plus weather's existing `#page-title` moved into `main`.

- [ ] **Step 1: Size variables**

In weather's `:root` (first block), replace the `--radius`/`--gap`/`--fs-base`/`--fs-small`/`--fs-large` lines with the template's `--zoom` block (copy verbatim from `_template/index.html`). In the second `:root` block (weather colours), change `--fs-temp: clamp(48px, 7vw, 120px);` to:

```css
  --fs-temp: calc(clamp(48px, 7vw, 120px) * var(--zoom));
```

Also change `#cur-icon { width: clamp(80px, 12vw, 220px); height: clamp(80px, 12vw, 220px); }` to:

```css
#cur-icon { width: calc(clamp(80px, 12vw, 220px) * var(--zoom)); height: calc(clamp(80px, 12vw, 220px) * var(--zoom)); }
```

- [ ] **Step 2: Replace the shared CSS block**

Delete from the line `#status-bar {` through the line `.row { display: flex; gap: var(--gap); flex-wrap: wrap; }` (this covers `#settings-btn`, dialog, tabs, fields) and paste the template's block from `#toolbar {` through `.about a { color: var(--accent); }` verbatim.

Keep the pasted `#content { flex: 1; min-height: 0; padding: 0 var(--gap) var(--gap); }` as is, and update weather's own grid rules (second CSS section) as follows:

```css
#content {
  display: grid;
  grid-template-columns: 28fr 72fr;
  grid-template-rows: auto 55fr 45fr;
  gap: var(--gap);
}
#page-title { grid-column: 1 / 3; margin: 0; text-align: center; font-size: var(--fs-large); font-weight: 600; line-height: 1.2; min-height: 1.2em; }
#panel-current { grid-row: 2 / 4; align-items: center; text-align: center; justify-content: center; }
#no-location { grid-column: 1 / 3; grid-row: 2 / 4; display: grid; place-items: center; font-size: var(--fs-large); color: var(--fg-muted); }
```

(Keep `#no-location[hidden], .panel[hidden] { display: none; }` and the rest unchanged. The pasted template `#page-title` rule is overridden by this later one; delete the template's `#page-title` line to avoid confusion.)

- [ ] **Step 3: Markup**

- Replace weather's `<header id="status-bar">…</header>` with the template's `<svg style="display:none" aria-hidden="true">…</svg>` icon block **merged into weather's existing hidden `<svg>`** (add the nine `<symbol id="icon-dark-mode">`…`<symbol id="icon-close">` elements inside weather's existing `<svg style="display:none">` block, before its `</svg>`), followed by the template's `<header id="toolbar">…</header>`.
- Inside `<main id="content">`, insert `<h1 id="page-title"></h1>` as the first child (before `#no-location`). It has no `data-i18n`; `renderCurrent` fills it.
- After `</main>`, add the template's `<footer id="status-bar">…</footer>`.
- Delete `<button id="settings-btn" …>…</button>`.
- Replace `<dialog id="settings">…</dialog>` with the template's dialog, then re-insert weather's extras:
  - Tabs: `<button role="tab" data-tab="location" data-i18n="tab_location"></button>` first, then general (`aria-selected="true"`), display, data, about.
  - Inside `.tab-body`, put weather's existing `<section class="tab-panel" data-panel="location">…</section>` first (copy verbatim from the old dialog), then the template's general/display/data/about sections. Keep weather's extra display fields (`hourlyStep`, `hourlyCount`, `dailyDays`) inside the display section exactly as they were.

- [ ] **Step 4: Keep JS loadable for this intermediate commit**

Replace every `$('#settings-btn')` in `<script id="app-ui">` with `$('#btn-settings')` (occurrences in `refresh`, `resetIdle`, `bindSettingsDialog`).

- [ ] **Step 5: Verify**

`node --test weather/test/*.test.mjs` → all pass. Serve `python3 -m http.server 8791` from the repo root, open `http://localhost:8791/weather/`: toolbar top right, title row (empty until data), three panels, status footer, dialog with five tabs (地点 first, About last). Console has no errors.

- [ ] **Step 6: Commit**

```bash
git add weather/index.html
git commit -m "Weather: port toolbar, title row, bottom status bar and fixed-size settings modal markup

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: App behaviour port — toolbar actions, modal, data/About, attention wiring

**Files:**
- Modify: `weather/index.html` (`<script id="app-ui">`)

**Interfaces:**
- Consumes: `Logic.stepZoom/toggleTheme/toggleLang/parseImport`, existing `render`, `lastModel`, `renderLocationTab`, `bindLocationTab`.
- Produces: `App.applyZoom`, `App.setToolbarAttention`; `SCHEMA.zoom`; `ABOUT.credits` with JMA and Open-Meteo.

- [ ] **Step 1: Schema, state and ABOUT**

Add `zoom: { type: 'int', min: 50, max: 200, default: 100 },` to `SCHEMA` after `theme`. Add `let toolbarAttention = false;` after `let idleTimer = null;`. After `const STORAGE_KEY = ...;` add:

```js
  const REPO_URL = 'https://github.com/ytx/simplePages';
  const ABOUT = {
    page: PAGE,
    credits: [
      { name: '気象庁 天気予報 JSON (bosai)', url: 'https://www.jma.go.jp/bosai/' },
      { name: 'Open-Meteo', url: 'https://open-meteo.com/', note: 'CC BY 4.0' },
    ],
  };
```

- [ ] **Step 2: Copy the template's App functions**

From `_template/index.html` copy verbatim, replacing weather's versions of the same names:
`applyI18n`, `currentTheme`, `applyTheme`, `applyZoom`, `updateFullscreenButton`, `toggleFullscreen`, `setToolbarAttention`, `bindToolbar`, `resetIdle`, `showTab`, `refreshDataText`, `setDataMessage`, `importText`, `renderAbout`, `bindSettingsDialog`.

Then adapt:

- `applySettings` in weather must become:

```js
  function applySettings() {
    applyI18n();
    applyTheme();
    applyZoom(settings.zoom);
    for (const el of $$('[data-setting]')) el.value = settings[el.dataset.setting];
    renderSettingsExtra(settings);
    if (lastModel) render(lastModel);
    scheduleRefresh(0);
  }
```

- `resetIdle`: the template version already checks `toolbarAttention`; weather's old `if (settings.location)` condition is replaced by the attention flag set in `refresh()` (next step).
- `bindSettingsDialog`: weather had no extra code in it beyond the template's, so the copy is a straight replacement. Its tab loop must still cover the `location` tab (it does, via `[role="tab"]`).

- [ ] **Step 3: Wire attention in `refresh()`**

Replace `$('#btn-settings').classList.toggle('attention', !loc);` in `refresh()` with:

```js
    setToolbarAttention(!loc);
```

- [ ] **Step 4: `init()` and exports**

In `init()`: add `bindToolbar();` after `bindSettingsDialog();`; replace the `mousemove` listener line with the template's `pointermove, pointerdown, touchstart, keydown` line. Replace the return line with:

```js
  return { getSettings, updateSettings, setStatus, scheduleRefresh, refresh, render, getLastModel, applyZoom, setToolbarAttention };
```

- [ ] **Step 5: Verify in the browser**

Serve and open `http://localhost:8791/weather/`:
- With no location: toolbar stays fully visible after 10 s, settings button has the accent ring, hint text says 右上.
- Pick 千葉市 in 地点 tab: title row shows 「千葉市 / 千葉県 北西部」 centred; ring disappears; toolbar fades after 10 s.
- Theme, zoom ±, fullscreen, language buttons behave as in the template; language flips weekday names and weather text too.
- Data tab: textarea shows settings including `location`; paste a copy with `"location": {"lat": "x"}` → page stays rendered (location dropped by validation, no blank screen). Broken JSON shows a red message in the modal.
- About tab lists 気象庁 and Open-Meteo (CC BY 4.0) after the icon credit; page link ends in `/tree/main/weather`.
- Status footer shows clock, 最終更新, dot; cut the network and refresh → red message, data remains.

`node --test weather/test/*.test.mjs` → all pass.

- [ ] **Step 6: Commit**

```bash
git add weather/index.html
git commit -m "Weather: toolbar actions, fixed-size modal, textarea import, About credits, attention on missing location

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Layout fit check and README update

**Files:**
- Modify: `weather/index.html` (CSS only if needed), `weather/README.md`

- [ ] **Step 1: Fit check**

In the browser at 1280×800 and 1920×1080 (use DevTools device toolbar with custom sizes), zoom 100, location set: no page scroll, title row visible, weekly panel bottom edge above the status footer. If the hourly or weekly panel overflows, reduce `#page-title` to `font-size: var(--fs-base)` and `#toolbar` padding to `calc(var(--gap) / 3) var(--gap)`; re-check. Record the final sizes used in the README manual-check section.

- [ ] **Step 2: README**

In `weather/README.md`:
- Features list: add `- 右上のアイコンで ダーク/ライト、拡大/縮小、フルスクリーン、日英 を切替。設定は右上の歯車`。
- 使い方 step 2: `左下の歯車` → `右上の歯車(設定)`。
- URL パラメータ table: add row `` | `zoom` | `zoom=120` | 表示倍率 %(50〜200、10 刻み) | `` after `theme`.
- 手動確認: replace `地点未設定で案内文が出る(左下の歯車 → 地点タブ)` with `地点未設定で案内文が出、右上の設定ボタンが強調されツールバーが薄くならない(設定 → 地点タブ)`, and add:
  - `右上のボタンでダーク/ライト、拡大/縮小(50〜200%)、フルスクリーン、日英が切り替わり、再読込後も保持される(フルスクリーン以外)`
  - `設定モーダルはタブを切り替えても大きさが変わらず、× / 背景クリック / Esc で閉じる`
  - `データタブのテキストエリアで JSON を編集して読み込める。壊れた JSON は赤いメッセージ`
  - `About に 気象庁・Open-Meteo・Material Icons のクレジットと GitHub リンクが出る`
- 「ステータス帯に赤で理由を表示」 is still correct (now bottom); leave as is.

- [ ] **Step 3: Tests and commit**

```bash
node --test weather/test/*.test.mjs
git add weather/index.html weather/README.md
git commit -m "Weather: fit toolbar layout at 1280x800 and document the new controls

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
