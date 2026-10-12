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
node --test _template/test/*.test.mjs
node --test <page>/test/*.test.mjs
```

`test/load-logic.mjs` はテストではなくヘルパーなので、グロブは `*.test.mjs` にする(ディレクトリ指定は Node 24 で失敗する)。

Node.js 20 以上。ネットワークに依存するテストは書かない。
