# simplePages

index.html 1 ファイルで動く小さな Web ページの集まり。各ページは `<page>/index.html` に置き、ビルドも外部読込も持たない。

## ページ一覧

| ページ | 説明 | 使用 API |
|---|---|---|
| `_template/` | 新ページのひな形(コピーして使う) | なし |
| `weather/` | 1 地点の天気予報を横長 1 画面に常時表示 | 気象庁 bosai JSON、Open-Meteo Forecast / Geocoding |
| `calendar/` | Google カレンダーの予定を日・週・月で常時表示 | Google Apps Script ウェブアプリ(`calendar/gas/Code.gs`、CalendarApp) |
| `k_timer/` | キッチンタイマー(アナログ時計 + プリセット/± 調整、終了音ループ) | なし(`k_timer/audio/*.wav` を同梱) |
| `l_timer/` | 講義用タイマー(講義/休憩サイクル、予鈴・終了音・経過音、演習サブタイマー、メモエディタ) | なし(`l_timer/audio/*.wav` を同梱) |

## 共通規約(要約)

詳細は `docs/superpowers/specs/2026-10-12-simplepages-conventions-design.md`。

- 1 ページ = `<page>/index.html` 単体。外部 `<link>`/`<script src>`/CDN/Web フォント禁止。例外として同じページディレクトリ内のメディア(音声・画像)は相対パスで読み込んでよい。`src` に入れるパスは index.html 内の定数リストに限り、設定値や URL の文字列を直接渡さない。
- `<script id="app-logic">` に DOM に触らない純粋関数を置き `Logic` を公開。`<script id="app-ui">` に DOM・fetch・タイマーを置き `App` を公開。グローバルはこの 2 つだけ。
- 外部由来の文字列は `textContent` で挿入する。
- CSS は `:root` の変数に集約。テーマは `html[data-theme="light"|"dark"]` で変数を上書き。
- 設定は localStorage `simplePages.<page>` に `{ version, settings }`。優先順位は URL クエリ > localStorage > 既定値。URL は `?save=1` のときだけ保存。
- 右上の `header#toolbar` にアイコンボタン列(ダーク/ライト、拡大、縮小、フルスクリーン、日英、設定)。無操作 10 秒で薄くなる。`App.setToolbarAttention(true)` で減光を止めて設定ボタンを強調。
- 設定変更時の再取得は `DISPLAY_ONLY_KEYS`(theme / zoom / lang とページ固有の表示設定)以外のキーが変わったときだけ行う。
- 拡縮は `:root` の `--zoom` を全サイズ変数(`--gap`、`--fs-*`)に掛ける。設定 `zoom`(50〜200、既定 100)。
- 設定モーダルは固定サイズ、右上に ×。タブは 一般 / 表示 / (ページ固有) / データ / About。データタブはファイルとテキストエリアでエクスポート/インポート、全消去。About にページ説明・GitHub リンク・MIT ライセンス・クレジット(`ABOUT.credits` に使用 API を列挙)。
- i18n は `Logic.I18N` 辞書と `Logic.t(lang, key, params)`。静的文字列は `data-i18n`。
- 画面下部中央のステータス帯に現在時刻・最終更新時刻・状態ドット(緑/黄/赤)。失敗時も前回データを残す。ページ表題は `main` 先頭の `<h1 id="page-title">`。
- 更新は「次回更新時刻」方式。`visibilitychange` 復帰時に期限切れなら即時更新。

## 新ページの作り方

1. `cp -r _template <page>` し、`PAGE`、`<title>`、`ABOUT`(`ABOUT.page` はディレクトリ名)、`SCHEMA`、`refresh()`、`renderSettingsExtra()`、i18n の `about_description` を書き換え、表示だけに影響する設定キーを足すなら `DISPLAY_ONLY_KEYS` に追加する。
2. 仕様書を `docs/superpowers/specs/YYYY-MM-DD-<page>-design.md` に書く。
3. `<page>/test/` に `app-logic` のテストを TDD で書く。外部 API の応答は `test/fixtures/` に保存する。
4. `<page>/README.md` に機能、設定項目、URL パラメータ、データ形式、使用 API を書く。
5. この表にページを追加する。

## テスト

```bash
node --test _template/test/*.test.mjs
node --test <page>/test/*.test.mjs
```

`test/load-logic.mjs` はテストではなくヘルパーなので、グロブは `*.test.mjs` にする(ディレクトリ指定は Node 24 で失敗する)。

Node.js 20 以上。ネットワークに依存するテストは書かない。
