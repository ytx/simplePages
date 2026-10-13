# ツールバーと設定モーダルの改訂 設計書

日付: 2026-10-13
対象: 共通規約(`2026-10-12-simplepages-conventions-design.md`)の「HTML 骨格」「CSS」「設定 UI」「ステータス帯」節、および `_template/`、`weather/`。
本書は上記 2 つの spec を改訂する。矛盾する箇所は本書が優先する。

## 目的

- 常時表示端末で頻繫に使う操作(テーマ、拡縮、フルスクリーン、言語、設定)を右上のアイコン列に集める。
- 設定モーダルを「タブ切替でサイズが変わらない」「保存操作がない」「閉じるのは右上の ×」に統一する。
- データの持ち出し/持ち込みをファイルとテキストエリアの両方で可能にし、About タブに説明・ライセンス・クレジットを置く。

## 画面骨格

```
┌──────────────────────────────────────────[☾][+][−][⛶][文A][⚙]┐  header#toolbar
│                 ページ表題(中央。ページ側が内容を決める)         │  main 内の先頭(任意)
│                          コンテンツ                             │  main#content
├────────────── 12:34   更新 12:30   ● 正常 ──────────────────────┤  footer#status-bar
└────────────────────────────────────────────────────────────────┘
```

- `header#toolbar`: 右寄せのアイコンボタン列のみ。高さは 1 行。
- `main#content`: ページ固有。表題を置く場合は `<h1 id="page-title">` を main 先頭に中央寄せで置く。ひな形では `data-i18n="page_title"`。
- `footer#status-bar`: 中央寄せで `#clock`、`#status-message`(最終更新時刻や失敗理由)、`#status-dot`。従来の上帯の内容をここへ移す。状態の意味(緑/黄/赤)、失敗時に前回データを残す規則は変更しない。
- 左下の歯車ボタンは廃止する。

### アイドル時の減光

- 無操作 10 秒(`IDLE_MS`)でツールバー全体に `.idle`(`opacity: 0.15`)を付け、`pointermove`/`pointerdown`/`touchstart`/`keydown` で戻す。
- ページは `App.setToolbarAttention(bool)` で減光を止められる(weather の地点未設定時に使う)。attention 中は設定ボタンに `.attention` を付けて強調する。

## アイコンボタン

アイコンは Google Fonts の Material Symbols(Apache License 2.0)から選び、SVG パス(24×24 viewBox)を `<svg style="display:none">` 内の `<symbol>` として埋め込み `<use href="#icon-...">` で参照する。ネットワーク読込はしない。

| id | Material Symbols 名 | 動作 | 永続化 |
|---|---|---|---|
| `#btn-theme` | `dark_mode` / `light_mode` | 実効テーマ(`Logic.effectiveTheme(settings.theme, prefersDark)`)を反転し、`theme` に `'light'`/`'dark'` を明示保存。アイコンは「切替先」のモードを表す(ライト表示中は ☾) | 設定 `theme` |
| `#btn-zoom-in` / `#btn-zoom-out` | `zoom_in` / `zoom_out` | `zoom` を 10 刻みで 50〜200 の範囲で増減。端では `disabled` | 設定 `zoom`、URL `?zoom=` |
| `#btn-fullscreen` | `fullscreen` / `fullscreen_exit` | `document.documentElement.requestFullscreen()` と `document.exitFullscreen()` をトグル。`document.fullscreenEnabled` が偽なら `hidden`。`fullscreenchange` でアイコン切替 | なし |
| `#btn-lang` | `translate` | `lang` を ja ↔ en で反転 | 設定 `lang` |
| `#btn-settings` | `settings` | 設定モーダルを `showModal()` | — |

- 各ボタンは `<button type="button" class="icon-btn" aria-label="...">` とし、`aria-label` は `data-i18n-label="key"` で現在言語に置換する(`textContent` ではなく属性を置換する新しい規約)。
- 設定タブの「表示」には従来どおり `theme`(auto/light/dark)、`lang` のセレクトも残す。ボタンは auto を上書きするだけで、auto に戻すのはセレクトから行う。

### 拡縮の仕組み

- `:root` に `--zoom: 1` を置き、サイズ系の変数はすべて `calc(<従来値> * var(--zoom))` の形にする(`--gap`、`--fs-base`、`--fs-small`、`--fs-large`、weather の `--fs-temp` など)。`--fs-small`/`--fs-large` のように `--fs-base` から派生する変数は二重に掛けない。
- `App.applyZoom(zoom)` が `document.documentElement.style.setProperty('--zoom', String(zoom / 100))` を行う。起動時と `zoom` 変更時に呼ぶ。
- `html` の `font-size` は変えない(現状の変数が px/vw ベースのため効かない)。

## 設定モーダル

```
┌ 設定 ─────────────────────────────────────── [×] ┐  .dlg-header
│ 一般 │ 表示 │ (ページ固有…) │ データ │ About       │  .tabs(固定、スクロールしない)
│                                                   │
│  本文(このエリアだけ overflow: auto)              │  .tab-body
│                                                   │
└───────────────────────────────────────────────────┘
```

- `dialog#settings` は `width: min(90vw, 36em); height: min(85vh, 32em)` の固定サイズ。内部は `display: grid; grid-template-rows: auto auto 1fr` の 3 行。本文 `.tab-body` のみ `overflow: auto`。タブを切り替えてもダイアログの外形は変わらない。
- ヘッダ右端の × は `icon-btn` + `close` アイコン。Esc(dialog 既定)と背景クリック(`dialog` 自身への click)でも閉じる。
- 保存ボタンは置かない。各入力は `change` で即保存・即反映(現状どおり)。
- タブ順: 一般 / 表示 / ページ固有タブ(0 個以上) / データ / About。About は常に最後。

### データタブ

- ボタン行: 「ファイルに書き出す」(`{version, settings}` を `simplePages-<page>-YYYYMMDD.json` でダウンロード)、「ファイルから読み込む」(`<input type="file" accept="application/json">`)、「全データを削除」(`confirm` → localStorage のキー削除 → 既定値で再描画)。
- テキストエリア `#data-text`: データタブを表示するたびに現在の `{version, settings}` を `JSON.stringify(…, null, 2)` で表示する。編集可。
- 「テキストから読み込む」ボタン: テキストエリアの内容をインポートする。
- ファイル/テキストのインポートは共通の `Logic.parseImport(text, version)` を通す。戻り値は `{ ok: true, settings }` か `{ ok: false, reason }`(reason は `'invalid_json'` | `'unrecognized_format'`)。`ok` のとき `App.updateSettings(settings)`(検証を含む)。
- 結果は `#data-message` にモーダル内で表示する(成功は通常色、失敗は `--error` 色)。ステータス帯はモーダルの背後なので使わない。

### About タブ

表示順:

1. ページ説明: i18n キー `about_description`。
2. リンク: リポジトリ `https://github.com/ytx/simplePages`、ページディレクトリ `https://github.com/ytx/simplePages/tree/main/<page>`。`target="_blank" rel="noopener"`。
3. ライセンス: 「MIT License / Copyright (c) 2026 ytx」とルート `LICENSE` への相対リンク `../LICENSE`。
4. クレジット: 固定で「Icons: Material Symbols (Google) — Apache License 2.0」。続けてページが宣言する API 一覧。

ページ側は `app-ui` 先頭の定数だけを書き換える:

```js
const ABOUT = {
  page: 'weather',
  credits: [
    { name: '気象庁 天気予報 JSON (bosai)', url: 'https://www.jma.go.jp/bosai/' },
    { name: 'Open-Meteo', url: 'https://open-meteo.com/', note: 'CC BY 4.0' },
  ],
};
```

リンク文字列は `textContent`、`href` は定数由来のみ。ひな形の `credits` は空配列。

## Logic への追加(両ページ共通、テスト対象)

| 関数 | 仕様 |
|---|---|
| `stepZoom(current, dir)` | `dir` は `+1`/`-1`。`current` を 10 の倍数へ丸めてから ±10 し、50〜200 にクランプして返す |
| `toggleTheme(effective)` | `'dark'` → `'light'`、それ以外 → `'dark'` |
| `toggleLang(lang)` | `'ja'` → `'en'`、それ以外 → `'ja'` |
| `parseImport(text, version)` | 上記。空白のみの文字列は `invalid_json`。`migrateStored` を内部で呼ぶ |

設定スキーマに `zoom: { type: 'int', min: 50, max: 200, default: 100 }` を追加。`VERSION` は 1 のまま(キー追加は既定値で埋まるため移行不要)。

i18n に追加するキー: `zoom_in`, `zoom_out`, `fullscreen`, `exit_fullscreen`, `toggle_theme`, `toggle_lang`, `tab_about`, `export_file`, `import_file`, `import_text`, `data_hint`, `import_ok`, `import_failed_json`, `import_failed_format`, `about_description`, `about_links`, `about_repo`, `about_page`, `about_license`, `about_credits`, `credit_icons`。

## weather への適用

- 上帯の地点名を main 先頭の `<h1 id="page-title">` に中央表示(class10 名を含む現在の文字列)。時計・最終更新・ドットは下帯へ。
- `--fs-temp` にも `* var(--zoom)` を掛ける。
- `hourlyCount()` の高さ判定(`innerHeight < 900 ? 12 : 24`)はそのまま。zoom を上げたときの収まりはユーザーが zoom で調整する前提とし、自動調整はしない。
- 地点未設定時は `App.setToolbarAttention(true)`、設定後に `false`。
- `ABOUT.credits` に気象庁と Open-Meteo。
- README の「左下の歯車」記述と `set_location_hint` を「右上の設定ボタン」に改める。

## ドキュメント

- ルートに `LICENSE`(MIT、`Copyright (c) 2026 ytx`)。
- `CLAUDE.md` の規約要約を更新(右上ツールバー、下帯、データ/About タブ、`--zoom`)。
- `_template/README.md` は無いので作らない。`weather/README.md` の手動確認手順を更新。
- 共通規約 spec の該当節は本書への参照と要点に書き換える。

## テスト

- `_template/test/logic.test.mjs` と `weather/test/settings.test.mjs` に `stepZoom`(端、丸め)、`toggleTheme`、`toggleLang`、`parseImport`(正常、壊れた JSON、未知形式、空文字)、`zoom` の coerce(範囲外 → 既定値、URL 文字列 → 数値)を追加。
- DOM 挙動(フルスクリーン、減光、モーダル寸法)はブラウザで手動確認する。確認項目を weather README に列挙する。

## 範囲外

- アイコン列の並び順やボタンのカスタマイズ設定。
- フルスクリーン状態の永続化(ブラウザが許可しない)。
- zoom に応じた時間別本数の自動調整。
