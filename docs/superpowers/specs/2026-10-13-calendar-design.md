# calendar ページ 設計書

日付: 2026-10-13
対象: `calendar/index.html`、`calendar/gas/Code.gs`、`calendar/test/`、`calendar/README.md`
前提: 共通規約 `2026-10-12-simplepages-conventions-design.md` と `2026-10-13-toolbar-and-settings-modal-design.md`(右上ツールバー、下部ステータス帯、固定サイズ設定モーダル、`--zoom`)。

## 目的

Google カレンダーの予定(複数カレンダー)を、常時表示の横長モニタ/タブレットで日・週・月のいずれかの形式で表示する。表示だけで編集はしない。

Google カレンダーの iCal URL はブラウザから直接読めない(CORS ヘッダなし。2026-10-13 に確認)。そのため、利用者自身の Google アカウントで動く Google Apps Script(GAS)ウェブアプリを中継にし、ページはその URL から JSON を取得する。

## 構成

```
calendar/
  index.html        ページ本体(単体)
  gas/Code.gs       GAS に貼り付けるコード(index.html の接続タブにも同じ内容を埋め込む)
  test/             Logic のテスト、fixtures/
  README.md
```

## GAS ウェブアプリ(`calendar/gas/Code.gs`)

- `doGet(e)` のみ。`ContentService` で `application/json` を返す。GET の単純リクエストに限る(ページ側は `fetch(url)` にヘッダを付けない。Apps Script のリダイレクト先が `Access-Control-Allow-Origin: *` を返す)。
- デプロイ条件: 「ウェブアプリ」「次のユーザーとして実行: 自分」「アクセスできるユーザー: 全員」。
- 先頭の定数 `const TOKEN = '';`。空でなければ `?token=` が一致しないリクエストを `{ ok: false, error: 'unauthorized' }` で拒否する。
- `const MAX_DAYS = 120;` 期間がこれを超えたら `{ ok: false, error: 'range_too_large' }`。

### リクエスト

| パラメータ | 必須 | 意味 |
|---|---|---|
| `action=list` | — | カレンダー一覧を返す。他のパラメータは無視(`token` 以外) |
| `from` | ○ | `YYYY-MM-DD`。この日の 0:00(スクリプトのタイムゾーン)から |
| `to` | ○ | `YYYY-MM-DD`。この日の 0:00 **まで**(排他的) |
| `cal` | — | カンマ区切りのカレンダー ID。省略時はアカウントの全カレンダー |
| `token` | — | 共有トークン |

### レスポンス

```json
{ "ok": true, "tz": "Asia/Tokyo", "generatedAt": "2026-10-13T19:40:12+09:00",
  "calendars": [ { "id": "primary@gmail.com", "name": "仕事", "color": "#039be5" } ],
  "events": [
    { "id": "abc@google.com_20261013T010000Z", "calendarId": "primary@gmail.com",
      "title": "打合せ", "start": "2026-10-13T10:00:00+09:00", "end": "2026-10-13T11:00:00+09:00",
      "allDay": false, "location": "3F 会議室", "description": "資料は Drive", "color": "#039be5" }
  ],
  "errors": [ { "calendarId": "x@group.calendar.google.com", "error": "not_found" } ] }
```

- `action=list` のときは `events`/`errors` を省く。
- 終日予定は `allDay: true`、`start`/`end` は `YYYY-MM-DD`(`end` は排他的、Google の仕様どおり翌日)。
- 時刻は `Utilities.formatDate(d, tz, "yyyy-MM-dd'T'HH:mm:ssXXX")`。tz は `Session.getScriptTimeZone()`。
- `color` は予定の色(`getColor()` が空ならカレンダーの色)。文字列は 16 進カラーに正規化し、できなければ空文字。
- カレンダー ID が無効なら `errors` に入れて続行する。
- 失敗: `{ ok: false, error: '<code>' }`。`error` は `unauthorized` / `bad_request` / `range_too_large` / `internal`。

## 画面レイアウト

```
┌──────────────────────────────────────[☾][−][+][⛶][文A][⚙]┐  共通ツールバー
│                 2026年10月 13日〜19日                       │  期間見出し #range-title
│  終日 │ ■ 出張(13〜15)                                      │  終日帯 #allday
│ 06:00 │      │      │      │      │      │      │          │
│   ⋮   │ ■会議│      │ ■■  │      │      │      │          │  時刻グリッド #grid
│ 22:00 │      │      │      │      │      │      │          │  現在時刻線(赤)
│ [ ‹ 前 ] [ 今日 ] [ 翌 › ]                 [ 日 ][ 週 ][ 月 ] │  ナビ行 #nav(カレンダーの下)
├──────────── 10/13(月) 19:45  最終更新 19:40 ● ─────────────┤  共通ステータス帯
```

- **期間見出し**: カレンダーの上、中央に期間(`Logic.formatRangeTitle`)。
- **ナビ行**: カレンダーの**下**(ステータス帯の直上)に置く。左に 前 / 今日 / 翌、右にビュー切替 日 / 週 / 月(`aria-pressed`)。タッチ操作を前提に、ボタンは高さ・幅とも 48px 以上(`min-height: calc(48px * var(--zoom))`、横幅は文字 + 左右 1.2em の余白)、ボタン間隔は `var(--gap)`。見出しとナビ行の高さを引いた残りをカレンダー本体に割り当て、本体はスクロールしない。
- **日表示**: 1 列。**週表示**: 7 列、週の開始曜日は設定(既定 日曜)。列見出しは「13(月)」、今日は強調。
- **時刻グリッド**: 設定の表示時刻範囲(既定 6:00〜23:00)を縦に等分。範囲外にかかる予定は範囲端で切り、上端/下端に「▲ 2 件」のような超過表示は出さず、切れた側の角を直角にする。グリッドはスクロールしない(常時表示)。
- **重なり**: 同じ日の時刻あり予定で時間帯が重なるものをクラスタにまとめ、列に割り当てて横に等分する。
- **日またぎ**: 時刻あり予定で日付をまたぐものは日ごとに分割して描く。終日予定と 24 時間以上の予定は終日帯に横棒で描き、週の外へ続く場合は端を矢印にする。終日帯は最大 3 行で、超過は「+N」。
- **月表示**: ナビ行の下に 6 週 × 7 日のセル。各セルに日付と予定名(終日・複数日は上に横棒、時刻ありは「10:00 打合せ」)、入り切らない分は「+N」。セル数は固定 42。
- **現在時刻線**: 日・週表示で今日の列に赤線。1 分ごとに位置を更新。
- **予定の色**: 予定の `color` → カレンダーの設定色(上書き)→ カレンダーの `color` → 既定アクセント、の順。文字色は背景の輝度で白/黒を選ぶ。
- **ポップオーバー**: 予定をタップすると、その近く(画面内に収める)に 題名 / 日時 / カレンダー名 / 場所 / 説明 を表示。外側のタップか Esc で閉じる。文字列は `textContent`。
- **ナビゲーション**: 前 / 翌 はビュー単位(日・週・月)で移動。左右フリック(`pointerdown`→`pointerup` で横 60px 以上、縦 40px 未満)も同じ。無操作が `returnToTodayMinutes`(既定 5、0 で無効)続いたら今日に戻す。
- **接続未設定**: 本体に「右上の設定 → 接続タブで GAS の URL を設定してください」と表示し、`App.setToolbarAttention(true)`。

## 設定項目

| キー | 型 | 既定 | 説明 |
|---|---|---|---|
| lang / theme / zoom / refreshMinutes | 共通 | 共通 | |
| `gasUrl` | string | '' | `https://script.google.com/macros/s/<id>/exec` 形式のみ受理 |
| `token` | string | '' | 共有トークン |
| `calendars` | object | `[]` | `[{ id, name, color, enabled }]`。接続タブの一覧取得で埋め、チェックと色を編集 |
| `view` | enum day/week/month | week | 既定ビュー。ナビ行で切り替えると保存する |
| `weekStart` | enum 0/1 | 0 | 0 = 日曜、1 = 月曜 |
| `dayStart` | int 0–23 | 6 | 表示時刻範囲の開始 |
| `dayEnd` | int 1–24 | 23 | 表示時刻範囲の終了。`dayStart` 以下なら既定に戻す |
| `returnToTodayMinutes` | int 0–60 | 5 | 0 で無効 |

- `DISPLAY_ONLY_KEYS` に `view`, `weekStart`, `dayStart`, `dayEnd`, `returnToTodayMinutes` を追加(表示だけに影響。ただし `view`/`weekStart` の変更で表示範囲がキャッシュ窓を出た場合は窓の再取得が走る)。
- URL パラメータ: 上記キーのほか `date=YYYY-MM-DD`(起動時の基準日。設定ではないので保存しない)。
- 設定モーダルのタブ: **接続** / 一般 / 表示 / データ / About。
  - 接続: `gasUrl`、`token`、「接続して一覧を取得」ボタン(結果メッセージはタブ内)、カレンダーのチェックリスト(表示 / 名前 / 色 `<input type="color">`)、GAS セットアップ手順(下記 5 ステップ)、コピー用コード本文(`<textarea readonly>` に `Code.gs` と同じ内容)。
  - 一般: 更新間隔、今日へ戻るまでの分。
  - 表示: 言語、テーマ、既定ビュー、週の開始曜日、表示時刻範囲。
  - データ / About: 共通。About の `credits` は空(Google Apps Script への謝辞は不要)。
- 注意書き(接続タブ): GAS の URL とトークンは localStorage に保存され、データタブから書き出せる。

### GAS セットアップ手順(接続タブと README に載せる)

1. https://script.google.com で新しいプロジェクトを作る。
2. `Code.gs` の内容を下のテキストエリアから貼り付ける。必要なら先頭の `TOKEN` に任意の文字列を入れる。
3. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」、実行ユーザー「自分」、アクセス「全員」で デプロイ。初回は権限の承認を求められる。
4. 表示された「ウェブアプリの URL」(`…/exec`)をこの画面の GAS URL に貼り、トークンを入れたら「接続して一覧を取得」。
5. 表示するカレンダーにチェックを入れる。コードを変えたときは「デプロイを管理」から同じデプロイを新バージョンで更新する(URL は変わらない)。

## データフローと状態

```
settings.gasUrl/token/calendars ──┐
anchor(基準日), view ──> Logic.rangeForView ──> 表示範囲 R
                                   │
       cache { from, to, events, calendars, fetchedAt } が R を含む?
         ├─ はい → Logic.segmentsByDay / monthCells → 描画
         └─ いいえ → window = Logic.windowFor(R) (前後 31 日) → fetch(gasUrl?from&to&cal&token)
                      → Logic.normalizeResponse → cache 更新 → 描画
更新タイマー(refreshMinutes)/visibilitychange 復帰 → 現在の window を再取得(失敗時は cache を残す)
```

- 取得は `App.fetchJson` を使い、世代カウンタで古い応答を捨てる(weather と同じ)。
- `calendars` 設定の `enabled` なものだけ `cal` に渡す。1 つも無ければ全カレンダー(`cal` 省略)。
- ナビ行のビュー切替は `view` を保存する。前 / 翌 / フリック / 今日 は `anchor` だけを変え、保存しない。
- 今日へ戻るタイマーは、`anchor` が今日を含まないときだけ動かす。

## エラー処理

| 状況 | 表示 |
|---|---|
| `gasUrl` 未設定 | 本体に案内文、設定ボタン強調、ステータス赤 |
| fetch 失敗 / タイムアウト | 前回表示を残し、ステータス赤「最終更新 … / 取得失敗: <reason>」 |
| 応答が JSON でない(HTML の認可画面など) | 理由 `invalid_response`。ステータスと接続タブに「デプロイ設定(実行ユーザー: 自分、アクセス: 全員)を確認」 |
| `ok: false` | 理由に `error` コードを表示。`unauthorized` は「トークンが一致しません」と訳す |
| `errors` にカレンダー単位の失敗 | ステータス黄「一部のカレンダーを取得できません(N)」、取得できた分は描く |
| 接続タブの一覧取得失敗 | タブ内に赤文字で理由 |

## Logic(純粋関数、テスト対象)

| 関数 | 仕様 |
|---|---|
| `parseYmd(s)` / `ymd(date)` | `YYYY-MM-DD` ⇄ ローカル日付(0:00) |
| `addDays(date, n)`、`startOfDay(date)` | |
| `startOfWeek(date, weekStart)` | weekStart 0/1 |
| `rangeForView(view, anchor, weekStart)` | `{ from, to }`(to 排他的)。day: 1 日、week: 7 日、month: 月グリッドの 42 日 |
| `monthGridDays(anchor, weekStart)` | 月初を含む週の初日から 42 日。各日に `inMonth` フラグ |
| `shiftAnchor(view, anchor, dir)` | day ±1 日、week ±7 日、month ±1 か月(日は 1 日に丸める) |
| `windowFor(range)` | `{ from: from−31日, to: to+31日 }` |
| `coversRange(cache, range)` | cache.from ≤ from かつ to ≤ cache.to |
| `normalizeResponse(json)` | `ok`/配列の型検証。各予定を `{ id, calendarId, title, start: Date, end: Date, allDay, location, description, color }` に。壊れた要素は捨てる。`ok:false` は `{ ok: false, error }` を返す |
| `eventColor(event, calendarsSetting, calendarsFromGas)` | 優先順位は上記 |
| `textColorFor(hex)` | 相対輝度で `#000`/`#fff` |
| `segmentsByDay(events, days)` | 日ごとに `{ allDay: [...], timed: [...] }`。時刻あり日またぎは分割、24 時間以上は allDay 扱い |
| `allDayBars(events, days)` | 終日帯の横棒 `{ event, startCol, span, continuesLeft, continuesRight, row }`(行は貪欲に詰める) |
| `layoutColumns(timedSegments)` | 重なりクラスタごとに `{ seg, col, cols }` |
| `clipToHours(seg, dayStart, dayEnd)` | `{ topPct, heightPct, clippedTop, clippedBottom }`、範囲外なら null |
| `monthCells(events, days, max)` | セルごとに `{ date, items[], more }` |
| `formatRangeTitle(view, range, lang)` | ナビ行の見出し |
| `gasRequestUrl(base, params)` | base の形式検証(`https://script.google.com/macros/s/…/exec`)、クエリ付与。無効なら null |
| `validCalendars(value)` | 配列の各要素を `{ id, name, color, enabled }` に正規化、不正は捨てる |
| `isSwipe(dx, dy)` | 横 60px 以上かつ縦 40px 未満 |

fixtures: `test/fixtures/gas-list.json`、`test/fixtures/gas-events.json`(重なり 3 件、日またぎ、終日 1 日、複数日 3 日、週をまたぐ複数日、繰り返し展開済みの同 id 連番、色なし、を含む)。

## テスト

- 上記 Logic の各関数。特に: 週開始日曜/月曜での `startOfWeek`、月グリッドが 42 日で月初を含む、日またぎ分割の境界(23:30〜0:30)、24 時間以上の扱い、重なりクラスタの列数、`clipToHours` の上下切れ、終日帯の行詰め、`gasRequestUrl` の拒否(http、別ホスト、`/dev` エンド)、`normalizeResponse` の壊れたデータ、i18n カバレッジテスト(共通)。
- DOM(フリック、ポップオーバー、現在時刻線、今日へ戻る)はブラウザで手動確認。README に確認項目を列挙する。

## 範囲外

- 予定の作成・編集・削除、通知・リマインダー。
- iCal URL の直接読込、Google 以外のカレンダー。
- タスク(Google Tasks)、予定の出欠状態。
- 月表示での予定の時刻グリッド。
