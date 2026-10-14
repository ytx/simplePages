# simplePages 共通規約 設計書

日付: 2026-10-12
状態: 承認済み(会話で合意)

## 目的

simplePages は、独立した小さな Web ページを `<page>/index.html` として集めるリポジトリである。
各ページは index.html 単体で動作し、ビルド工程も外部読込も持たない。
例外: 同じページディレクトリ内のメディアファイル(音声・画像)は相対パスで読み込んでよい(例: `k_timer/audio/*.wav`)。`src` に入れるパスは index.html 内の定数リストに限り、設定値や URL クエリの文字列をそのまま `src` に渡さない。CDN・他ドメイン・他ページディレクトリの参照は引き続き禁止。
本書は全ページが従う共通規約と、新ページの起点となるひな形を定める。

参考にした既存プロジェクト: ../mqtt_p(Bootstrap CDN + 単一 HTML)、../l_timer(js/css 分離、i18n)、../b_report(単一 HTML + script.js)。
これらの作りを模倣はしないが、設定モーダル・localStorage 保存・ダークモード・JSON エクスポート/インポートという共通要素を引き継ぐ。

## 共通化の方式

採用: **規約文書 + ひな形ページ**。

- ルート `CLAUDE.md` に本規約の要約とページ一覧を書く。
- ルート `_template/index.html` に共通部分を実装済みのひな形を置く。新ページはこれをコピーして始める。
- 各ページは自分の index.html に全てを持つ。ひな形を改修しても既存ページへは手で反映する(自動同期しない)。

不採用: `common/` を共有してビルドでインライン化する方式。ビルド工程が入り「index.html だけで動く」思想とずれる。

## ファイル構成

```
simplePages/
  CLAUDE.md                         共通規約の要約、ページ一覧、作業手順
  README.md                         リポジトリ概要
  _template/index.html              新ページのひな形
  docs/superpowers/specs/YYYY-MM-DD-<page>-<topic>-design.md
  docs/superpowers/plans/YYYY-MM-DD-<page>-<topic>.md
  <page>/index.html                 ページ本体(単体で動作)
  <page>/README.md                  機能、設定項目、URL パラメータ、データ形式、使用 API
  <page>/test/*.test.mjs            Node のテスト
  <page>/test/fixtures/*.json       外部 API 応答の保存サンプル
```

## HTML 骨格

- `<!DOCTYPE html>`、`<html lang="ja">`。`lang` は起動時に現在言語で書き換える。
- `<head>`: charset、viewport、`<title>`、`<style>` の順。外部 `<link>`、外部 `<script src>` は使わない。
- `<body>` の末尾に `<script>` を2本置く。
  - `<script id="app-logic">`: DOM に触らない純粋関数(API 正規化、コード変換、設定マージ、i18n 辞書)。テスト対象。
  - `<script id="app-ui">`: DOM 操作、fetch、タイマー。`app-logic` の関数を呼ぶ。
- 両スクリプトはそれぞれ `const Logic = (() => { ...; return {...}; })();` のような IIFE に閉じ、グローバルには `Logic` と `App` のみ公開する。
- 外部から受け取った文字列は `textContent` で挿入する。`innerHTML` に外部データを渡さない。

## CSS

- 色、余白、角丸、フォントサイズは `:root` の CSS 変数に集約する。コンポーネントは変数のみを参照する。
- テーマは `html[data-theme="light"]` と `html[data-theme="dark"]` で変数を上書きする。
  初期値は `prefers-color-scheme` に従い、ユーザーが切り替えた場合は設定に保存して優先する。
- フォントはシステムフォントスタック(`system-ui, -apple-system, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif`)。Web フォントは使わない。
- 常時表示ページは `clamp()` と `vw`/`vh` で文字サイズを画面に追従させ、スクロールなしで収める。
- アイコンはインライン SVG(`<symbol>` を `<svg style="display:none">` に定義し `<use href="#id">` で参照)。`fill="currentColor"` でテーマ色に追従させる。共通ボタンのアイコンは Material Icons(Apache 2.0)のパスを埋め込む。
- サイズ系の変数(`--gap`、`--fs-*`)は `calc(... * var(--zoom))` の形にし、拡縮ボタンで `--zoom` を変える。

## 設定ストア

- localStorage のキーは `simplePages.<page>` の1つ。値は JSON。

```json
{ "version": 1, "settings": { "theme": "auto", "lang": "ja", "...": "..." } }
```

- `version` は設定スキーマの版。読込時に `migrate(stored)` で現版へ変換する。
- 優先順位は **URL クエリ > localStorage > 既定値**。URL クエリは settings と同名のキーで上書きする。
- URL クエリは既定では localStorage に書き戻さない。`?save=1` が付いたときだけ、マージ結果を保存する。
  常時表示端末では設定済み URL をブックマークするか、一度 `save=1` で保存してから素の URL を開く。
- 設定の読込・マージは `Logic.resolveSettings(defaults, stored, query)` の純粋関数とし、テストする。
- `Logic.resolveSettings` は未知のキーを無視し、型の合わない値は既定値に戻す。

## 設定 UI

2026-10-13 改訂: 詳細は `2026-10-13-toolbar-and-settings-modal-design.md`。

- 画面右上の `header#toolbar` にアイコンボタン列(ダーク/ライト、拡大、縮小、フルスクリーン、日英、設定)。左下の歯車は廃止。
- 無操作 10 秒でツールバー全体を薄くし、ポインタ移動かタッチで戻す。ページは `App.setToolbarAttention(true)` で減光を止められる。
- 拡縮は `:root` の `--zoom` をすべてのサイズ変数に掛ける方式。設定 `zoom`(50〜200、既定 100)。
- モーダルは固定サイズ(タブを切り替えても外形不変)。ヘッダ / タブ帯 / 本文の 3 行で、本文だけスクロールする。右上に × ボタン。
- タブは「一般」「表示」(ページ固有)「データ」「About」。About は常に最後。
- 「データ」タブはファイルによるエクスポート/インポート、テキストエリアによる表示/インポート、全消去(確認付き)。形式は localStorage の値そのもの(`{ version, settings }`)。インポートは `Logic.parseImport` を通す。
- 「About」タブはページ説明、GitHub リンク、ライセンス(MIT)、クレジット(Material Icons と使用 API)。
- 設定変更は即時反映し、即時保存する。「保存」ボタンは置かない。

## i18n

- `Logic.I18N = { ja: {...}, en: {...} }` の辞書と `Logic.t(lang, key, params)`。
- HTML の静的文字列は `data-i18n="key"` 属性を付け、起動時と言語変更時に一括置換する。
- 既定言語はブラウザ言語(`navigator.language` が `ja` で始まれば ja、他は en)。設定で固定可。
- 日付・数値の書式は `Intl.DateTimeFormat` / `Intl.NumberFormat` を現在言語で使う。

## ステータス帯とエラー表示

- 画面下部に 1 行のステータス帯 `footer#status-bar` を中央寄せで置き、現在時刻、最終更新時刻、状態インジケータ(緑: 正常、黄: 更新中、赤: 失敗)を表示する(2026-10-13 改訂で上部から下部へ移動)。
- 取得失敗時は赤で理由(HTTP ステータスかネットワークエラー)を表示し、前回のデータは消さない。
- 更新は `setInterval` ではなく「次回更新時刻」を保持し、`visibilitychange` で復帰した際に期限切れなら即時更新する。

## テスト

- `app-logic` の関数を対象に `node --test <page>/test/` で実行する。追加ツールは入れない。
- `test/load-logic.mjs` が index.html を読み、`<script id="app-logic">` の中身を切り出して `vm` で評価し、`Logic` を返す共通ヘルパーとする(ひな形に同梱)。
- 外部 API の応答は `test/fixtures/` に保存して正規化関数のテストに使う。ネットワークに依存するテストは書かない。
- 実装は TDD で進める(失敗するテストを先に書く)。

## ドキュメント

- ルート `CLAUDE.md`: 本規約の要約、ページ一覧(名前、一行説明、使用 API)、新ページの作り方、テスト実行方法。
- `<page>/README.md`: ページの機能、設定項目と既定値、URL パラメータ、localStorage の形式、使用 API とその制約、スクリーンショット(任意)。
- 仕様書と計画書は `docs/superpowers/` 配下に日付付きで置く。

## ひな形 `_template/index.html` の内容

- 上記の骨格、CSS 変数、テーマ切替、右上ツールバー、下部ステータス帯、設定モーダル(一般/表示/データ/About)、設定ストア、i18n、更新タイマーの枯れた実装。
- 本体エリアは `<main id="content">` に「ここにページ固有の UI」とだけ書く。
- `_template/test/load-logic.mjs` と、`resolveSettings` と `t` のテスト例を同梱する。

## 範囲外

- 認証、サーバー側処理、PWA 化(Service Worker)、ビルド工程。
- 既存の妹プロジェクトの改修。
