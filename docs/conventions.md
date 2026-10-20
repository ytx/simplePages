# simplePages 規約

更新: 2026-10-20。6 ページ(weather / calendar / k_timer / l_timer / time4u / midsleep)を作った時点の規約をまとめ直したもの。設計の経緯は `docs/superpowers/specs/2026-10-12-simplepages-conventions-design.md` と `2026-10-13-toolbar-and-settings-modal-design.md`、各ページの設計書にある。本書が現行の規約で、食い違うときは本書が優先する。

## 1. ページの分類

ページは主な使われ方で 3 つに分ける。共通規約(2 章)は全ページに適用し、分類ごとの付帯事項(3 章)を重ねる。

| 分類 | 使われ方 | ページ |
|---|---|---|
| キオスク向け | 横長の画面に常時表示し、ほとんど触らない | `weather/` `calendar/` `k_timer/` |
| PC 作業向け | PC のブラウザで開いたまま作業の脇で操作する | `l_timer/` |
| スマートフォン向け | 手元のスマートフォンで縦持ちし、指で操作する | `time4u/` `midsleep/` |

`_template/` はキオスク向け・PC 作業向けのひな形(設定モーダル + フルスクリーン)。スマートフォン向けの新ページは `midsleep/` を起点にする(4 章)。

## 2. 共通規約(全ページ)

### 2.1 ファイル構成

```
<page>/index.html            ページ本体。単体で動く
<page>/README.md             機能、設定項目、URL パラメータ、データ形式、使用 API、ライセンス
<page>/test/*.test.mjs       app-logic のテスト(Node 20+、追加ツールなし)
<page>/test/load-logic.mjs   index.html から app-logic を切り出して評価するヘルパー
<page>/test/fixtures/        外部 API 応答の保存サンプル(あれば)
<page>/audio/ fonts/ icons/  同梱メディア(あれば)。manifest.webmanifest も同じ階層
docs/conventions.md          本書
docs/superpowers/specs/      設計書(YYYY-MM-DD-<page>-design.md)
docs/superpowers/plans/      実装計画
```

- 1 ページ = `index.html` 1 ファイル。ビルドなし。外部 `<link>` / `<script src>` / CDN / 外部ドメインの Web フォント禁止。
- 例外として同じページディレクトリ内のファイルだけ相対パスで読み込める: 音声・画像・書体(`@font-face`)、`manifest.webmanifest`、アイコン PNG。`src` / `url()` に入れるパスは index.html 内の定数に限り、設定値や URL クエリをそのまま渡さない。Service Worker は置かない。
- 同梱する書体はライセンス全文(`OFL.txt` など)を同じディレクトリに置き、README と About に明記する。Google Fonts の unicode-range 分割 woff2 をそのまま置く方式(time4u、midsleep)。使うウェイトが限られるなら必要な分割だけ置く。

### 2.2 HTML 骨格

- `<!DOCTYPE html>`、`<html lang="ja">`(起動時に現在言語で書き換え)。`<head>` は charset、viewport、`<title>`、(PWA の `<link>`)、`<style>` の順。
- `<body>` 末尾に `<script id="app-logic">` と `<script id="app-ui">` の 2 本。それぞれ IIFE に閉じ、グローバルは `Logic` と `App` だけ。
  - `app-logic`: DOM に触らない純粋関数(API 正規化、設定マージ、計算、i18n 辞書)。テスト対象。
  - `app-ui`: DOM 操作、fetch、タイマー、localStorage。
- 外部由来・ユーザー由来の文字列は `textContent` で入れる。`innerHTML` は使わない。SVG を動的に作るときは `createElementNS`。
- アイコンはインライン SVG。`<svg style="display:none">` に `<symbol id="icon-…">` を定義し `<use href="#icon-…">` で参照。Material Icons(Apache 2.0)のパスを埋め込む。絵文字を UI に使わない。
- 画面の骨格は上から `header#toolbar` → `main#content`(先頭に `h1#page-title`)→ `footer#status-bar`。スマートフォン向けはさらに下に `nav#tabbar`(3.3 節)。

### 2.3 ツールバー

- 右上の `header#toolbar` にアイコンボタン列。全ページ共通は ダーク/ライト(`btn-theme`)、縮小(`btn-zoom-out`)、拡大(`btn-zoom-in`)、日英(`btn-lang`)、設定(`btn-settings`)。フルスクリーン(`btn-fullscreen`)はキオスク向けと PC 作業向けだけ(3 章)。
- 各ボタンは `aria-label` を `data-i18n-label` で付ける。
- 無操作 10 秒(`IDLE_MS`)で `.idle` を付けて薄く(opacity 0.15)し、`pointermove` / `pointerdown` / `touchstart` / `keydown` で戻す。`App.setToolbarAttention(true)` で減光を止めて設定ボタンを強調できる(未設定のときの誘導)。

### 2.4 CSS

- 色・余白・角丸・文字サイズは `:root` の変数に集約し、コンポーネントは変数だけを参照する。
- テーマは `html[data-theme="light"|"dark"]` で変数を上書き。初期値は `prefers-color-scheme`(`html:not([data-theme="light"])` の media ブロック)。ダーク用の値は属性ルールと media ブロックの両方に書く。
- 拡縮は `:root` の `--zoom`(設定 `zoom` 50〜200、刻み 10、既定 100)を全サイズ変数(`--gap`、`--fs-*`)に `calc(… * var(--zoom))` で掛ける。
- 書体はシステムフォントスタック(`system-ui, -apple-system, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif`)。同梱書体を使うときはその前に置く。
- 太字(`font-weight` 600 以上、`<b>`、`<strong>`)は使わない。強調は大きさと色で行う。同梱書体の 700 を大きな数字だけに使う例外は設計書で明記する(time4u、midsleep、`_template` で適用。キオスク向け 3 ページと l_timer には見出しなどに太字が残っており、改修時に揃える)。

### 2.5 設定ストア

- localStorage `simplePages.<page>` に `{ "version": 1, "settings": { … } }`。ユーザーデータがあるページは `simplePages.<page>.data` に `{ "version": 1, … }` を分けて持つ(l_timer、time4u、midsleep)。
- 優先順位は URL クエリ > localStorage > 既定値。URL クエリは `?save=1` のときだけ保存する。
- `SCHEMA` に型・範囲・既定値を宣言し、`Logic.resolveSettings` / `fixupSettings` で正規化する。未知のキーは無視、型違いは既定値、範囲外の整数は端に丸める。
- `DISPLAY_ONLY_KEYS`(`theme` / `zoom` / `lang` と表示だけに影響するページ固有キー)以外が変わったときだけ `refresh()` を呼ぶ。外部取得のないページでは `refresh()` は再描画。
- 設定変更は即時反映・即時保存。「保存」ボタンは置かない。

### 2.6 設定 UI

- 設定の置き場は分類で異なる(キオスク/PC は `dialog#settings` モーダル、スマートフォンは設定タブ。3 章)。中身の構成は共通:
  - セクション順は 一般 / 表示 / (ページ固有) / データ / About。About は常に最後。
  - 「データ」: ファイルへの書き出し、ファイルからの読み込み、テキストエリアでの表示・コピー・読み込み、全消去(確認付き)。コピーは先に保存してから `navigator.clipboard.writeText` を 1.5 秒で打ち切り、失敗したら `execCommand('copy')` に落とす(`App.copyText`)。形式は `{ version, settings }`、ユーザーデータがあれば `{ version, settings, data }` を 1 つにまとめた JSON。読み込みは `Logic.parseImport`(または `parseImportAll`)を通し、含まれている側だけを置き換える。
  - 「About」: ページ説明、GitHub リンク、MIT ライセンス、クレジット(`ABOUT.credits` に Material Icons、使用 API、同梱書体)。
- 確認ダイアログは `dialog#dialog`(`dialog({ message, danger })` が Promise を返す)を使う(l_timer、time4u、midsleep、`_template`)。キオスク向けの 3 ページは `window.confirm` のままで、改修時に揃える。

### 2.7 i18n

- `Logic.I18N = { ja, en }` と `Logic.t(lang, key, params)`。ja と en のキー集合は同一(テストで検査)。
- 静的文字列は `data-i18n`、ボタンのラベルは `data-i18n-label`、動的文字列は `tr(key, params)`。
- 既定言語はブラウザ言語(`ja` で始まれば ja、他は en)。設定で固定できる。
- 時刻は 24 時間制。日付・数値の書式は `Intl` を現在言語で使うか、ページで決めた固定書式を ja/en 両方で用意する。

### 2.8 ステータス帯

- 画面下部中央の `footer#status-bar` に現在時刻(`#clock`)、メッセージ(`#status-message`)、状態ドット(`#status-dot`: 緑 正常 / 黄 更新中・注意 / 赤 失敗)。
- 失敗時は赤で理由(HTTP ステータス、ネットワークエラー)を出し、前回のデータは消さない。
- localStorage が使えないときはメモリ上で動作し、黄で「保存できません」。

### 2.9 更新と復帰

- 外部取得は `setInterval` ではなく「次回更新時刻」を持ち、`visibilitychange` で復帰したときに期限切れなら即時更新する。`fetch` には `AbortSignal.timeout` を付ける。
- 外部取得のないページも `visibilitychange` で時計と表示を更新する(復帰時の 1 回描画にまとめる)。

### 2.10 テスト

```bash
node --test <page>/test/*.test.mjs
```

- グロブ形式で指定する(ディレクトリ指定は Node 24 で失敗する)。`test/load-logic.mjs` はヘルパーでテストではない。
- `app-logic` の純粋関数をテストする。外部 API の応答は `test/fixtures/` に保存し、ネットワークに依存するテストは書かない。
- `page.test.mjs` で index.html の静的検査を行う(time4u、midsleep、`_template` にある。新ページは必ず付け、既存ページは改修時に足す): 外部リソースなし、`innerHTML` なし、絵文字なし、太字なし、必要な id と `data-section` の存在と順序、i18n の ja/en 対応、`tr('…')` キーの存在、`app-logic` と `app-ui` が構文解析できること、同梱ファイルの存在。
- TDD で進める(失敗するテストを先に書く)。

### 2.11 ドキュメント

- `README.md`(ルート): リポジトリ概要、分類ごとのページ一覧。
- `CLAUDE.md`: 規約の要約と本書へのリンク、ページ一覧(名前・一行説明・使用 API)、新ページの作り方、テスト実行方法。
- `<page>/README.md`: 機能、設定項目(セクション・キー・型・既定・説明)、URL パラメータ、データ形式、同梱メディアとライセンス、使用 API、テスト。
- 設計書と計画書は `docs/superpowers/` に日付付きで置く。

## 3. 分類ごとの付帯事項

### 3.1 キオスク向け(weather / calendar / k_timer)

想定: 横長の画面(モニタ、タブレットの横置き)に常時表示。設置時に一度設定したら触らない。離れた位置から読む。

- レイアウトは横長 1 画面に収め、スクロールしない(`body { overflow: hidden }`)。文字サイズは `clamp()` と `vw` / `vh` で画面に追従させ、`--zoom` で微調整する。
- ツールバーにフルスクリーン(`btn-fullscreen`、Fullscreen API)を置く。
- 設定は `dialog#settings` モーダル。固定サイズ(タブを切り替えても外形不変)、ヘッダ / タブ帯 / 本文の 3 行で本文だけスクロール、右上に ×。
- 設置端末向けに URL クエリで設定を渡せるようにし(`?theme=dark&zoom=120&…`)、`?save=1` で一度保存してから素の URL を開く運用を README に書く。
- 外部取得のあるページは「次回更新時刻」方式で、失敗しても前回データを残す。未設定(地点や接続先がない)のときは `setToolbarAttention(true)` で設定ボタンへ誘導する。
- 音を出すページ(k_timer)は最初の操作で AudioContext を解錠し(`unlockAudio`)、終了音は止めるまでループする。
- 入力は最小限。ポインタ操作が主で、キー操作は補助(Enter、Esc)。スワイプは calendar のように角度で判定し、`pointerup` は `window` で受ける。

### 3.2 PC 作業向け(l_timer)

想定: PC のブラウザで開いたまま、別の作業(講義、演習)の脇で操作する。マウスとキーボードがある。画面は広い。

- 設定は `dialog#settings` モーダル、フルスクリーンあり(3.1 と同じ骨格)。
- 1 列の縦レイアウトを基本にし、幅 700px 未満では 1 列に畳む。ボタンの最小高さは 40px 程度でよい(指ではなくマウス)。
- 作業領域を分割する UI(エディタとタイマーの分割、`#resizer` によるドラッグ)やキーボード操作を積極的に使ってよい。
- 長い文書・下書き・履歴は `simplePages.<page>.data` に保存し、壊れていても落ちないよう読み込み時に正規化する。
- 音は k_timer と同じく最初のクリックで解錠。ミュートボタンをツールバーに置く。

### 3.3 スマートフォン向け(time4u / midsleep)

想定: 縦持ちのスマートフォンで、親指で操作する。ホーム画面に追加して使う。通信は不安定なことがある。

- 画面は `height: 100dvh` の縦積み: `header#toolbar` / `main#content` / `footer#status-bar` / `nav#tabbar`。下部の `#tabbar` で画面を切り替え、設定もタブの 1 つにする(`dialog#settings` は置かない)。URL `?tab=` で開くタブを指定できる(保存しない)。
- ツールバーにフルスクリーンは置かない(ホーム画面から開けば全画面になる)。使い方の案内が要るページは `btn-help` と `dialog#help` を置き、初回だけ自動で開く(`simplePages.<page>.helpSeen`)。
- 設定タブは `<details class="settings-section" data-section="…">` を縦に並べる。セクション順は 2.6 節と同じで、「一般」はツールバーで足りるなら省く(言語・テーマ・拡大率はツールバーで切り替える)。
- 入力と編集は `dialog#sheet`(下から出るシート)で行う。`openSheet({ title, build, validate, onOk })`。検証エラーは OK ボタンを無効にして理由を表示する。シートを開いたとき iOS の日付ピッカーが勝手に開かないよう、フォーカスをシート見出し(`h2#sheet-title tabindex="-1"`)へ移す。
- タップ対象は 44px 以上。`input` / `select` / `textarea` は `font-size: max(16px, …)`(iOS の自動拡大を防ぐ)。フォームは `minmax(0, 1fr)` + `width: 100%` で横にあふれさせない。
- PWA: `manifest.webmanifest`(`display: standalone`、`start_url` / `scope` は `./`)、`icons/icon-192.png` / `icon-512.png`(maskable 兼用)、`icons/apple-touch-icon.png`(180px)、`<meta name="theme-color">`、`apple-mobile-web-app-*` メタ。Service Worker は置かない(起動に通信が要る)。iOS ではホーム画面のアプリとブラウザで localStorage が別なので、データタブで移す。
- クリップボードへのコピーは、先に保存してから `navigator.clipboard.writeText` を 1.5 秒で打ち切り、失敗したら `execCommand('copy')` に落とす(権限待ちで固まる端末がある)。
- 1 分ごとの描画は `tickClock` で分が変わったときだけ行い、`#sheet` が開いている間は描画しない(入力中の内容を消さない)。
- 記録系のデータは `simplePages.<page>.data` に持ち、読み込み・インポート時に `normalizeData` で正規化して不正な記録は捨て、件数をステータス帯で知らせる。

## 4. 新ページの作り方

1. 分類を決める。キオスク向け・PC 作業向けは `cp -r _template <page>`。スマートフォン向けは `cp -r midsleep <page>` して、タブ・Logic・設定・データ形式をページの内容に置き換える(ツールバー、設定タブ、データタブ、シート、ステータス帯、PWA 一式はそのまま使う)。
2. `PAGE`、`<title>`、`ABOUT`(`ABOUT.page` はディレクトリ名、`credits`)、`SCHEMA`、`DISPLAY_ONLY_KEYS`、`refresh()`、i18n の `about_description` を書き換える。
3. 設計書を `docs/superpowers/specs/YYYY-MM-DD-<page>-design.md` に書く(分類と、3 章のどの付帯事項を使うかを明記)。
4. `<page>/test/` に `app-logic` のテストと `page.test.mjs` を TDD で書く。
5. `<page>/README.md` を書き、ルートの `README.md`、`index.html`、`CLAUDE.md` の一覧に分類ごとに追加する。

## 5. 範囲外

認証、サーバー側処理、Service Worker、ビルド工程、ページ間でのコード共有(ひな形の改修は既存ページへ手で反映する)。
