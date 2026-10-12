# simplePages 共通ひな形(_template)実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全ページが従う共通規約を、コピーして使えるひな形 `_template/index.html` とテストヘルパー、ルート CLAUDE.md として実装する。

**Architecture:** index.html 1 ファイルに `<script id="app-logic">`(純粋関数、`Logic` を公開)と `<script id="app-ui">`(DOM・タイマー、`App` を公開)を置く。テストは Node の `vm` で `app-logic` だけを切り出して実行する。設定は `simplePages.<page>` キーの localStorage と URL クエリをマージして解決する。

**Tech Stack:** HTML/CSS/JavaScript(ES2020、ブラウザ標準 API のみ)、Node.js 20 以上の `node --test`。外部ライブラリなし。

**Spec:** `docs/superpowers/specs/2026-10-12-simplepages-conventions-design.md`

## Global Constraints

- 各ページは `<page>/index.html` 単体で動作する。外部 `<link>`、外部 `<script src>`、CDN、Web フォントは使わない。
- グローバルに公開するのは `Logic` と `App` のみ。
- 外部由来の文字列は `textContent` で挿入する。`innerHTML` に外部データを渡さない。
- localStorage のキーは `simplePages.<page>`。値は `{ "version": 1, "settings": {...} }`。
- 設定の優先順位は URL クエリ > localStorage > 既定値。URL は `?save=1` のときだけ保存する。
- テーマは `html[data-theme="light"|"dark"]`。初期値は `prefers-color-scheme`。
- 既定言語はブラウザ言語が `ja` で始まれば `ja`、それ以外は `en`。
- 歯車ボタンは右下固定、無操作 10 秒で薄くする。
- 更新は「次回更新時刻」方式で、`visibilitychange` 復帰時に期限切れなら即時更新する。
- テストは `node --test <page>/test/` で実行し、ネットワークに依存しない。
- コミットメッセージ末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` を付ける。

## Review Focus

1. localStorage に壊れた JSON や `version` のない値が入っていても起動する(Task 2 のテストで `migrateStored` の不正入力を確認)。
2. URL クエリの数値が `abc` や範囲外でも既定値に戻る(Task 2 のテスト)。
3. localStorage が例外を投げる環境(プライベートモード、容量超過)で画面が白くならない(Task 4 の `storage.read/write` を try/catch にし、手動確認手順に含める)。
4. `lang=en` を URL で渡したときに `<html lang>` と `data-i18n` の文字列が一括で切り替わる(Task 4 の手動確認)。
5. インポートした JSON に未知のキーがあっても無視され、既知キーだけ反映される(Task 2 の `resolveSettings` 未知キー無視テスト)。

---

### Task 1: テストヘルパーと app-logic の骨格

**Files:**
- Create: `_template/index.html`(最小の骨格のみ。Task 4 で完成させる)
- Create: `_template/test/load-logic.mjs`
- Create: `_template/test/logic.test.mjs`

**Interfaces:**
- Produces: `loadLogic(htmlPath: string): object` — index.html から `<script id="app-logic">` を切り出して評価し、`Logic` オブジェクトを返す。
- Produces: `Logic.VERSION: number`(設定スキーマ版、初期値 1)。

- [ ] **Step 1: 失敗するテストを書く**

`_template/test/load-logic.mjs`:

```js
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadLogic(htmlPath) {
  const html = readFileSync(htmlPath, 'utf8');
  const m = html.match(/<script id="app-logic">([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`app-logic script not found in ${htmlPath}`);
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(m[1] + '\n;globalThis.Logic = Logic;', ctx, { filename: htmlPath });
  return ctx.Logic;
}
```

`_template/test/logic.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const html = fileURLToPath(new URL('../index.html', import.meta.url));
const Logic = loadLogic(html);

test('Logic exposes VERSION', () => {
  assert.equal(Logic.VERSION, 1);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test _template/test/`
Expected: FAIL(`ENOENT ... _template/index.html`)

- [ ] **Step 3: 最小の index.html を書く**

`_template/index.html`:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Template</title>
<style></style>
</head>
<body>
<main id="content"></main>
<script id="app-logic">
const Logic = (() => {
  const VERSION = 1;
  return { VERSION };
})();
</script>
<script id="app-ui">
const App = (() => {
  return {};
})();
</script>
</body>
</html>
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test _template/test/`
Expected: PASS(1 test)

- [ ] **Step 5: コミット**

```bash
git add _template
git commit -m "Add _template skeleton and app-logic test loader

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: 設定の解決 `resolveSettings` と `migrateStored`

**Files:**
- Modify: `_template/index.html`(`app-logic` 内)
- Modify: `_template/test/logic.test.mjs`

**Interfaces:**
- Produces: `Logic.resolveSettings(schema, stored, query) => settings`
  - `schema`: `{ [key]: { type: 'int'|'enum'|'string'|'object', default, min?, max?, values? } }`
  - `stored`: `migrateStored` が返した settings オブジェクト(`{}` 可)
  - `query`: `{ [key]: string }`(`Object.fromEntries(new URLSearchParams(location.search))`)。`int` と `enum` は文字列から変換する。`object` は query から受け取らない。
- Produces: `Logic.migrateStored(raw, version) => settings`
  - `raw`: `JSON.parse` 済みの値または `null`。`{ version, settings }` 形式でなければ `{}`。`version` が現版より古ければ `MIGRATIONS[version]` を順に適用する(現版では空)。
- Produces: `Logic.coerce(spec, value) => value|undefined`(不正なら `undefined`)。

- [ ] **Step 1: 失敗するテストを書く**

`_template/test/logic.test.mjs` に追記:

```js
const schema = {
  theme: { type: 'enum', values: ['auto', 'light', 'dark'], default: 'auto' },
  lang: { type: 'enum', values: ['ja', 'en'], default: 'ja' },
  refreshMinutes: { type: 'int', min: 1, max: 120, default: 10 },
  title: { type: 'string', default: '' },
  location: { type: 'object', default: null },
};

test('resolveSettings returns defaults when nothing stored', () => {
  const s = Logic.resolveSettings(schema, {}, {});
  assert.deepEqual(s, { theme: 'auto', lang: 'ja', refreshMinutes: 10, title: '', location: null });
});

test('resolveSettings: query overrides stored overrides default', () => {
  const s = Logic.resolveSettings(schema, { theme: 'dark', refreshMinutes: 30 }, { refreshMinutes: '5' });
  assert.equal(s.theme, 'dark');
  assert.equal(s.refreshMinutes, 5);
});

test('resolveSettings: invalid values fall back to default', () => {
  const s = Logic.resolveSettings(schema, { theme: 'blue', refreshMinutes: 999 }, { refreshMinutes: 'abc', lang: 'fr' });
  assert.equal(s.theme, 'auto');
  assert.equal(s.refreshMinutes, 10);
  assert.equal(s.lang, 'ja');
});

test('resolveSettings: unknown keys are ignored, object type ignores query', () => {
  const s = Logic.resolveSettings(schema, { bogus: 1, location: { lat: 1 } }, { location: 'x', other: 'y' });
  assert.equal('bogus' in s, false);
  assert.deepEqual(s.location, { lat: 1 });
});

test('migrateStored: accepts current format, rejects garbage', () => {
  assert.deepEqual(Logic.migrateStored({ version: 1, settings: { theme: 'dark' } }, 1), { theme: 'dark' });
  assert.deepEqual(Logic.migrateStored(null, 1), {});
  assert.deepEqual(Logic.migrateStored('junk', 1), {});
  assert.deepEqual(Logic.migrateStored({ theme: 'dark' }, 1), {});
  assert.deepEqual(Logic.migrateStored({ version: 1, settings: 'x' }, 1), {});
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test _template/test/`
Expected: FAIL(`Logic.resolveSettings is not a function`)

- [ ] **Step 3: 実装**

`app-logic` の `Logic` を次に置き換える:

```js
const Logic = (() => {
  const VERSION = 1;
  // version n の settings を n+1 へ変換する関数を MIGRATIONS[n] に置く。
  const MIGRATIONS = {};

  function coerce(spec, value) {
    if (value === undefined || value === null) return undefined;
    switch (spec.type) {
      case 'int': {
        const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
        if (!Number.isInteger(n)) return undefined;
        if (spec.min !== undefined && n < spec.min) return undefined;
        if (spec.max !== undefined && n > spec.max) return undefined;
        return n;
      }
      case 'enum': {
        const v = typeof spec.values[0] === 'number' ? Number(value) : String(value);
        return spec.values.includes(v) ? v : undefined;
      }
      case 'string':
        return String(value);
      case 'object':
        return typeof value === 'object' ? value : undefined;
      default:
        return undefined;
    }
  }

  function resolveSettings(schema, stored, query) {
    const out = {};
    for (const [key, spec] of Object.entries(schema)) {
      let v = coerce(spec, stored && stored[key]);
      if (spec.type !== 'object' && query && query[key] !== undefined) {
        const q = coerce(spec, query[key]);
        if (q !== undefined) v = q;
      }
      out[key] = v === undefined ? spec.default : v;
    }
    return out;
  }

  function migrateStored(raw, version) {
    if (!raw || typeof raw !== 'object' || typeof raw.settings !== 'object' || raw.settings === null) return {};
    if (!Number.isInteger(raw.version)) return {};
    let settings = raw.settings;
    for (let v = raw.version; v < version; v++) {
      const m = MIGRATIONS[v];
      if (!m) return {};
      settings = m(settings);
    }
    return settings;
  }

  return { VERSION, coerce, resolveSettings, migrateStored };
})();
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test _template/test/`
Expected: PASS(6 tests)

- [ ] **Step 5: コミット**

```bash
git add _template
git commit -m "Add resolveSettings and migrateStored to template logic

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: i18n 辞書と `t()`、言語・テーマの初期判定

**Files:**
- Modify: `_template/index.html`(`app-logic` 内)
- Modify: `_template/test/logic.test.mjs`

**Interfaces:**
- Produces: `Logic.I18N = { ja: {...}, en: {...} }`
- Produces: `Logic.t(lang, key, params?) => string`。`lang` に無ければ `ja`、それにも無ければ `key` を返す。`{name}` を `params.name` で置換。
- Produces: `Logic.detectLang(navigatorLanguage) => 'ja'|'en'`
- Produces: `Logic.effectiveTheme(setting, prefersDark) => 'light'|'dark'`

- [ ] **Step 1: 失敗するテストを書く**

```js
test('t: lookup, fallback to ja, then key, with params', () => {
  assert.equal(Logic.t('ja', 'settings'), '設定');
  assert.equal(Logic.t('en', 'settings'), 'Settings');
  assert.equal(Logic.t('en', 'no.such.key'), 'no.such.key');
  assert.equal(Logic.t('en', 'updated_at', { time: '19:40' }), 'Updated 19:40');
});

test('detectLang', () => {
  assert.equal(Logic.detectLang('ja-JP'), 'ja');
  assert.equal(Logic.detectLang('en-US'), 'en');
  assert.equal(Logic.detectLang(undefined), 'en');
});

test('effectiveTheme', () => {
  assert.equal(Logic.effectiveTheme('auto', true), 'dark');
  assert.equal(Logic.effectiveTheme('auto', false), 'light');
  assert.equal(Logic.effectiveTheme('light', true), 'light');
  assert.equal(Logic.effectiveTheme('dark', false), 'dark');
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test _template/test/`
Expected: FAIL(`Logic.t is not a function`)

- [ ] **Step 3: 実装**

`Logic` 内、`return` の前に追記し、`return` に `I18N, t, detectLang, effectiveTheme` を加える:

```js
  const I18N = {
    ja: {
      settings: '設定',
      tab_general: '一般',
      tab_display: '表示',
      tab_data: 'データ',
      language: '言語',
      theme: 'テーマ',
      theme_auto: '自動',
      theme_light: 'ライト',
      theme_dark: 'ダーク',
      refresh_minutes: '更新間隔(分)',
      export_json: 'JSON をエクスポート',
      import_json: 'JSON をインポート',
      clear_all: 'すべて消去',
      confirm_clear: '保存した設定をすべて消去します。よろしいですか?',
      import_failed: 'インポートに失敗しました: {reason}',
      close: '閉じる',
      updated_at: '最終更新 {time}',
      updating: '更新中',
      never_updated: '未取得',
      error_fetch: '取得失敗: {reason}',
      placeholder_content: 'ここにページ固有の UI',
    },
    en: {
      settings: 'Settings',
      tab_general: 'General',
      tab_display: 'Display',
      tab_data: 'Data',
      language: 'Language',
      theme: 'Theme',
      theme_auto: 'Auto',
      theme_light: 'Light',
      theme_dark: 'Dark',
      refresh_minutes: 'Refresh interval (min)',
      export_json: 'Export JSON',
      import_json: 'Import JSON',
      clear_all: 'Clear all',
      confirm_clear: 'Delete all saved settings?',
      import_failed: 'Import failed: {reason}',
      close: 'Close',
      updated_at: 'Updated {time}',
      updating: 'Updating',
      never_updated: 'Not fetched yet',
      error_fetch: 'Fetch failed: {reason}',
      placeholder_content: 'Page-specific UI goes here',
    },
  };

  function t(lang, key, params) {
    const dict = I18N[lang] || I18N.ja;
    let s = dict[key] ?? I18N.ja[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    }
    return s;
  }

  function detectLang(navigatorLanguage) {
    return typeof navigatorLanguage === 'string' && navigatorLanguage.toLowerCase().startsWith('ja') ? 'ja' : 'en';
  }

  function effectiveTheme(setting, prefersDark) {
    if (setting === 'light' || setting === 'dark') return setting;
    return prefersDark ? 'dark' : 'light';
  }
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test _template/test/`
Expected: PASS(9 tests)

- [ ] **Step 5: コミット**

```bash
git add _template
git commit -m "Add i18n dictionary, t(), detectLang and effectiveTheme

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: ひな形 UI(CSS 変数、テーマ、ステータス帯、歯車、設定モーダル、ストア、更新タイマー)

**Files:**
- Modify: `_template/index.html`(`<style>`、`<body>`、`app-ui`)

**Interfaces:**
- Consumes: `Logic.resolveSettings`, `Logic.migrateStored`, `Logic.t`, `Logic.detectLang`, `Logic.effectiveTheme`, `Logic.VERSION`
- Produces(ページがコピー後に差し替える箇所):
  - `const PAGE = 'template'`(localStorage キー `simplePages.template`)
  - `const SCHEMA`(設定スキーマ。各ページで拡張)
  - `App.refresh()`(ページ固有の取得処理。ひな形では現在時刻を表示するだけ)
  - `App.renderSettingsExtra(settings)`(ページ固有の設定タブ描画。ひな形では空)
- Produces(共通 API):
  - `App.getSettings() => settings`
  - `App.updateSettings(patch)`:マージして保存し、`applySettings` を呼ぶ
  - `App.setStatus(state: 'ok'|'busy'|'error', message?: string)`
  - `App.scheduleRefresh()`:次回更新時刻を `settings.refreshMinutes` 分後に設定

- [ ] **Step 1: `<style>` を書く**

```css
:root {
  --bg: #f6f7f9;
  --bg-panel: #ffffff;
  --fg: #1c1f26;
  --fg-muted: #5c6370;
  --border: #d9dde3;
  --accent: #2b7de9;
  --ok: #2fa84f;
  --busy: #e6a700;
  --error: #d64545;
  --radius: 10px;
  --gap: clamp(8px, 1vw, 16px);
  --fs-base: clamp(14px, 1.2vw, 20px);
  --fs-small: calc(var(--fs-base) * 0.8);
  --fs-large: calc(var(--fs-base) * 1.6);
  --font: system-ui, -apple-system, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif;
}
html[data-theme="dark"] {
  --bg: #12151b;
  --bg-panel: #1b1f27;
  --fg: #e7eaf0;
  --fg-muted: #9aa3b2;
  --border: #2d333f;
  --accent: #5b9cf5;
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font);
  font-size: var(--fs-base);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
#status-bar {
  display: flex;
  align-items: center;
  gap: var(--gap);
  padding: calc(var(--gap) / 2) var(--gap);
  border-bottom: 1px solid var(--border);
  font-size: var(--fs-small);
  color: var(--fg-muted);
}
#status-bar .title { color: var(--fg); font-weight: 600; }
#status-bar .spacer { flex: 1; }
#status-dot {
  width: 0.7em; height: 0.7em; border-radius: 50%;
  background: var(--fg-muted);
}
#status-dot[data-state="ok"] { background: var(--ok); }
#status-dot[data-state="busy"] { background: var(--busy); }
#status-dot[data-state="error"] { background: var(--error); }
#status-message[data-state="error"] { color: var(--error); }
#content { flex: 1; min-height: 0; padding: var(--gap); }
#settings-btn {
  position: fixed; right: var(--gap); bottom: var(--gap);
  width: 2.6em; height: 2.6em; border-radius: 50%;
  border: 1px solid var(--border); background: var(--bg-panel); color: var(--fg);
  cursor: pointer; display: grid; place-items: center;
  transition: opacity 0.6s;
}
#settings-btn.idle { opacity: 0.15; }
#settings-btn svg { width: 1.3em; height: 1.3em; fill: currentColor; }
dialog#settings {
  background: var(--bg-panel); color: var(--fg);
  border: 1px solid var(--border); border-radius: var(--radius);
  width: min(90vw, 36em); padding: 0;
}
dialog#settings::backdrop { background: rgba(0,0,0,0.5); }
.dlg-header { display: flex; align-items: center; padding: var(--gap); border-bottom: 1px solid var(--border); }
.dlg-header h2 { margin: 0; font-size: var(--fs-base); flex: 1; }
.tabs { display: flex; gap: 2px; padding: 0 var(--gap); border-bottom: 1px solid var(--border); }
.tabs button {
  background: none; border: none; color: var(--fg-muted); padding: 0.6em 1em;
  cursor: pointer; border-bottom: 2px solid transparent; font: inherit;
}
.tabs button[aria-selected="true"] { color: var(--fg); border-bottom-color: var(--accent); }
.tab-panel { display: none; padding: var(--gap); }
.tab-panel.active { display: block; }
.field { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); align-items: center; margin-bottom: var(--gap); }
.field label { color: var(--fg-muted); }
select, input, button.btn {
  font: inherit; color: var(--fg); background: var(--bg); border: 1px solid var(--border);
  border-radius: 6px; padding: 0.4em 0.6em;
}
button.btn { cursor: pointer; }
button.btn.danger { color: var(--error); }
.row { display: flex; gap: var(--gap); flex-wrap: wrap; }
```

- [ ] **Step 2: `<body>` を書く**

```html
<header id="status-bar">
  <span class="title" id="page-title" data-i18n="placeholder_content"></span>
  <span class="spacer"></span>
  <span id="clock"></span>
  <span id="status-message"></span>
  <span id="status-dot" data-state="none"></span>
</header>
<main id="content">
  <p data-i18n="placeholder_content"></p>
</main>
<button id="settings-btn" type="button" aria-label="Settings">
  <svg viewBox="0 0 24 24"><path d="M19.4 13a7.9 7.9 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a8 8 0 0 0-1.7-1L15 3.3H9l-.3 2.6a8 8 0 0 0-1.7 1l-2.5-1-2 3.5L4.6 11a7.9 7.9 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a8 8 0 0 0 1.7 1l.3 2.6h6l.3-2.6a8 8 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>
</button>
<dialog id="settings">
  <div class="dlg-header">
    <h2 data-i18n="settings"></h2>
    <button class="btn" id="settings-close" data-i18n="close"></button>
  </div>
  <div class="tabs" role="tablist">
    <button role="tab" data-tab="general" aria-selected="true" data-i18n="tab_general"></button>
    <button role="tab" data-tab="display" data-i18n="tab_display"></button>
    <button role="tab" data-tab="data" data-i18n="tab_data"></button>
  </div>
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
      <button class="btn" id="btn-export" data-i18n="export_json"></button>
      <button class="btn" id="btn-import" data-i18n="import_json"></button>
      <input id="import-file" type="file" accept="application/json" hidden>
      <button class="btn danger" id="btn-clear" data-i18n="clear_all"></button>
    </div>
  </section>
</dialog>
```

- [ ] **Step 3: `app-ui` を書く**

```js
const App = (() => {
  const PAGE = 'template';
  const STORAGE_KEY = `simplePages.${PAGE}`;
  const SCHEMA = {
    lang: { type: 'enum', values: ['ja', 'en'], default: Logic.detectLang(navigator.language) },
    theme: { type: 'enum', values: ['auto', 'light', 'dark'], default: 'auto' },
    refreshMinutes: { type: 'int', min: 1, max: 120, default: 10 },
  };
  const IDLE_MS = 10000;

  let settings = {};
  let nextRefreshAt = 0;
  let refreshTimer = null;
  let idleTimer = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const storage = {
    read() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
    },
    write(s) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: Logic.VERSION, settings: s })); } catch { /* ignore */ }
    },
    clear() {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    },
  };

  function loadSettings() {
    const query = Object.fromEntries(new URLSearchParams(location.search));
    const stored = Logic.migrateStored(storage.read(), Logic.VERSION);
    settings = Logic.resolveSettings(SCHEMA, stored, query);
    if (query.save === '1') storage.write(settings);
  }

  function getSettings() { return { ...settings }; }

  function updateSettings(patch) {
    settings = Logic.resolveSettings(SCHEMA, { ...settings, ...patch }, {});
    storage.write(settings);
    applySettings();
  }

  function applyI18n() {
    document.documentElement.lang = settings.lang;
    for (const el of $$('[data-i18n]')) el.textContent = Logic.t(settings.lang, el.dataset.i18n);
  }

  function applyTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = Logic.effectiveTheme(settings.theme, prefersDark);
  }

  function applySettings() {
    applyI18n();
    applyTheme();
    for (const el of $$('[data-setting]')) el.value = settings[el.dataset.setting];
    renderSettingsExtra(settings);
    scheduleRefresh(0);
  }

  function setStatus(state, message) {
    $('#status-dot').dataset.state = state;
    const el = $('#status-message');
    el.dataset.state = state;
    el.textContent = message || '';
  }

  function formatTime(d) {
    return new Intl.DateTimeFormat(settings.lang === 'ja' ? 'ja-JP' : 'en-US', { hour: '2-digit', minute: '2-digit' }).format(d);
  }

  function tickClock() {
    const d = new Date();
    $('#clock').textContent = new Intl.DateTimeFormat(settings.lang === 'ja' ? 'ja-JP' : 'en-US',
      { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
  }

  // ページ固有: ここでデータを取得して描画する。ひな形は更新時刻を表示するだけ。
  async function refresh() {
    setStatus('busy', Logic.t(settings.lang, 'updating'));
    await Promise.resolve();
    setStatus('ok', Logic.t(settings.lang, 'updated_at', { time: formatTime(new Date()) }));
  }

  // ページ固有: 設定タブに項目を追加する。
  function renderSettingsExtra(_settings) {}

  function scheduleRefresh(delayMs) {
    clearTimeout(refreshTimer);
    const delay = delayMs ?? settings.refreshMinutes * 60000;
    nextRefreshAt = Date.now() + delay;
    refreshTimer = setTimeout(async () => {
      await refresh();
      scheduleRefresh();
    }, delay);
  }

  function onVisibility() {
    if (document.visibilityState === 'visible' && Date.now() >= nextRefreshAt) scheduleRefresh(0);
  }

  function resetIdle() {
    $('#settings-btn').classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => $('#settings-btn').classList.add('idle'), IDLE_MS);
  }

  function bindSettingsDialog() {
    const dlg = $('#settings');
    $('#settings-btn').addEventListener('click', () => dlg.showModal());
    $('#settings-close').addEventListener('click', () => dlg.close());
    for (const tab of $$('[role="tab"]')) {
      tab.addEventListener('click', () => {
        for (const t2 of $$('[role="tab"]')) t2.setAttribute('aria-selected', String(t2 === tab));
        for (const p of $$('.tab-panel')) p.classList.toggle('active', p.dataset.panel === tab.dataset.tab);
      });
    }
    for (const el of $$('[data-setting]')) {
      el.addEventListener('change', () => updateSettings({ [el.dataset.setting]: el.value }));
    }
    $('#btn-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ version: Logic.VERSION, settings }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${PAGE}-settings.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    $('#btn-import').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      try {
        const raw = JSON.parse(await file.text());
        const imported = Logic.migrateStored(raw, Logic.VERSION);
        if (Object.keys(imported).length === 0) throw new Error('unrecognized format');
        updateSettings(imported);
      } catch (e) {
        setStatus('error', Logic.t(settings.lang, 'import_failed', { reason: e.message }));
      }
      ev.target.value = '';
    });
    $('#btn-clear').addEventListener('click', () => {
      if (!confirm(Logic.t(settings.lang, 'confirm_clear'))) return;
      storage.clear();
      location.href = location.pathname;
    });
  }

  function init() {
    loadSettings();
    bindSettingsDialog();
    applySettings();
    tickClock();
    setInterval(tickClock, 1000);
    document.addEventListener('visibilitychange', onVisibility);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    for (const ev of ['mousemove', 'touchstart', 'keydown']) document.addEventListener(ev, resetIdle, { passive: true });
    resetIdle();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { getSettings, updateSettings, setStatus, scheduleRefresh, refresh };
})();
```

- [ ] **Step 4: Node テストが引き続き通ることを確認**

Run: `node --test _template/test/`
Expected: PASS(9 tests)

- [ ] **Step 5: ブラウザで手動確認**

`open _template/index.html` で開き、以下を確認する。

1. ステータス帯に現在時刻と「最終更新 HH:MM」、緑のドットが出る。
2. 歯車が 10 秒後に薄くなり、マウスを動かすと戻る。
3. 歯車 → 表示タブ → テーマを「ダーク」にすると背景が暗くなる。再読込しても維持される。
4. 言語を English にすると、設定モーダルとステータス帯の文字が英語になり、`document.documentElement.lang` が `en` になる。
5. `index.html?lang=en&theme=dark` で開くと英語・ダークになり、再読込(クエリなし)では保存した値に戻る。`?lang=en&save=1` の後はクエリなしでも英語になる。
6. データタブ → エクスポートで `template-settings.json` が落ち、インポートで戻せる。壊れた JSON を選ぶとステータス帯に赤で理由が出る。
7. すべて消去で確認ダイアログ後に初期状態へ戻る。
8. DevTools で `localStorage.setItem('simplePages.template', '{bad')` を実行して再読込しても白画面にならない。

- [ ] **Step 6: コミット**

```bash
git add _template
git commit -m "Implement template UI: theme, status bar, settings dialog, storage, refresh timer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: ルート CLAUDE.md と README.md

**Files:**
- Create: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: CLAUDE.md を書く**

```markdown
# simplePages

index.html 1 ファイルで動く小さな Web ページの集まり。各ページは `<page>/index.html` に置き、ビルドも外部読込も持たない。

## ページ一覧

| ページ | 説明 | 使用 API |
|---|---|---|
| `_template/` | 新ページのひな形(コピーして使う) | なし |

## 共通規約(要約)

詳細は `docs/superpowers/specs/2026-10-12-simplepages-conventions-design.md`。

- 1 ページ = `<page>/index.html` 単体。外部 `<link>`/`<script src>`/CDN/Web フォント禁止。
- `<script id="app-logic">` に DOM に触らない純粋関数を置き `Logic` を公開。`<script id="app-ui">` に DOM・fetch・タイマーを置き `App` を公開。グローバルはこの 2 つだけ。
- 外部由来の文字列は `textContent` で挿入する。
- CSS は `:root` の変数に集約。テーマは `html[data-theme="light"|"dark"]` で変数を上書き。
- 設定は localStorage `simplePages.<page>` に `{ version, settings }`。優先順位は URL クエリ > localStorage > 既定値。URL は `?save=1` のときだけ保存。
- 設定 UI は右下の歯車 → モーダル(一般 / 表示 / データ)。データタブに JSON エクスポート/インポート/全消去。
- i18n は `Logic.I18N` 辞書と `Logic.t(lang, key, params)`。静的文字列は `data-i18n`。
- ステータス帯に最終更新時刻と状態ドット(緑/黄/赤)。失敗時も前回データを残す。
- 更新は「次回更新時刻」方式。`visibilitychange` 復帰時に期限切れなら即時更新。

## 新ページの作り方

1. `cp -r _template <page>` し、`PAGE`、`<title>`、`SCHEMA`、`refresh()`、`renderSettingsExtra()` を書き換える。
2. 仕様書を `docs/superpowers/specs/YYYY-MM-DD-<page>-design.md` に書く。
3. `<page>/test/` に `app-logic` のテストを TDD で書く。外部 API の応答は `test/fixtures/` に保存する。
4. `<page>/README.md` に機能、設定項目、URL パラメータ、データ形式、使用 API を書く。
5. この表にページを追加する。

## テスト

```bash
node --test _template/test/
node --test <page>/test/
```

Node.js 20 以上。ネットワークに依存するテストは書かない。
```

- [ ] **Step 2: README.md を書く**

```markdown
# simplePages

index.html だけで動くシンプルなページの集まりです。各ディレクトリの `index.html` をブラウザで開くか、静的ホスティングに置いて使います。

| ページ | 説明 |
|---|---|
| `_template/` | 新しいページのひな形 |

共通規約と作り方は `CLAUDE.md` を参照してください。
```

- [ ] **Step 3: コミット**

```bash
git add CLAUDE.md README.md
git commit -m "Add root CLAUDE.md with shared conventions and page list

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
