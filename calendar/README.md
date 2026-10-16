# calendar

Google カレンダーの予定(複数カレンダー)を、日・週・月のいずれかで常時表示するページです。データは自分の Google アカウントで動く Google Apps Script(GAS)ウェブアプリから JSON で受け取ります(Google の iCal URL はブラウザから直接読めないため)。

## 機能

- 日 / 週 / 月表示(Google カレンダー風)。週の開始曜日、表示時刻範囲(既定 6:00〜23:00)を設定可
- 複数カレンダーを色分けして重ね表示。カレンダーごとに表示 / 非表示と色の上書き
- 重なる予定は横に分割。日をまたぐ予定は日ごとに分割。終日・複数日は終日帯に横棒
- 予定をタップすると時刻・場所・説明・カレンダー名をポップオーバー表示(編集はしない)
- 画面下のボタン(前 / 今日 / 翌、日 / 週 / 月)と左右フリックで移動。フリック中は本体が指に少し追従し、しきい値(横 60px 以上、かつ横が縦の 1.5 倍以上)を超えると画面端の「前」/「翌」バッジが点灯、離すと流れるように切り替わる(`prefers-reduced-motion` ではバッジのみ)。無操作が続くと今日に戻る(既定 5 分、0 で無効)
- 表示範囲の前後 31 日をまとめて取得してキャッシュ。10 分ごとに自動更新(変更可)。失敗時は前回表示を保ち、ステータスに赤で理由
- 右上のアイコンでダーク/ライト、拡大/縮小、フルスクリーン、日英を切替。設定は右上の歯車

## 使い方

1. https://script.google.com で新しいプロジェクトを作り、`gas/Code.gs` の内容(設定画面の「接続」タブにも同じものがあります)を貼り付ける。必要なら先頭の `TOKEN` に任意の文字列を入れる。
2. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」、実行ユーザー「自分」、アクセス「全員」でデプロイする。初回は権限の承認を求められる。
3. `index.html` をブラウザで開き、右上の歯車 → 「接続」タブに「ウェブアプリの URL」(`…/exec`)とトークンを入れ、「接続して一覧を取得」を押す。Google Workspace のアカウントでは `https://script.google.com/a/macros/<ドメイン>/s/…/exec` 形式の URL が表示されることがあります。その場合は `/a/macros/<ドメイン>` を除いた `https://script.google.com/macros/s/…/exec` の形で入れてください(どちらも同じデプロイを指します)。
4. 表示するカレンダーにチェックを入れる。祝日を出したいときは Google カレンダー側で「日本の祝日」を追加しておくと一覧に出る。
5. コードを変えたときは「デプロイを管理」から同じデプロイを新バージョンで更新する(URL は変わらない)。

URL とトークンはブラウザの localStorage に保存され、「データ」タブから書き出せます。URL を知っていれば誰でも予定を読めるので、iCal の秘密アドレスと同じ扱いにしてください。

### URL パラメータ

| パラメータ | 例 | 説明 |
|---|---|---|
| `view` | `view=month` | `day` / `week` / `month` |
| `date` | `date=2026-10-13` | 起動時の基準日(保存しない) |
| `weekStart` | `weekStart=1` | 0 = 日曜、1 = 月曜 |
| `dayStart`, `dayEnd` | `dayStart=8&dayEnd=20` | 表示時刻範囲(0〜23 / 1〜24) |
| `returnToTodayMinutes` | `returnToTodayMinutes=0` | 今日へ戻るまでの分(0 で無効) |
| `refreshMinutes` | `refreshMinutes=30` | 更新間隔(分、1〜120) |
| `gasUrl`, `token` | | 通常は設定画面から入れる |
| `lang` / `theme` / `zoom` | `zoom=120` | 共通 |
| `save` | `save=1` | URL の設定を localStorage に保存する |

## データの保存形式

localStorage キー `simplePages.calendar`:

```json
{ "version": 1, "settings": {
  "lang": "ja", "theme": "auto", "zoom": 100, "refreshMinutes": 10,
  "gasUrl": "https://script.google.com/macros/s/…/exec", "token": "",
  "calendars": [ { "id": "xxx@group.calendar.google.com", "name": "仕事", "color": "#039be5", "enabled": true } ],
  "view": "week", "weekStart": 0, "dayStart": 6, "dayEnd": 23, "returnToTodayMinutes": 5 } }
```

## GAS ウェブアプリの API

- `GET …/exec?action=list[&token=]` → `{ ok, tz, calendars: [{ id, name, color }] }`
- `GET …/exec?from=YYYY-MM-DD&to=YYYY-MM-DD[&cal=id1,id2][&token=]` → `{ ok, tz, calendars, events: [{ id, calendarId, title, start, end, allDay, location, description, color }], errors }`
  - `to` は排他的。終日予定の `start`/`end` は `YYYY-MM-DD`(`end` は翌日)。期間は最大 120 日。
- 失敗: `{ ok: false, error: "unauthorized" | "bad_request" | "range_too_large" | "internal" }`

## 既知の制約

- 予定の作成・編集・通知には対応しない。
- 時刻グリッドはスクロールしない。表示時刻範囲の外にかかる予定は端で切れる(範囲は設定で変更)。
- 月表示は 1 セルに入る件数だけ表示し、残りは「+N」。
- GAS の応答が HTML(認可画面)のときは「応答が JSON ではありません」と表示する。デプロイのアクセス設定を確認する。
- デプロイのアクセス設定が「全員」になっていないと、ブラウザからは認可画面へのリダイレクトが CORS で遮られ「取得失敗: Failed to fetch」のようなネットワークエラーとして見える。URL が正しいのに取得できないときはデプロイ設定を確認する。
- 繰り返し予定は GAS 側で各回に展開され、id は `<iCalUID>_<開始時刻UTC>` の形になる。

## テスト

```bash
node --test calendar/test/*.test.mjs
```

テストは `TZ=Asia/Tokyo` を前提にする(`test/load-logic.mjs` で設定)。fixture は `test/fixtures/` にある。

## 手動確認

- GAS URL 未設定で案内文が出、右上の設定ボタンが強調され、ツールバーが薄くならない
- 不正な URL(`/dev`、`http://`、別ホスト)を入れると赤いメッセージが出て保存されない
- 「接続して一覧を取得」でカレンダー一覧が出て、チェックと色の変更が反映される
- 週表示: 重なる予定が横に並ぶ、日またぎの予定が両日に出る、終日・複数日が終日帯に出る、今日の列に赤線
- 月表示: 6 週分のセル、はみ出しは「+N」
- 月表示で取得できる(要求範囲は 104 日)
- 前 / 今日 / 翌 と左右フリックで移動し、期間見出しが変わる。フリック中に本体が追従し、60px を超えると端のバッジが青くなる。離すとスライドで切り替わり、60px 未満なら元に戻る
- 予定タップでポップオーバー、外側タップ / Esc で閉じる
- 今日以外を表示して放置すると設定した分数で今日に戻る
- ネットワークを切って更新すると表示が残り、ステータスが赤になる
- 1280×800 と 1920×1080 でスクロールが出ない。ナビボタンが 48px 以上
