# Template Toolbar & Settings Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bottom-left gear in `_template/index.html` with a top-right icon toolbar (theme, zoom in/out, fullscreen, language, settings), move the status bar to the bottom, and rebuild the settings modal as a fixed-size dialog with data (file + textarea) and About tabs.

**Architecture:** All changes stay inside the single file `_template/index.html` plus its Node tests. Pure helpers (`stepZoom`, `toggleTheme`, `toggleLang`, `parseImport`) go into `Logic` and are tested first; the DOM work (toolbar, modal, zoom via `--zoom`, status footer) goes into `App`. A root `LICENSE` is added because the About tab links to it.

**Tech Stack:** Vanilla HTML/CSS/JS, `<dialog>`, Fullscreen API, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-13-toolbar-and-settings-modal-design.md` (amends `docs/superpowers/specs/2026-10-12-simplepages-conventions-design.md`).

## Global Constraints

- One page = `_template/index.html` alone. No external `<link>`, `<script src>`, CDN, web fonts, or network icon loads.
- Only two globals: `Logic` (pure, in `<script id="app-logic">`) and `App` (DOM/fetch/timers, in `<script id="app-ui">`).
- External or user-supplied strings are inserted with `textContent`; never `innerHTML`.
- Sizes live in `:root` variables; every size variable is multiplied by `var(--zoom)`.
- Settings stored at localStorage key `simplePages.template` as `{ version, settings }`; priority URL query > localStorage > defaults; `?save=1` persists.
- `Logic.VERSION` stays `1` (adding the `zoom` key needs no migration).
- Tests run with `node --test _template/test/*.test.mjs` (glob form; a directory argument fails on Node 24). No network in tests.
- Icons: Material Icons paths (Google, Apache License 2.0), embedded as `<symbol>` and referenced via `<use href="#icon-…">`. Credit them in the About tab.
- Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. Zoom at a bound: pressing + at 200 or − at 50 must do nothing and the button must be disabled; a stored `zoom` of 155 steps to 160/150, never 165. (Task 1 tests `stepZoom`.)
2. Pasting garbage into the textarea: non-JSON, valid JSON of the wrong shape, and whitespace must each show a localized message inside the modal and leave settings untouched. (Task 1 tests `parseImport`; Task 5 wires it.)
3. `?zoom=abc` or `?zoom=999` in the URL must fall back to 100, not break rendering. (Task 1 tests `coerce` for zoom.)
4. Fullscreen unsupported (iPad Safari): the button must be hidden, not throw. (Task 4 guards on `document.fullscreenEnabled`; manual check.)
5. Theme button while `theme: 'auto'` on a dark OS: one press must go to light and persist `'light'`, so the OS flipping later does not override it. (Task 1 tests `toggleTheme`; Task 4 writes the explicit value.)

---

### Task 1: Logic helpers (`stepZoom`, `toggleTheme`, `toggleLang`, `parseImport`) and zoom coercion

**Files:**
- Modify: `_template/index.html` (inside `<script id="app-logic">`, before the `return { ... }` line)
- Test: `_template/test/logic.test.mjs`

**Interfaces:**
- Produces: `Logic.stepZoom(current: number, dir: 1|-1): number` (10-step, clamped 50..200, rounds `current` to nearest 10 first). `Logic.toggleTheme(effective: string): 'light'|'dark'`. `Logic.toggleLang(lang: string): 'ja'|'en'`. `Logic.parseImport(text: string, version: number): { ok: true, settings: object } | { ok: false, reason: 'invalid_json'|'unrecognized_format' }`.

- [ ] **Step 1: Append failing tests**

Append to the end of `_template/test/logic.test.mjs`:

```js
test('stepZoom: 10 steps, clamped 50..200, rounds odd values first', () => {
  assert.equal(Logic.stepZoom(100, 1), 110);
  assert.equal(Logic.stepZoom(100, -1), 90);
  assert.equal(Logic.stepZoom(200, 1), 200);
  assert.equal(Logic.stepZoom(50, -1), 50);
  assert.equal(Logic.stepZoom(195, 1), 200);
  assert.equal(Logic.stepZoom(155, 1), 170);
  assert.equal(Logic.stepZoom(155, -1), 150);
  assert.equal(Logic.stepZoom(154, 1), 160);
  assert.equal(Logic.stepZoom(NaN, 1), 110);
});

test('toggleTheme / toggleLang flip between the two concrete values', () => {
  assert.equal(Logic.toggleTheme('dark'), 'light');
  assert.equal(Logic.toggleTheme('light'), 'dark');
  assert.equal(Logic.toggleTheme(undefined), 'dark');
  assert.equal(Logic.toggleLang('ja'), 'en');
  assert.equal(Logic.toggleLang('en'), 'ja');
  assert.equal(Logic.toggleLang('fr'), 'ja');
});

test('parseImport: valid, broken JSON, wrong shape, blank', () => {
  assert.deepEqual(Logic.parseImport('{"version":1,"settings":{"lang":"en"}}', 1), { ok: true, settings: { lang: 'en' } });
  assert.deepEqual(Logic.parseImport('{bad json', 1), { ok: false, reason: 'invalid_json' });
  assert.deepEqual(Logic.parseImport('   \n', 1), { ok: false, reason: 'invalid_json' });
  assert.deepEqual(Logic.parseImport('{"lang":"en"}', 1), { ok: false, reason: 'unrecognized_format' });
  assert.deepEqual(Logic.parseImport('{"version":99,"settings":{"lang":"en"}}', 1), { ok: false, reason: 'unrecognized_format' });
  assert.deepEqual(Logic.parseImport('[1,2]', 1), { ok: false, reason: 'unrecognized_format' });
});

test('zoom schema entry coerces URL strings and rejects out-of-range', () => {
  const zoomSchema = { zoom: { type: 'int', min: 50, max: 200, default: 100 } };
  assert.equal(Logic.resolveSettings(zoomSchema, {}, { zoom: '120' }).zoom, 120);
  assert.equal(Logic.resolveSettings(zoomSchema, {}, { zoom: 'abc' }).zoom, 100);
  assert.equal(Logic.resolveSettings(zoomSchema, {}, { zoom: '999' }).zoom, 100);
  assert.equal(Logic.resolveSettings(zoomSchema, { zoom: 40 }, {}).zoom, 100);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test _template/test/*.test.mjs`
Expected: 3 failures (`stepZoom is not a function`, `toggleTheme is not a function`, `parseImport is not a function`); the zoom schema test passes already (coerce exists).

- [ ] **Step 3: Implement in `Logic`**

Insert immediately before `return { VERSION, coerce, resolveSettings, migrateStored, I18N, t, detectLang, effectiveTheme };`:

```js
  const ZOOM_MIN = 50;
  const ZOOM_MAX = 200;
  const ZOOM_STEP = 10;

  function stepZoom(current, dir) {
    const base = Number.isFinite(current) ? Math.round(current / ZOOM_STEP) * ZOOM_STEP : 100;
    const next = base + (dir < 0 ? -ZOOM_STEP : ZOOM_STEP);
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  }

  function toggleTheme(effective) {
    return effective === 'dark' ? 'light' : 'dark';
  }

  function toggleLang(lang) {
    return lang === 'ja' ? 'en' : 'ja';
  }

  // ファイル/テキストエリア共用のインポート解析。DOM に触らない。
  function parseImport(text, version) {
    let raw;
    try {
      raw = JSON.parse(String(text));
    } catch {
      return { ok: false, reason: 'invalid_json' };
    }
    const settings = migrateStored(raw, version);
    if (Object.keys(settings).length === 0) return { ok: false, reason: 'unrecognized_format' };
    return { ok: true, settings };
  }
```

Then change the return line to:

```js
  return { VERSION, coerce, resolveSettings, migrateStored, I18N, t, detectLang, effectiveTheme, stepZoom, toggleTheme, toggleLang, parseImport };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test _template/test/*.test.mjs`
Expected: all pass (14 tests).

- [ ] **Step 5: Commit**

```bash
git add _template/index.html _template/test/logic.test.mjs
git commit -m "Template: add stepZoom, toggleTheme, toggleLang, parseImport to Logic

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: i18n keys for toolbar, data tab and About

**Files:**
- Modify: `_template/index.html` (`I18N.ja` and `I18N.en` inside `<script id="app-logic">`)
- Test: `_template/test/logic.test.mjs`

**Interfaces:**
- Produces: i18n keys `zoom_in, zoom_out, fullscreen, exit_fullscreen, toggle_theme, toggle_lang, tab_about, export_file, import_file, import_text, data_hint, import_ok, import_failed_json, import_failed_format, about_description, about_links, about_repo, about_page, about_license, about_credits, credit_icons`. Removes `export_json`, `import_json`, `import_failed`.

- [ ] **Step 1: Append failing test**

```js
test('i18n has toolbar, data and about keys in both languages', () => {
  const keys = ['zoom_in', 'zoom_out', 'fullscreen', 'exit_fullscreen', 'toggle_theme', 'toggle_lang', 'tab_about',
    'export_file', 'import_file', 'import_text', 'data_hint', 'import_ok', 'import_failed_json', 'import_failed_format',
    'about_description', 'about_links', 'about_repo', 'about_page', 'about_license', 'about_credits', 'credit_icons'];
  for (const k of keys) {
    assert.equal(typeof Logic.I18N.ja[k], 'string', `ja.${k}`);
    assert.equal(typeof Logic.I18N.en[k], 'string', `en.${k}`);
  }
  assert.equal(Logic.I18N.ja.export_json, undefined);
  assert.equal(Logic.I18N.ja.import_json, undefined);
  assert.equal(Logic.I18N.ja.import_failed, undefined);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test _template/test/*.test.mjs`
Expected: 1 failure on `ja.zoom_in`.

- [ ] **Step 3: Edit the dictionaries**

In `I18N.ja`, delete the three lines `export_json: ...`, `import_json: ...`, `import_failed: ...` and add after `clear_all: 'すべて消去',`:

```js
      zoom_in: '拡大',
      zoom_out: '縮小',
      fullscreen: 'フルスクリーン',
      exit_fullscreen: 'フルスクリーン解除',
      toggle_theme: 'ダーク/ライト切替',
      toggle_lang: '日本語/English',
      tab_about: 'About',
      export_file: 'ファイルに書き出す',
      import_file: 'ファイルから読み込む',
      import_text: 'テキストから読み込む',
      data_hint: '現在の設定(JSON)。編集して「テキストから読み込む」で反映できます。',
      import_ok: '読み込みました',
      import_failed_json: '読み込み失敗: JSON として解釈できません',
      import_failed_format: '読み込み失敗: 設定ファイルの形式ではありません',
      about_description: 'simplePages の新ページ用ひな形です。',
      about_links: 'リンク',
      about_repo: 'GitHub リポジトリ',
      about_page: 'このページのソース',
      about_license: 'ライセンス',
      about_credits: 'クレジット',
      credit_icons: 'アイコン: Material Icons (Google) — Apache License 2.0',
```

In `I18N.en`, delete `export_json`, `import_json`, `import_failed` and add after `clear_all: 'Clear all',`:

```js
      zoom_in: 'Zoom in',
      zoom_out: 'Zoom out',
      fullscreen: 'Fullscreen',
      exit_fullscreen: 'Exit fullscreen',
      toggle_theme: 'Toggle dark/light',
      toggle_lang: '日本語/English',
      tab_about: 'About',
      export_file: 'Export to file',
      import_file: 'Import from file',
      import_text: 'Import from text',
      data_hint: 'Current settings as JSON. Edit and press "Import from text" to apply.',
      import_ok: 'Imported',
      import_failed_json: 'Import failed: not valid JSON',
      import_failed_format: 'Import failed: not a settings file',
      about_description: 'Template page for new simplePages.',
      about_links: 'Links',
      about_repo: 'GitHub repository',
      about_page: 'Source of this page',
      about_license: 'License',
      about_credits: 'Credits',
      credit_icons: 'Icons: Material Icons (Google) — Apache License 2.0',
```

- [ ] **Step 4: Run tests**

Run: `node --test _template/test/*.test.mjs`
Expected: all pass (15 tests).

- [ ] **Step 5: Commit**

```bash
git add _template/index.html _template/test/logic.test.mjs
git commit -m "Template: i18n keys for toolbar, data tab and About

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Markup and CSS — toolbar, bottom status bar, fixed-size modal, data and About tabs

This task changes HTML/CSS only; the page must still load without JS errors (bindings come in Task 4/5). Verify by opening the file in a browser; the existing JS will throw on `$('#settings-btn')` being null until Task 4, which is acceptable for this intermediate commit **only if** Task 4 follows immediately. To keep the tree loadable, this task also renames the gear id in the two JS spots noted in Step 4.

**Files:**
- Modify: `_template/index.html` (`<style>`, `<body>` markup)

**Interfaces:**
- Produces element ids used by Tasks 4–5: `#toolbar`, `#btn-theme`, `#btn-zoom-in`, `#btn-zoom-out`, `#btn-fullscreen`, `#btn-lang`, `#btn-settings`, `#settings-close`, `#page-title`, `#status-bar` (footer), `.tab-body`, `#data-text`, `#btn-export`, `#btn-import`, `#import-file`, `#btn-import-text`, `#btn-clear`, `#data-message`, `#about-description`, `#about-repo`, `#about-page`, `#about-license`, `#about-credits`. Icon symbols `#icon-dark-mode`, `#icon-light-mode`, `#icon-zoom-in`, `#icon-zoom-out`, `#icon-fullscreen`, `#icon-fullscreen-exit`, `#icon-translate`, `#icon-settings`, `#icon-close`.

- [ ] **Step 1: Replace size variables so they multiply by `--zoom`**

In `:root`, replace the four lines `--radius`, `--gap`, `--fs-base`, `--fs-small`, `--fs-large` block with:

```css
  --zoom: 1;
  --radius: 10px;
  --gap: calc(clamp(8px, 1vw, 16px) * var(--zoom));
  --fs-base: calc(clamp(14px, 1.2vw, 20px) * var(--zoom));
  --fs-small: calc(var(--fs-base) * 0.8);
  --fs-large: calc(var(--fs-base) * 1.6);
```

- [ ] **Step 2: Replace the `#status-bar`…`.row` CSS block**

Delete from the line `#status-bar {` through the line `.row { display: flex; gap: var(--gap); flex-wrap: wrap; }` and insert:

```css
#toolbar {
  display: flex; justify-content: flex-end; align-items: center; gap: calc(var(--gap) / 2);
  padding: calc(var(--gap) / 2) var(--gap);
  transition: opacity 0.6s;
}
#toolbar.idle { opacity: 0.15; }
.icon-btn {
  width: 2.2em; height: 2.2em; border-radius: 50%;
  border: 1px solid var(--border); background: var(--bg-panel); color: var(--fg);
  cursor: pointer; display: grid; place-items: center; padding: 0; font: inherit;
}
.icon-btn:disabled { opacity: 0.35; cursor: default; }
.icon-btn svg { width: 1.3em; height: 1.3em; fill: currentColor; }
.icon-btn.attention { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent); }
#content { flex: 1; min-height: 0; padding: 0 var(--gap) var(--gap); }
#page-title { margin: 0 0 var(--gap); text-align: center; font-size: var(--fs-large); font-weight: 600; }
#status-bar {
  display: flex; justify-content: center; align-items: center; gap: var(--gap);
  padding: calc(var(--gap) / 2) var(--gap);
  border-top: 1px solid var(--border);
  font-size: var(--fs-small); color: var(--fg-muted);
}
#status-dot {
  width: 0.7em; height: 0.7em; border-radius: 50%;
  background: var(--fg-muted);
}
#status-dot[data-state="ok"] { background: var(--ok); }
#status-dot[data-state="busy"] { background: var(--busy); }
#status-dot[data-state="error"] { background: var(--error); }
#status-message[data-state="error"] { color: var(--error); }
dialog#settings {
  background: var(--bg-panel); color: var(--fg);
  border: 1px solid var(--border); border-radius: var(--radius);
  width: min(90vw, 36em); height: min(85vh, 32em); padding: 0;
  display: none; grid-template-rows: auto auto 1fr; overflow: hidden;
}
dialog#settings[open] { display: grid; }
dialog#settings::backdrop { background: rgba(0,0,0,0.5); }
.dlg-header { display: flex; align-items: center; padding: calc(var(--gap) / 2) var(--gap); border-bottom: 1px solid var(--border); }
.dlg-header h2 { margin: 0; font-size: var(--fs-base); flex: 1; }
.tabs { display: flex; gap: 2px; padding: 0 var(--gap); border-bottom: 1px solid var(--border); overflow-x: auto; }
.tabs button {
  background: none; border: none; color: var(--fg-muted); padding: 0.6em 1em;
  cursor: pointer; border-bottom: 2px solid transparent; font: inherit; white-space: nowrap;
}
.tabs button[aria-selected="true"] { color: var(--fg); border-bottom-color: var(--accent); }
.tab-body { overflow: auto; min-height: 0; }
.tab-panel { display: none; padding: var(--gap); }
.tab-panel.active { display: block; }
.field { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); align-items: center; margin-bottom: var(--gap); }
.field label { color: var(--fg-muted); }
select, input, textarea, button.btn {
  font: inherit; color: var(--fg); background: var(--bg); border: 1px solid var(--border);
  border-radius: 6px; padding: 0.4em 0.6em;
}
textarea#data-text { width: 100%; min-height: 10em; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: var(--fs-small); resize: vertical; }
button.btn { cursor: pointer; }
button.btn.danger { color: var(--error); }
.row { display: flex; gap: var(--gap); flex-wrap: wrap; }
.hint { color: var(--fg-muted); font-size: var(--fs-small); margin: calc(var(--gap) / 2) 0; }
#data-message { min-height: 1.4em; margin-top: calc(var(--gap) / 2); }
#data-message[data-state="error"] { color: var(--error); }
.about h3 { margin: var(--gap) 0 calc(var(--gap) / 3); font-size: var(--fs-base); }
.about ul { margin: 0; padding-left: 1.2em; }
.about a { color: var(--accent); }
```

- [ ] **Step 3: Replace the body markup from `<header id="status-bar">` through `</dialog>`**

```html
<svg style="display:none" aria-hidden="true">
  <symbol id="icon-dark-mode" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></symbol>
  <symbol id="icon-light-mode" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></symbol>
  <symbol id="icon-zoom-in" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm2.5-4h-2v2H9v-2H7V9h2V7h1v2h2v1z"/></symbol>
  <symbol id="icon-zoom-out" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z"/></symbol>
  <symbol id="icon-fullscreen" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></symbol>
  <symbol id="icon-fullscreen-exit" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></symbol>
  <symbol id="icon-translate" viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></symbol>
  <symbol id="icon-settings" viewBox="0 0 24 24"><path d="M19.4 13a7.9 7.9 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a8 8 0 0 0-1.7-1L15 3.3H9l-.3 2.6a8 8 0 0 0-1.7 1l-2.5-1-2 3.5L4.6 11a7.9 7.9 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a8 8 0 0 0 1.7 1l.3 2.6h6l.3-2.6a8 8 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></symbol>
  <symbol id="icon-close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></symbol>
</svg>
<header id="toolbar">
  <button id="btn-theme" class="icon-btn" type="button" data-i18n-label="toggle_theme"><svg><use href="#icon-dark-mode"></use></svg></button>
  <button id="btn-zoom-in" class="icon-btn" type="button" data-i18n-label="zoom_in"><svg><use href="#icon-zoom-in"></use></svg></button>
  <button id="btn-zoom-out" class="icon-btn" type="button" data-i18n-label="zoom_out"><svg><use href="#icon-zoom-out"></use></svg></button>
  <button id="btn-fullscreen" class="icon-btn" type="button" data-i18n-label="fullscreen"><svg><use href="#icon-fullscreen"></use></svg></button>
  <button id="btn-lang" class="icon-btn" type="button" data-i18n-label="toggle_lang"><svg><use href="#icon-translate"></use></svg></button>
  <button id="btn-settings" class="icon-btn" type="button" data-i18n-label="settings"><svg><use href="#icon-settings"></use></svg></button>
</header>
<main id="content">
  <h1 id="page-title" data-i18n="page_title"></h1>
  <p data-i18n="placeholder_content"></p>
</main>
<footer id="status-bar">
  <span id="clock"></span>
  <span id="status-message"></span>
  <span id="status-dot" data-state="none"></span>
</footer>
<dialog id="settings">
  <div class="dlg-header">
    <h2 data-i18n="settings"></h2>
    <button id="settings-close" class="icon-btn" type="button" data-i18n-label="close"><svg><use href="#icon-close"></use></svg></button>
  </div>
  <div class="tabs" role="tablist">
    <button role="tab" data-tab="general" aria-selected="true" data-i18n="tab_general"></button>
    <button role="tab" data-tab="display" data-i18n="tab_display"></button>
    <button role="tab" data-tab="data" data-i18n="tab_data"></button>
    <button role="tab" data-tab="about" data-i18n="tab_about"></button>
  </div>
  <div class="tab-body">
    <section class="tab-panel active" data-panel="general">
      <div class="field">
        <label for="set-refresh" data-i18n="refresh_minutes"></label>
        <input id="set-refresh" type="number" min="1" max="120" data-setting="refreshMinutes">
      </div>
      <div id="settings-extra-general"></div>
    </section>
    <section class="tab-panel" data-panel="display">
      <div class="field">
        <label for="set-lang" data-i18n="language"></label>
        <select id="set-lang" data-setting="lang">
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
      </div>
      <div class="field">
        <label for="set-theme" data-i18n="theme"></label>
        <select id="set-theme" data-setting="theme">
          <option value="auto" data-i18n="theme_auto"></option>
          <option value="light" data-i18n="theme_light"></option>
          <option value="dark" data-i18n="theme_dark"></option>
        </select>
      </div>
      <div id="settings-extra-display"></div>
    </section>
    <section class="tab-panel" data-panel="data">
      <div class="row">
        <button class="btn" id="btn-export" data-i18n="export_file"></button>
        <button class="btn" id="btn-import" data-i18n="import_file"></button>
        <input id="import-file" type="file" accept="application/json" hidden>
        <button class="btn danger" id="btn-clear" data-i18n="clear_all"></button>
      </div>
      <p class="hint" data-i18n="data_hint"></p>
      <textarea id="data-text" spellcheck="false"></textarea>
      <div class="row">
        <button class="btn" id="btn-import-text" data-i18n="import_text"></button>
      </div>
      <div id="data-message" data-state="none"></div>
    </section>
    <section class="tab-panel about" data-panel="about">
      <p id="about-description" data-i18n="about_description"></p>
      <h3 data-i18n="about_links"></h3>
      <ul>
        <li><a id="about-repo" href="https://github.com/ytx/simplePages" target="_blank" rel="noopener" data-i18n="about_repo"></a></li>
        <li><a id="about-page" href="https://github.com/ytx/simplePages" target="_blank" rel="noopener" data-i18n="about_page"></a></li>
      </ul>
      <h3 data-i18n="about_license"></h3>
      <p id="about-license"><a href="../LICENSE" target="_blank" rel="noopener">MIT License</a> — Copyright (c) 2026 ytx</p>
      <h3 data-i18n="about_credits"></h3>
      <ul id="about-credits">
        <li data-i18n="credit_icons"></li>
      </ul>
    </section>
  </div>
</dialog>
```

- [ ] **Step 4: Keep the existing JS loadable**

In `<script id="app-ui">`, replace every `$('#settings-btn')` with `$('#btn-settings')` (three occurrences: two in `resetIdle`, one in `bindSettingsDialog`). Task 4 rewrites these functions anyway.

- [ ] **Step 5: Verify**

Run: `node --test _template/test/*.test.mjs` → all pass (markup does not affect Logic).
Open `_template/index.html` in a browser (serve with `python3 -m http.server 8791` from the repo root and visit `http://localhost:8791/_template/`): the toolbar shows six icon buttons at top right, the status row is at the bottom, the settings button opens a fixed-size dialog with four tabs, and the console shows no errors. The export/import buttons still work with the old handlers.

- [ ] **Step 6: Commit**

```bash
git add _template/index.html
git commit -m "Template: top-right icon toolbar, bottom status bar, fixed-size settings modal markup

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Toolbar behaviour — theme, zoom, fullscreen, language, idle fade, label i18n

**Files:**
- Modify: `_template/index.html` (`<script id="app-ui">`)

**Interfaces:**
- Consumes: `Logic.stepZoom`, `Logic.toggleTheme`, `Logic.toggleLang`, `Logic.effectiveTheme`; element ids from Task 3.
- Produces: `App.setToolbarAttention(on: boolean)`, `App.applyZoom(zoom: number)`; `SCHEMA.zoom`.

- [ ] **Step 1: Add `zoom` to the schema**

Replace the `SCHEMA` object with:

```js
  const SCHEMA = {
    lang: { type: 'enum', values: ['ja', 'en'], default: Logic.detectLang(navigator.language) },
    theme: { type: 'enum', values: ['auto', 'light', 'dark'], default: 'auto' },
    zoom: { type: 'int', min: 50, max: 200, default: 100 },
    refreshMinutes: { type: 'int', min: 1, max: 120, default: 10 },
  };
```

Add after `let idleTimer = null;`:

```js
  let toolbarAttention = false;
```

- [ ] **Step 2: Extend `applyI18n`, add `applyZoom`, update `applyTheme` and `applySettings`**

Replace `applyI18n`, `applyTheme`, `applySettings` with:

```js
  function applyI18n() {
    document.documentElement.lang = settings.lang;
    for (const el of $$('[data-i18n]')) el.textContent = Logic.t(settings.lang, el.dataset.i18n);
    for (const el of $$('[data-i18n-label]')) el.setAttribute('aria-label', Logic.t(settings.lang, el.dataset.i18nLabel));
    updateFullscreenButton();
  }

  function currentTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return Logic.effectiveTheme(settings.theme, prefersDark);
  }

  function applyTheme() {
    const theme = currentTheme();
    document.documentElement.dataset.theme = theme;
    // アイコンは「切替先」を表す: ライト表示中は月、ダーク表示中は太陽。
    $('#btn-theme use').setAttribute('href', theme === 'dark' ? '#icon-light-mode' : '#icon-dark-mode');
  }

  function applyZoom(zoom) {
    document.documentElement.style.setProperty('--zoom', String(zoom / 100));
    $('#btn-zoom-in').disabled = Logic.stepZoom(zoom, 1) === zoom;
    $('#btn-zoom-out').disabled = Logic.stepZoom(zoom, -1) === zoom;
  }

  function applySettings() {
    applyI18n();
    applyTheme();
    applyZoom(settings.zoom);
    for (const el of $$('[data-setting]')) el.value = settings[el.dataset.setting];
    renderSettingsExtra(settings);
    scheduleRefresh(0);
  }
```

- [ ] **Step 3: Fullscreen helpers and toolbar binding**

Insert after `applySettings` (before `setStatus`):

```js
  function updateFullscreenButton() {
    const btn = $('#btn-fullscreen');
    if (!document.fullscreenEnabled) { btn.hidden = true; return; }
    const on = !!document.fullscreenElement;
    btn.querySelector('use').setAttribute('href', on ? '#icon-fullscreen-exit' : '#icon-fullscreen');
    btn.setAttribute('aria-label', Logic.t(settings.lang, on ? 'exit_fullscreen' : 'fullscreen'));
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* ユーザー操作なしで拒否された場合など。無視して現状維持 */ }
  }

  // ページ側が true にすると減光せず、設定ボタンを強調する(例: 必須設定が未入力)。
  function setToolbarAttention(on) {
    toolbarAttention = !!on;
    $('#btn-settings').classList.toggle('attention', toolbarAttention);
    if (toolbarAttention) $('#toolbar').classList.remove('idle');
  }

  function bindToolbar() {
    $('#btn-theme').addEventListener('click', () => updateSettings({ theme: Logic.toggleTheme(currentTheme()) }));
    $('#btn-zoom-in').addEventListener('click', () => updateSettings({ zoom: Logic.stepZoom(settings.zoom, 1) }));
    $('#btn-zoom-out').addEventListener('click', () => updateSettings({ zoom: Logic.stepZoom(settings.zoom, -1) }));
    $('#btn-fullscreen').addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    $('#btn-lang').addEventListener('click', () => updateSettings({ lang: Logic.toggleLang(settings.lang) }));
    $('#btn-settings').addEventListener('click', () => $('#settings').showModal());
  }
```

- [ ] **Step 4: Idle fade for the whole toolbar**

Replace `resetIdle` with:

```js
  function resetIdle() {
    $('#toolbar').classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!toolbarAttention) $('#toolbar').classList.add('idle'); }, IDLE_MS);
  }
```

In `init()`, replace the line `for (const ev of ['mousemove', 'touchstart', 'keydown']) document.addEventListener(ev, resetIdle, { passive: true });` with:

```js
    for (const ev of ['pointermove', 'pointerdown', 'touchstart', 'keydown']) document.addEventListener(ev, resetIdle, { passive: true });
```

and add `bindToolbar();` right after `bindSettingsDialog();`.

In `bindSettingsDialog`, delete the line `$('#btn-settings').addEventListener('click', () => dlg.showModal());` (now in `bindToolbar`).

- [ ] **Step 5: Export the new App methods**

Replace the return line with:

```js
  return { getSettings, updateSettings, setStatus, scheduleRefresh, refresh, fetchJson, applyZoom, setToolbarAttention };
```

- [ ] **Step 6: Verify in the browser**

Serve and open `http://localhost:8791/_template/`. Check in the console / by clicking:
- Theme button flips theme and the icon; reload keeps it; `localStorage.getItem('simplePages.template')` shows `"theme":"light"` or `"dark"`.
- Zoom + / − change the whole page size in 10% steps; `+` is disabled at 200 and `−` at 50; `?zoom=150` applies on load.
- Fullscreen button enters/exits fullscreen and swaps its icon; in a browser without `fullscreenEnabled` it is hidden.
- Language button flips all labels, including `aria-label`s (inspect a toolbar button).
- After 10 s without input the toolbar fades; moving the pointer restores it. `App.setToolbarAttention(true)` in the console highlights the settings button and stops fading.

Run: `node --test _template/test/*.test.mjs` → all pass.

- [ ] **Step 7: Commit**

```bash
git add _template/index.html
git commit -m "Template: toolbar actions for theme, zoom, fullscreen, language; idle fade for the whole bar

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Settings modal behaviour — close ×, backdrop close, data tab (file + textarea + clear), About links

**Files:**
- Modify: `_template/index.html` (`<script id="app-ui">`)

**Interfaces:**
- Consumes: `Logic.parseImport(text, Logic.VERSION)`; element ids from Task 3.
- Produces: `ABOUT` constant shape `{ page: string, credits: Array<{ name: string, url: string, note?: string }> }` that pages copy and edit.

- [ ] **Step 1: Add the `ABOUT` constant**

Right after `const STORAGE_KEY = ...;` add:

```js
  const REPO_URL = 'https://github.com/ytx/simplePages';
  // ページごとに書き換える: About タブの「このページのソース」リンクとクレジット一覧。
  const ABOUT = {
    page: PAGE,
    credits: [],
  };
```

- [ ] **Step 2: Replace `bindSettingsDialog` entirely**

```js
  function showTab(name) {
    for (const t2 of $$('[role="tab"]')) t2.setAttribute('aria-selected', String(t2.dataset.tab === name));
    for (const p of $$('.tab-panel')) p.classList.toggle('active', p.dataset.panel === name);
    if (name === 'data') refreshDataText();
  }

  function refreshDataText() {
    $('#data-text').value = JSON.stringify({ version: Logic.VERSION, settings }, null, 2);
    setDataMessage('none', '');
  }

  function setDataMessage(state, text) {
    const el = $('#data-message');
    el.dataset.state = state;
    el.textContent = text;
  }

  function importText(text) {
    const result = Logic.parseImport(text, Logic.VERSION);
    if (!result.ok) {
      setDataMessage('error', Logic.t(settings.lang, result.reason === 'invalid_json' ? 'import_failed_json' : 'import_failed_format'));
      return;
    }
    updateSettings(result.settings);
    refreshDataText();
    setDataMessage('ok', Logic.t(settings.lang, 'import_ok'));
  }

  function renderAbout() {
    $('#about-page').href = `${REPO_URL}/tree/main/${ABOUT.page}`;
    const list = $('#about-credits');
    const icons = list.firstElementChild; // credit_icons の li は残す
    list.replaceChildren(icons);
    for (const c of ABOUT.credits) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = c.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = c.name;
      li.appendChild(a);
      if (c.note) li.appendChild(document.createTextNode(` — ${c.note}`));
      list.appendChild(li);
    }
  }

  function bindSettingsDialog() {
    const dlg = $('#settings');
    $('#settings-close').addEventListener('click', () => dlg.close());
    // 背景クリックで閉じる(dialog 自身がターゲットのときだけ)。
    dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });
    for (const tab of $$('[role="tab"]')) tab.addEventListener('click', () => showTab(tab.dataset.tab));
    for (const el of $$('[data-setting]')) {
      el.addEventListener('change', () => updateSettings({ [el.dataset.setting]: el.value }));
    }
    $('#btn-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ version: Logic.VERSION, settings }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const d = new Date();
      const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      a.download = `simplePages-${PAGE}-${ymd}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 0);
    });
    $('#btn-import').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (file) importText(await file.text());
      ev.target.value = '';
    });
    $('#btn-import-text').addEventListener('click', () => importText($('#data-text').value));
    $('#btn-clear').addEventListener('click', () => {
      if (!confirm(Logic.t(settings.lang, 'confirm_clear'))) return;
      storage.clear();
      location.href = location.pathname;
    });
    renderAbout();
  }
```

Note: `dialog#settings` has `padding: 0` and the grid fills it, so a click on the dialog element itself only happens on the backdrop area.

- [ ] **Step 3: Verify in the browser**

Serve and open `http://localhost:8791/_template/`, open settings:
- × closes; clicking the dark backdrop closes; Esc closes. Clicking inside the panels does not close.
- Switching tabs does not change the dialog size; the tab row stays put while the body scrolls (shrink the window height to force scrolling).
- Data tab shows pretty JSON of current settings. Edit `"zoom": 120` → 「テキストから読み込む」 → page zooms, message 「読み込みました」. Paste `{oops` → red message about JSON. Paste `{"a":1}` → red message about format. Settings unchanged in both failure cases.
- 「ファイルに書き出す」 downloads `simplePages-template-YYYYMMDD.json`; importing that file works.
- About tab: description, two links (repo, `tree/main/template`), MIT line linking `../LICENSE`, icon credit.
- 「すべて消去」 after confirm reloads with defaults.

Run: `node --test _template/test/*.test.mjs` → all pass.

- [ ] **Step 4: Commit**

```bash
git add _template/index.html
git commit -m "Template: settings modal close/backdrop, textarea import, dated export, About tab

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: LICENSE, CLAUDE.md and README updates

**Files:**
- Create: `LICENSE`
- Modify: `CLAUDE.md`, `README.md`, `docs/superpowers/specs/2026-10-13-toolbar-and-settings-modal-design.md` (icon set name)

- [ ] **Step 1: Write `LICENSE`**

```text
MIT License

Copyright (c) 2026 ytx

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Update `CLAUDE.md` 共通規約(要約)**

Replace the line starting `- 設定 UI は左下の歯車` with:

```markdown
- 右上の `header#toolbar` にアイコンボタン列(ダーク/ライト、拡大、縮小、フルスクリーン、日英、設定)。無操作 10 秒で薄くなる。`App.setToolbarAttention(true)` で減光を止めて設定ボタンを強調。
- 拡縮は `:root` の `--zoom` を全サイズ変数(`--gap`、`--fs-*`)に掛ける。設定 `zoom`(50〜200、既定 100)。
- 設定モーダルは固定サイズ、右上に ×。タブは 一般 / 表示 / (ページ固有) / データ / About。データタブはファイルとテキストエリアでエクスポート/インポート、全消去。About にページ説明・GitHub リンク・MIT ライセンス・クレジット(`ABOUT.credits` に使用 API を列挙)。
```

Replace the line starting `- ステータス帯に最終更新時刻` with:

```markdown
- 画面下部中央のステータス帯に現在時刻・最終更新時刻・状態ドット(緑/黄/赤)。失敗時も前回データを残す。ページ表題は `main` 先頭の `<h1 id="page-title">`。
```

In 「新ページの作り方」 step 1, replace `` `PAGE`、`<title>`、`SCHEMA`、`refresh()`、`renderSettingsExtra()` `` with `` `PAGE`、`<title>`、`ABOUT`、`SCHEMA`、`refresh()`、`renderSettingsExtra()`、i18n の `about_description` ``.

- [ ] **Step 3: Update root `README.md`**

Insert this paragraph between the page table and the line `共通規約と作り方は \`CLAUDE.md\` を参照してください。`:

```markdown
各ページは右上のアイコンでダーク/ライト、拡大/縮小、フルスクリーン、日英、設定を切り替えられます。ライセンスは MIT(`LICENSE`)。
```

- [ ] **Step 4: Align the spec's icon-set wording**

In `docs/superpowers/specs/2026-10-13-toolbar-and-settings-modal-design.md`, replace both occurrences of `Material Symbols` with `Material Icons`(the embedded paths are from Google's Material Icons set, also published on Google Fonts under Apache 2.0).

- [ ] **Step 5: Commit**

```bash
git add LICENSE CLAUDE.md README.md docs/superpowers/specs/2026-10-13-toolbar-and-settings-modal-design.md
git commit -m "Add MIT LICENSE; document toolbar, zoom and About tab conventions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
