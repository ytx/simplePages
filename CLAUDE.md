# simplePages

index.html 1 ファイルで動く小さな Web ページの集まり。各ページは `<page>/index.html` に置き、ビルドも外部読込も持たない。

## ページ一覧

主な使われ方で 3 つに分ける(詳細は `docs/conventions.md` 1 章・3 章)。

| 分類 | ページ | 説明 | 使用 API |
|---|---|---|---|
| ひな形 | `_template/` | 新ページのひな形(キオスク向け・PC 作業向け。コピーして使う) | なし |
| キオスク向け | `weather/` | 1 地点の天気予報を横長 1 画面に常時表示 | 気象庁 bosai JSON、Open-Meteo Forecast / Geocoding |
| キオスク向け | `calendar/` | Google カレンダーの予定を日・週・月で常時表示 | Google Apps Script ウェブアプリ(`calendar/gas/Code.gs`、CalendarApp) |
| キオスク向け | `k_timer/` | キッチンタイマー(アナログ時計 + プリセット/± 調整、終了音ループ) | なし(`k_timer/audio/*.wav` を同梱) |
| PC 作業向け | `l_timer/` | 講義用タイマー(講義/休憩サイクル、予鈴・終了音・経過音、演習サブタイマー、メモエディタ) | なし(`l_timer/audio/*.wav` を同梱) |
| スマートフォン向け | `time4u/` | 面会日程の候補提示ツール(週単位の面会可能帯、空き枠の提示文面、仮押さえ・確定) | なし(書体 `time4u/fonts/` を同梱) |
| スマートフォン向け | `midsleep/` | 睡眠中央時刻を保つための記録・目安ツール(就寝/起床をワンタップ、目標中央時刻からの起床・就寝の目安、履歴グラフ) | なし(書体 `midsleep/fonts/` を同梱) |

## 共通規約(要約)

現行の規約は `docs/conventions.md`(共通規約と、キオスク向け / PC 作業向け / スマートフォン向けの付帯事項)。以下はその要約。

- 1 ページ = `<page>/index.html` 単体。外部 `<link>`/`<script src>`/CDN/Web フォント禁止。例外として同じページディレクトリ内のメディア(音声・画像・書体ファイル)と PWA 用ファイル(`manifest.webmanifest`、アイコン PNG。`<link rel="manifest">` / `apple-touch-icon` の相対パス)は読み込んでよい。`src` に入れるパスは index.html 内の定数リストに限り、設定値や URL の文字列を直接渡さない。
- `<script id="app-logic">` に DOM に触らない純粋関数を置き `Logic` を公開。`<script id="app-ui">` に DOM・fetch・タイマーを置き `App` を公開。グローバルはこの 2 つだけ。
- 外部由来の文字列は `textContent` で挿入する。
- CSS は `:root` の変数に集約。テーマは `html[data-theme="light"|"dark"]` で変数を上書き。
- 設定は localStorage `simplePages.<page>` に `{ version, settings }`。優先順位は URL クエリ > localStorage > 既定値。URL は `?save=1` のときだけ保存。
- 右上の `header#toolbar` にアイコンボタン列(ダーク/ライト、拡大、縮小、日英、設定。フルスクリーンはキオスク向け・PC 作業向けのみ)。無操作 10 秒で薄くなる。`App.setToolbarAttention(true)` で減光を止めて設定ボタンを強調。
- 設定変更時の再取得は `DISPLAY_ONLY_KEYS`(theme / zoom / lang とページ固有の表示設定)以外のキーが変わったときだけ行う。
- 拡縮は `:root` の `--zoom` を全サイズ変数(`--gap`、`--fs-*`)に掛ける。設定 `zoom`(50〜200、既定 100)。
- 設定はキオスク向け・PC 作業向けが固定サイズのモーダル(右上に ×)、スマートフォン向けが下部タブバーの設定タブ。セクションは 一般 / 表示 / (ページ固有) / データ / About。データタブはファイルとテキストエリアでエクスポート/インポート、全消去。About にページ説明・GitHub リンク・MIT ライセンス・クレジット(`ABOUT.credits` に使用 API を列挙)。
- i18n は `Logic.I18N` 辞書と `Logic.t(lang, key, params)`。静的文字列は `data-i18n`。
- 画面下部中央のステータス帯に現在時刻・最終更新時刻・状態ドット(緑/黄/赤)。失敗時も前回データを残す。ページ表題は `main` 先頭の `<h1 id="page-title">`。
- スマートフォン向けは `100dvh` の縦積み + 下部 `nav#tabbar`、入力は `dialog#sheet`、タップ対象 44px 以上、入力欄は `font-size: max(16px, …)`、PWA の manifest とアイコンを同梱(Service Worker なし)。
- 更新は「次回更新時刻」方式。`visibilitychange` 復帰時に期限切れなら即時更新。

## 新ページの作り方

1. 分類を決める。キオスク向け・PC 作業向けは `cp -r _template <page>`、スマートフォン向けは `cp -r midsleep <page>`(タブ・Logic・設定・データ形式を置き換える)。`PAGE`、`<title>`、`ABOUT`(`ABOUT.page` はディレクトリ名)、`SCHEMA`、`refresh()`、`renderSettingsExtra()`、i18n の `about_description` を書き換え、表示だけに影響する設定キーを足すなら `DISPLAY_ONLY_KEYS` に追加する。
2. 仕様書を `docs/superpowers/specs/YYYY-MM-DD-<page>-design.md` に書く(分類を明記)。
3. `<page>/test/` に `app-logic` のテストを TDD で書く。外部 API の応答は `test/fixtures/` に保存する。
4. `<page>/README.md` に機能、設定項目、URL パラメータ、データ形式、使用 API を書く。
5. この表、ルートの `README.md`、`index.html` に分類ごとに追加する。

## テスト

```bash
node --test _template/test/*.test.mjs
node --test <page>/test/*.test.mjs
```

`test/load-logic.mjs` はテストではなくヘルパーなので、グロブは `*.test.mjs` にする(ディレクトリ指定は Node 24 で失敗する)。

Node.js 20 以上。ネットワークに依存するテストは書かない。
