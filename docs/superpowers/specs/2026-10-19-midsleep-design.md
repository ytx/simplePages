# midsleep ページ 設計書

日付: 2026-10-19
対象: `midsleep/index.html`、`midsleep/manifest.webmanifest`、`midsleep/icons/`、`midsleep/test/`、`midsleep/README.md`、`CLAUDE.md`(ページ一覧)、ルート `index.html`(一覧)
前提: 共通規約 `2026-10-12-simplepages-conventions-design.md`、`2026-10-13-toolbar-and-settings-modal-design.md`。設定・ツールバー・i18n・テーマ・拡縮・データタブは規約どおりで、本書では差分だけ書く。
参考: time4u 設計書 `2026-10-17-time4u-design.md`(スマホ向けのタブ構成、設定をタブ内に埋め込む方式、`simplePages.<page>.data` にユーザーデータを置く方式、`dialog#sheet`、PWA ファイル)。実装は time4u の UI 部品(タブバー、シート、ステータス帯、設定セクション、データタブ)を踏襲する。

## 目的

**睡眠中央時刻**(就寝と起床のまん中の時刻)を毎日そろえるための手元ツール。中央時刻を一定に保つと生活の質が上がるとされるので、

1. 寝た時刻と起きた時刻を、忘れずに手間なく記録する。
2. 「今寝ると何時に起きるのがよいか」「○時に起きるには何時に寝ればよいか」が開いた瞬間に分かる。
3. 中央時刻の推移とばらつきを振り返れる。

記録のタイミングは「寝る直前、布団の中」と「起きた直後、アラームを止めたとき」の 2 回。どちらも画面の大きなボタンを 1 回押すだけにする。押し忘れや、布団に入ってから寝入るまでのずれは、あとから履歴で時刻を直して補う(押した時刻はそのまま記録する)。

目標の中央時刻はユーザーが決めず、**直近の記録の平均**から自動で求める。中央時刻をそろえることと睡眠時間を確保することがぶつかるときは**中央時刻を優先**し、睡眠が短い旨を注意として添えるだけにする。

利用環境は主にスマートフォンのブラウザ。データはすべて localStorage に置き、サーバーへは何も送らない。

## 用語

| 用語 | 意味 |
|---|---|
| 記録(record) | 1 回の睡眠。就寝時刻 `bedAt` と起床時刻 `wakeAt` を持つ |
| 就寝中の記録 | `wakeAt` が `null` の記録。同時に 1 件まで |
| 中央時刻(mid) | `bedAt` と `wakeAt` のまん中の時刻(時刻のみ、日付は捨てる) |
| 目標(target) | 直近 `avgDays` 日の記録の中央時刻の**円周平均**(後述) |
| ばらつき | 同じ窓の中央時刻の、目標からの差の標準偏差(分) |
| 仮眠 | 長さが 3 時間未満の記録。履歴に出すが目標・ばらつきの計算には使わない(固定ルール) |
| 起きたい時刻 | 「○時に起きるには」の ○。設定 `wakeTarget` に保存し、画面の ＜ ＞ で動かす |

## 画面構成

3 つのタブを画面下部に置く。上部に共通ツールバー、タブバーの直上にステータス帯(1 行)。

```
┌─────────────────────────────[◐][−][+][A][⚙]┐ header#toolbar
│ midsleep                                   │ h1#page-title(小さく)
│                                            │
│   (タブの内容)                              │ main > section.tab-pane × 3
│                                            │
├────────────────────────────────────────────┤
│ 23:12  ● 保存済み                           │ footer#status(1 行)
├──────────────┬──────────────┬──────────────┤
│ [bedtime]    │ [bar_chart]  │ [settings]   │ nav#tabbar(アイコン + ラベル)
│ 今日          │ 履歴          │ 設定          │
└──────────────┴──────────────┴──────────────┘
```

- タブ: `today` / `history` / `settings`。初期は `today`。アイコンは Material Icons の `bedtime`、`bar_chart`、`settings` をインライン SVG(`<symbol>` + `<use>`)で埋め込む。URL クエリ `tab=` で開くタブを指定できる(保存しない)。
- **絵文字は UI に使わない。** アイコンは Material Icons(Apache 2.0)のパスをインライン SVG で埋め込む。
- ツールバーは ダーク/ライト、拡大、縮小、日英、設定(= 設定タブへ切り替え)。フルスクリーンは置かない(time4u と同じ)。
- 設定タブは time4u と同じく、設定モーダルの内容をタブ内の縦並びセクション(折り畳み)として埋め込む。順序は 表示 / 計算 / データ / About。一般セクション(言語・テーマ・拡大率の入力)は置かない(ツールバーのアイコンで切り替える)。
- ステータス帯は現在時刻と保存状態(緑: 保存済み、黄: localStorage が使えずメモリ上だけで動作中)。`refresh()` は再描画だけ行い、取得はしない。
- 書体は Zen Maru Gothic を同梱する(今日タブの節を参照)。見た目の方向はやわらかいライト/ダーク。
- 時計: 今日タブは 1 分ごとに再描画する(`setInterval` 60 秒 + `visibilitychange` 復帰時に即時)。

### 構成

```
midsleep/
  index.html
  manifest.webmanifest           PWA(standalone、start_url/scope ./)
  icons/icon-192.png icon-512.png apple-touch-icon.png
  test/*.test.mjs
  test/load-logic.mjs
  README.md
```

PWA は time4u と同じ「インストールのみ、Service Worker なし」方式。アイコンは三日月に点を 1 つ置いた単色の図(私の判断)。

## 今日タブ(`#tab-today`)

2026-10-19 改訂: ブラウザで見比べた「夜と朝の 2 分割」案に置き換えた。計算(`Logic`)は変えず、見せ方だけを変える。

状態は 2 つ。就寝中の記録があるかどうかで切り替わる。タブバーより上の領域を、藍色の**夜タイル**と黄色の**朝タイル**の 2 枚が上下に埋める。カード・枠線・見出し行は置かず、各タイルに「小さな説明 1 行 + 大きな時刻 1 つ + 補足 1 行」だけを置く。目標中央時刻・ばらつき・平均睡眠・最後の記録の要約は今日タブに出さない(履歴タブの統計行に任せる)。短い/長いの注意(`adviceFlags`)も今日タブには出さない(`Logic` と既存テストはそのまま残す)。

### 書体

Zen Maru Gothic(SIL Open Font License 1.1)を `midsleep/fonts/zen-maru-gothic/` に同梱し、ページ全体の `--font` に使う。time4u と同じく Google Fonts が配る unicode-range 分割の woff2 をそのまま置き、`@font-face` を `<style>` 内に並べる。ウェイト 400 は全 122 分割、700 は大きな時刻にしか使わないので数字とコロンを含む分割だけ(`zmg-700-116`、`zmg-700-121`)を置く。合計 2.2 MB。ライセンス全文は同じディレクトリの `OFL.txt`。読み込み前は `font-display: swap` でシステム書体が出る。

### 色

`:root` のトークンに集約する。

| トークン | light | dark | 用途 |
|---|---|---|---|
| `--tile-night-bg` / `--tile-night-fg` | `#1d2b6b` / `#ffffff` | `#141c40` / `#e8ecff` | 夜タイル |
| `--tile-night-deep` | `#0f1740` | `#0b1030` | 就寝中の夜タイル |
| `--tile-morning-bg` / `--tile-morning-fg` | `#ffd54a` / `#3a2a00` | `#b58a1e` / `#1a1200` | 朝タイル |
| `--tile-warn-bg` / `--tile-warn-fg` | `#fff3e0` / `#5a3a00` | `#3a2a10` / `#ffe0b0` | 押し忘れカード |

タイル内の文字サイズは `--zoom` を掛けた変数で決める。目安(zoom 100): 説明 14px、大きな時刻 62px、補足 12px、日時 12px(不透明度 .7)。就寝中の経過時間は数字 62px・単位 28px。朝タイルが細いときの時刻は 44px。

### 起きているとき(就寝中の記録がない)

```
┌ 夜タイル(高さ 50%)──────────────────┐
│ 10/19(日) 22:48                     │  左上、小さく薄く
│                                      │
│ 今寝ると、起きるのは                  │
│ 7:02                                 │  大きな時刻
│ 睡眠 8 時間 14 分 ・ 中央 2:55        │
│                         (今から寝る)  │  右下、白塗りの丸ボタン
├ 朝タイル(残り)────────────────────── ┤
│ 6:00 に起きるなら、寝るのは           │
│ 23:50                                │  大きな時刻
│ 睡眠 6 時間 10 分 ・ あと 1 時間 2 分  │
│                        ‹  6:00  ›    │  右下、15 分刻み
└──────────────────────────────────────┘
```

- **夜タイル**: `Logic.wakeFor(now, target)`。補足は「睡眠 {d} ・ 中央 {m}」。注意語は付けない(日中に開いて 20 時間超の提案になっても、そのまま出す)。
- **朝タイル**: `Logic.bedFor(nextWake, target)`。補足は「睡眠 {d} ・ あと {r}」(`r` は `now` から `bed` までの残り時間、`formatDuration`)。`bed` が `now` より前なら、大きな時刻を不透明度 .55 にし、補足を「もう過ぎています ・ 今寝ると中央は {m}{diff}」にする(`m` は今寝て `nextWake` に起きた場合の中央 = `midMinutes(now, nextWake)`、`diff` は目標との差で `diffParenT` と同じ書式)。
- ‹ › は `wakeTarget` を 15 分動かして保存し、即再計算する(既存の `stepWakeTarget`)。
- **今から寝る**: 既存どおり。画面は就寝中へ。
- 目標が出せない(有効な記録が 2 件未満)ときは、構成を崩さず、両タイルの大きな時刻を「--:--」(不透明度 .35)にし、補足を夜「記録があと {n} 回たまると目安が出ます」、朝「まずは今夜の記録から」にする。‹ › は動く(保存だけする)。
- 時刻の表示は既存の `formatHM`(`H:MM`、24 時間制)。

### 就寝中(就寝中の記録がある)

```
┌ 夜タイル(高さ 70%、--tile-night-deep)┐
│ 10/20(月) 3:12                       │
│                                      │
│ 22:58 から寝ています                  │
│ 4時間14分                            │  数字 62px、単位 28px
│ いま起きると 中央 1:05(目標より 1 時間 50 分 早い) │
│                                      │
│ 就寝時刻を直す ・ 取り消す            │  小さなリンク、不透明度 .6
├ 朝タイル(残り 30%)─────────────────── ┤
│ 目標どおりなら                        │
│ 6:52                                 │  44px
│                          (今起きた)   │  右下、線だけの丸ボタン
└──────────────────────────────────────┘
```

- 「いま起きると 中央 …」は既存どおり 1 分ごとに更新。目標がなければ「いま起きると 中央 1:05」だけ。
- **朝タイルの時刻**は `Logic.wakeFor(bedAt, target)` の起床時刻(就寝した時刻を基準に、目標中央時刻に合う起床)。目標がなければ「--:--」。
- **今起きた**・**就寝時刻を直す**・**取り消す**は既存どおり。
- **押し忘れの検出**(`isStale`): 夜タイルの中、経過時間の下に `--tile-warn-bg` の角丸カードを出す。文面と 2 つのボタン(起きた時刻を入れる / 取り消す)は既存どおり。このとき朝タイルの時刻は不透明度 .5 にする。「今起きた」はそのまま押せる。
- 経過時間の表示は `formatDuration` を数字と単位に分けて描く(数字 `span` と単位 `span`)。英語は `4h 14m` を同じ構造で(数字 62px、`h`/`m` 28px)。

## 履歴タブ(`#tab-history`)

```
[ 14 日 | 30 日 ]                          セグメント(設定 chartDays に保存)
目標 3:04(直近 7 日) · ばらつき ±18 分 · 平均睡眠 7 時間 20 分

(グラフ: 案 C)
  縦軸: 時刻。上が早い。既定 21:00〜9:00、データがはみ出せば 1 時間単位で広げる
  横軸: 起床日。1 日 1 列。記録がない日は空ける
  棒: 就寝→起床を薄い accent の丸角棒。仮眠も棒で描く(細く、点なし)
  赤点: 中央時刻。赤線: 中央時刻を日付順に結ぶ(仮眠は結ばない)
  青点線: 目標(窓の平均)。前後 30 分の薄い帯
  横軸ラベルは 3 日おき、縦軸は 2 時間おき

[+ 記録を追加]

10/20(火)  23:12 → 6:31   中央 2:51 · 7 時間 19 分      新しい順
10/19(月)  23:40 → 6:20   中央 3:00 · 6 時間 40 分
10/19(月)  13:05 → 13:50  仮眠 45 分
…
```

- グラフは `<svg>` を DOM API で組む(`innerHTML` 不可)。`Logic.chartModel(records, days, now, settings)` が座標・ラベルの純粋データを返し、App はそれを描くだけ。1 日の列幅は `100 / days` %。
- 統計は窓(`days`)内の有効な記録(仮眠を除く)で計算し、`Logic.stats(records, days, now)` が `{ count, targetMin, sdMin, avgSleepMin }` を返す。有効な記録が 2 件未満なら「記録が足りません」。
- 一覧の行タップで**編集シート**: 就寝・起床の `datetime-local` 2 つ、**[削除]**(確認ダイアログ)。**[+ 記録を追加]** も同じシートを空で開く(初期値: 就寝 = 昨日 23:00、起床 = 今日 6:00)。
- シートの検証(`Logic.validateRecord(record, records)`): 起床 > 就寝、長さ 24 時間以内、他の記録と重ならない(就寝中の記録とも)。違反はシート内に赤字で理由を出し、保存ボタンを無効にする。
- 日付の帰属は**起床日**。「10/20 の朝」の記録として扱い、一覧の見出しも起床日。
- 窓(`days`)は「起床日が `today − (days − 1)` 以上」の記録。`today` は現在時刻の暦日(深夜 1 時でも暦日どおり)。`avgDays` の窓(目標の計算)も同じ定義。
- **就寝中の記録は履歴に出さない**(グラフ・統計・一覧のいずれにも含めない)。今日タブだけで扱う。
- 統計行の内訳: 「目標 3:04」は今日タブと同じ `avgDays` の窓の値(グラフの青点線も同じ)。「ばらつき」「平均睡眠」はセグメントの窓(`chartDays`)で計算する。こうして今日タブと履歴タブの目標が食い違わないようにする。

## 設定(`#tab-settings`)

| セクション | キー | 型・範囲 | 既定 | 意味 |
|---|---|---|---|---|
| 表示 | `chartDays` | enum 14 / 30 | 14 | 履歴グラフと統計の窓。履歴タブのセグメントと連動 |
| 表示 | `wakeTarget` | `HH:MM` | `06:00` | 起きたい時刻。今日タブの ＜ ＞ と連動 |
| 計算 | `avgDays` | int 3〜30 | 7 | 目標の中央時刻を求める窓(日) |
| 計算 | `minSleepMin` | int 180〜720 | 360 | この分数未満の提案に「短めです」を添える |
| 計算 | `staleHours` | int 10〜36 | 18 | 就寝中がこの時間を超えたら押し忘れとみなす |

共通キー `lang` / `theme` / `zoom` は規約どおり(入力欄は置かない)。`DISPLAY_ONLY_KEYS` は全キー(取得がないため)。設定は `simplePages.midsleep`(`{ version: 1, settings }`)。

データセクションは time4u と同じ: ファイルに書き出し / ファイルから読み込み / 全消去、テキスト欄(JSON)、**テキストをコピー** / テキストから読み込む。書き出しは設定とデータを 1 つにまとめた JSON、ファイル名 `midsleep-YYYYMMDD.json`。

About: ページ説明、GitHub リンク、MIT、クレジット(使用 API なし、Material Icons)。

## データ(`simplePages.midsleep.data`)

```json
{
  "version": 1,
  "records": [
    { "id": "r_1760900000000", "bedAt": "2026-10-19T23:12", "wakeAt": "2026-10-20T06:31", "createdAt": "2026-10-19T23:12:04+09:00" },
    { "id": "r_1760990000000", "bedAt": "2026-10-20T23:05", "wakeAt": null, "createdAt": "..." }
  ]
}
```

- `bedAt` / `wakeAt` は**ローカル時刻の `YYYY-MM-DDTHH:MM`**(タイムゾーンなし、分まで)。`datetime-local` の値形式と一致させ、旅行先での時差は考えない。
- `id` は `r_` + 作成時刻のミリ秒(重複時は末尾に連番)。
- `Logic.normalizeData(raw)` を毎回の読み込み・設定で通す: 配列でないものは空に、形式違反の記録は捨て、`wakeAt === null` の記録が 2 件以上あれば最新の 1 件だけ残す、`bedAt` 昇順に並べる。
- `Logic.parseImportAll(text, settingsVersion, dataVersion)` は time4u と同じ契約(`{ ok, settings, data }` または `{ ok: false, error }`)。

## Logic(純粋関数、テスト対象)

| 関数 | 契約 |
|---|---|
| `parseLocal(s)` / `formatLocal(d)` | `YYYY-MM-DDTHH:MM` ⇄ `Date`(ローカル) |
| `minutesOfDay(s)` | 時刻部分を分(0〜1439)に |
| `midMinutes(bedAt, wakeAt)` | 中央時刻を分(0〜1439)で。`durationMin(bedAt, wakeAt)` も |
| `circularMean(minsList)` | 分の配列の円周平均(0〜1439)。23:00 と 1:00 の平均は 0:00 |
| `circularDiff(a, b)` | `a − b` を −720〜720 の範囲で(分) |
| `isNap(record)` | `durationMin < 180` |
| `inWindow(record, days, today)` | 起床日が `today − (days − 1)` 以上 |
| `stats(records, days, today)` | `{ count, targetMin, sdMin, avgSleepMin }`。有効記録 < 2 なら `targetMin: null` |
| `wakeFor(now, targetMin)` | 「今寝ると」の起床 `Date` と睡眠分 |
| `bedFor(wakeAt, targetMin)` | 「○時に起きるには」の就寝 `Date` と睡眠分 |
| `nextOccurrence(now, hhmm)` | `hhmm` が次に来る `Date`(いまと同じ分なら明日) |
| `adviceFlags(sleepMin, settings)` | `'short'` / `'long'` / `null` |
| `isStale(record, now, staleHours)` | 押し忘れ判定 |
| `validateRecord(record, records)` | `{ ok }` または `{ ok: false, error: 'order' \| 'too_long' \| 'overlap' }` |
| `chartModel(records, days, today, settings)` | `{ yMin, yMax, yTicks:[{min,label}], days:[{date,label}], bars:[{x,yBed,yWake,yMid,nap}], line:[[x,y]…], target:{y}\|null }`。y は 0〜1 の比率 |
| `summaryLine(record, lang)` | 一覧 1 行の文字列 |
| `formatHM(min)` / `formatDuration(min, lang)` | `3:04` / `7 時間 19 分`・`7 h 19 min` |
| `normalizeData(raw)` / `parseImportAll(text, sv, dv)` | 前述 |

時刻の算術はすべて `Date` のローカル時刻で行い、夏時間の影響は無視してよい(日本向け)。

## App(DOM)

time4u の構成を踏襲: `$`/`el` ヘルパー、`tr(key, params)`、`openSheet`、`confirmDialog`、`setStatus`、`loadData`/`saveData`(保存のたびに `normalizeData`)、タブ切り替え、設定セクション描画、データタブ。`renderToday()`、`renderHistory()` は毎回全描き直し(`replaceChildren`)。

## エラー処理

- localStorage が使えない: メモリ上で動作し、ステータス帯を黄「保存できません」。
- 不正な記録(読み込み・インポート)は捨てて数を知らせる(「3 件を読み飛ばしました」)。
- 編集シートの検証エラーは保存ボタン無効 + 理由表示。

## テスト(`midsleep/test/`)

`node --test midsleep/test/*.test.mjs`。`load-logic.mjs` は time4u のものを複製。

- `page.test.mjs`: 外部リソースなし(manifest / apple-touch-icon は許可)、絵文字なし、必要 id の存在(`toolbar`、`page-title`、`status`、`tabbar`、`tab-today`、`tab-history`、`tab-settings`、`btn-sleep`、`btn-wake`、`history-chart`、`history-list`、`sheet`、`dialog`、`data-text`、`data-copy-text`、`data-import-text`)、i18n の ja/en キー一致(`tr('…')` の呼び出し含む)、app-ui 内の関数名重複なし、PWA ファイルの存在。
- `time.test.mjs`: `circularMean`(23:00 + 1:00 → 0:00、同じ値の平均、1 件)、`circularDiff`、`midMinutes`(日付をまたぐ)、`formatHM`、`formatDuration`。
- `advice.test.mjs`: `wakeFor`(23:12、目標 3:04 → 6:56、睡眠 464 分)、`bedFor`(6:00、目標 3:04 → 0:08)、日中に開いたとき(14:00、目標 3:04 → M は翌 3:04)、`adviceFlags` の短い/長い、`nextOccurrence` の境界。
- `stats.test.mjs`: 窓の切り方、仮眠の除外、2 件未満で `null`、`sdMin`。
- `records.test.mjs`: `validateRecord` の 3 種のエラー、`normalizeData`(就寝中 2 件 → 1 件、不正を捨てる、並び順)、`isStale`。
- `chart.test.mjs`: `chartModel` の軸(既定 21:00〜9:00、はみ出しで拡張)、x の割り当て、仮眠の `nap: true`、線が仮眠を飛ばす。
- `data.test.mjs`: `parseImportAll` の成否。

## 手動確認(スマートフォン)

1. 「今から寝る」→ ボタンが「今起きた」に変わり、再読込しても就寝中のまま。
2. 「今起きた」→ 起きている画面に戻る。履歴に棒と赤点が出る。
3. 2 晩分そろうと目標と 2 枚のカードが出る。＜ ＞ で起きたい時刻を動かすと就寝時刻が追従する。
4. 履歴の行をタップして時刻を直す。重なる時刻にすると保存できない。
5. 就寝から 18 時間放置 → 注意カード。「起きた時刻を入れる」で記録できる。
6. ホーム画面に追加して全画面で開ける。

## 範囲外

- アラーム・通知、ヘルスケア等との連携、複数人、クラウド同期。
- 目標の中央時刻を手で固定する機能(将来、要望があれば設定に追加する余地は残す)。
- 睡眠の質・途中覚醒の記録。
