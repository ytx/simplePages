# weather ページ 設計書

日付: 2026-10-12
状態: 承認済み(会話で合意)
前提: [simplePages 共通規約](2026-10-12-simplepages-conventions-design.md) に従う。

## 目的

横長モニタまたはタブレットのブラウザ全画面に常時表示し、設定した1地点の天気予報を見せるページ。
無料かつ API キー不要の公開 API のみを使い、`weather/index.html` 単体で動作する。

成功条件:

- 1920×1080 と 1280×800 の横長画面で、スクロールなしに全ブロックが収まる。
- 現在の天気、今日・明日の時間別、週間予報、降水量の推移が一目で読める。
- 片方の API が落ちても、もう片方のデータだけで表示が崩れない。
- 10 分ごとに自動更新し、更新に失敗しても前回の表示を保つ。

## データソース

| ソース | 用途 | 根拠 |
|---|---|---|
| 気象庁 `https://www.jma.go.jp/bosai/forecast/data/forecast/<office>.json` | 今日・明日・明後日の天気文言、風、波、3時間ごとの降水確率、週間予報(天気コード、最高/最低、降水確率) | CORS `*` 確認済み。`cache-control: max-age=60` |
| Open-Meteo `https://api.open-meteo.com/v1/forecast` | 現在値(気温、湿度、体感温度、風速、天気コード)、時間別(気温、降水確率、降水量、天気コード)、日別(最高/最低、天気コード、降水確率) | CORS `*` 確認済み。キー不要。非商用無料枠 1 万回/日 |
| Open-Meteo Geocoding `https://geocoding-api.open-meteo.com/v1/search` | 設定画面の地名検索。日本語検索可(`language=ja`)、結果に都道府県名(`admin1`)を含む | 「千葉」は 0 件、「千葉市」「新宿」は取得できた。短い語は候補が出ないことがある |

気象庁 JSON は湿度を含まない。湿度は Open-Meteo のみから得る。

Open-Meteo のクエリは以下に固定する。

```
latitude, longitude, timezone=Asia/Tokyo, forecast_days=7
current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code,is_day
hourly=temperature_2m,precipitation_probability,precipitation,weather_code
daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max
```

気象庁 JSON の構造(確認済み):

- `[0].timeSeries[0]`: 今日/明日/明後日の `weatherCodes`, `weathers`, `winds`, `waves`(一次細分区域別)
- `[0].timeSeries[1]`: 3時間ごと `pops`(一次細分区域別)
- `[0].timeSeries[2]`: 地点別の気温(アメダス地点別。本ページでは使わない)
- `[1].timeSeries[0]`: 週間 `weatherCodes`, `pops`, `reliabilities`(府県単位)
- `[1].timeSeries[1]`: 週間の `tempsMin`, `tempsMax`(代表地点別。先頭地点を使う)
- `[0].reportDatetime`: 発表時刻

## 画面レイアウト

```
┌──────────────────────────────────────────────────────────────┐
│                                  [☾][−][+][⛶][文A][⚙]│  ツールバー(共通)
│                 千葉市 / 千葉県北西部                         │  表題
├──────────────┬───────────────────────────────────────────────┤
│ 現在         │ 今日・明日 時間別                               │
│ [大SVG] 20°  │  時刻   | 天気SVG | 気温(折線) | 降水確率(棒) │
│ 晴れ 夜 くもり│  降水量(棒、確率と同じ軸領域に重ねる)           │
│ 湿度 80%     │                                                │
│ 体感 21°     ├───────────────────────────────────────────────┤
│ 北東の風 7km/h│ 週間                                           │
│ 波 0.5m      │  曜日 | 天気SVG | 最高/最低 | 降水確率          │
├──────────────┴───────────────────────────────────────────────┤
│            10/12(月) 19:45   最終更新 19:40 ●                 │  ステータス帯(共通)
└──────────────────────────────────────────────────────────────┘
```

- **表題**: 地点名と気象庁区名を中央に表示。**ステータス帯**(共通規約、2026-10-13 改訂で下部へ): 現在日時、最終更新時刻、インジケータ。ツールバーは `2026-10-13-toolbar-and-settings-modal-design.md` 参照。
- **現在ブロック**(左、幅約 28%): Open-Meteo `current` の気温を最大の文字で、その下に気象庁の今日の天気文言。
  続いて湿度、体感温度、風(気象庁の風文言と Open-Meteo の風速)、波(気象庁)。
  天気アイコンは Open-Meteo `current.weather_code` から決める。
- **時間別ブロック**(右上、高さ約 55%): 現在時刻以降、既定 3 時間刻みで 16 コマ(約 2 日)。
  各列に時刻、天気アイコン、気温。その下に気温の折れ線と、降水確率の棒・降水量の棒を描いたグラフ領域。
  グラフは手書きのインライン SVG で描く(ライブラリなし)。
  値は Open-Meteo `hourly`。3 時間刻みでは気温は代表時刻の値、降水確率は区間の最大、降水量は区間の合計、天気コードは区間で最も悪いコード。
  気象庁の `pops` は補助情報として降水確率の棒の下に小さく併記する(時刻区分が揃う場合のみ)。
- **週間ブロック**(右下、高さ約 45%): 7 日分。曜日と日付、天気アイコン、最高/最低、降水確率。
  主は気象庁週間予報。気象庁に値がない日(初日や欠測 `""`)は Open-Meteo `daily` で埋め、埋めた値は薄い色で表示する。
- 文字サイズは `clamp()` で画面幅に追従。狭い高さ(800px)では時間別のコマ数を 12 に減らす(CSS コンテナクエリまたは `matchMedia`)。

## 天気アイコン

- 内部アイコン ID は約 12 種: `sunny`, `sunny-cloudy`, `cloudy`, `cloudy-sunny`, `rain`, `rain-light`, `rain-heavy`, `snow`, `sleet`, `thunder`, `fog`, `unknown`。夜用は `sunny` 系に `night` 変種を持つ(現在ブロックのみ、Open-Meteo `is_day` で判定)。
- インライン SVG `<symbol>` として index.html 内に定義。線は `currentColor`、面は CSS 変数で色付け。
- 変換表(`Logic` に置く、テスト対象):
  - `jmaCodeToIcon(code)`: 気象庁 3 桁コード→ID。先頭桁で大分類(1 晴, 2 曇, 3 雨, 4 雪)、下 2 桁で「時々/後」の副天気を判定。
  - `wmoCodeToIcon(code)`: WMO コード→ID(0 晴, 1-3 曇り系, 45/48 霧, 51-67 雨, 71-77 雪, 80-82 にわか雨, 85/86 にわか雪, 95-99 雷)。
  - `wmoCodeToText(lang, code)`: 英語モードの短文(Partly cloudy など)と日本語の短文。

## 地点設定フロー

設定モーダルの「地点」タブ。

1. 地名入力欄に入力し「検索」。Geocoding API を `language=ja, count=10` で呼ぶ。候補を「新宿(東京都)」の形で一覧。
   0 件のときは「市区町村名まで入力してください(例: 千葉市)」とヒントを出す。
2. 候補を選ぶと `lat`, `lon`, `name`, `admin1`(都道府県名)を確定。
3. `admin1` から内蔵の府県コード表 `JMA_OFFICES`(58 件: コード、名称、英語名、都道府県名)で気象庁の府県を推定する。
   1 都道府県に複数府県区がある場合(北海道、沖縄、鹿児島など)は候補を複数出し、先頭を既定にする。
4. 推定した府県の予報 JSON を取得し、一次細分区域(`[0].timeSeries[0].areas[].area`)をプルダウンに並べる。既定は先頭。
   府県プルダウンも置き、自動推定が外れたときに手で直せる。府県を変えると細分区域を再取得する。
5. 選択内容は即時保存し、画面を再取得・再描画する。

地点設定の保存形式:

```json
{ "name": "千葉市", "lat": 35.6, "lon": 140.11667, "jmaOffice": "120000", "jmaClass10": "120010", "jmaClass10Name": "北西部" }
```

`JMA_OFFICES` は `https://www.jma.go.jp/bosai/common/const/area.json` の `offices` から生成した静的表で、生成手順を README に書く。`area.json` 自体(262KB)は読み込まない。

## 設定項目

| キー | 既定値 | 説明 | URL 例 |
|---|---|---|---|
| `location` | 未設定 | 上記の地点オブジェクト | `?lat=35.6&lon=140.12&office=120000&area=120010&name=千葉市` |
| `refreshMinutes` | 10 | 自動更新間隔(分、1〜120) | `?refreshMinutes=30` |
| `hourlyStep` | 3 | 時間別の刻み(1 または 3) | `?hourlyStep=1` |
| `dailyDays` | 7 | 週間の表示日数(5〜7) | `?dailyDays=5` |
| `lang` | ブラウザ言語 | `ja` / `en` | `?lang=en` |
| `theme` | `auto` | `auto` / `light` / `dark` | `?theme=dark` |

URL の `lat`/`lon`/`office`/`area`/`name` は `location` の各フィールドに写す。`lat` と `lon` が揃っていれば `location` を上書きし、`office`/`area` がなければ地点未設定と同様に気象庁部分だけ空にする。

地点が未設定のときは本体に「右上の設定から地点を選んでください」と案内し、ツールバーの減光を止めて設定ボタンを強調する。

## データフローと状態

```
settings ──> fetchJma(office)       ──> normalizeJma(json, class10)       ──┐
        └──> fetchOpenMeteo(lat,lon)──> normalizeOpenMeteo(json)           ──┤
                                                                            v
                                         mergeForecast(jma, om, now, settings) ──> model ──> render(model)
```

共通モデル:

```js
{
  current:  { temp, humidity, apparent, windSpeed, windDir, icon, text, wind, wave, isDay },
  hourly:   [{ time, temp, pop, precip, icon, jmaPop }],
  daily:    [{ date, icon, tMax, tMin, pop, fromFallback: { icon, tMax, tMin, pop } }],
  meta:     { jmaReportTime, omTime, jmaOk, omOk, errors: [] }
}
```

- `fetch*` は失敗時に例外ではなく `{ ok: false, error }` を返し、`mergeForecast` は片方が欠けても組み立てる。
- `normalize*` と `mergeForecast` と各変換表は `Logic`(`<script id="app-logic">`)に置き、DOM に触らない。
- 更新タイマーは共通規約どおり「次回更新時刻」方式。両 API を `Promise.allSettled` で並行取得する。
- 直前の成功モデルはメモリに保持し、失敗時はそれを描き続ける。localStorage にはキャッシュしない。

## エラー処理

| 状況 | 表示 |
|---|---|
| 両 API 成功 | インジケータ緑、最終更新時刻 |
| Open-Meteo 失敗 | 現在の数値と時間別が「--」、インジケータ赤、理由を帯に表示。文言と週間は気象庁で表示 |
| 気象庁失敗 | 文言・風・波・週間の気象庁部分が空、週間は全日 Open-Meteo で埋め薄色表示。インジケータ赤 |
| 両方失敗 | 前回表示を保持し、インジケータ赤。初回なら案内文 |
| 地点未設定 | 案内文と設定ボタン強調 |
| Geocoding 0 件 | 入力ヒント |

## テスト

`weather/test/` に `node --test` で動くテストを置く。fixture は `weather/test/fixtures/` に保存する(気象庁 120000.json、Open-Meteo の応答、Geocoding の応答)。

- `jmaCodeToIcon`, `wmoCodeToIcon`: 代表コードと境界値。
- `normalizeJma`: 細分区域の選択、`""` の欠測を `null` にする、週間の日付と値の対応。
- `normalizeOpenMeteo`: 時刻のパース、`is_day`。
- `aggregateHourly(hourly, step, now)`: 3 時間への集約(最大/合計/最悪コード)、現在時刻以降の切り出し、コマ数。
- `mergeForecast`: 片方欠け、週間の補完とフラグ、同日判定。
- `resolveSettings`: URL の `lat`/`lon`/`office`/`area` から `location` への写像、範囲外値の既定値戻し。
- `guessJmaOffices(admin1)`: 単一・複数候補・該当なし。

描画と fetch は手動確認とし、README に確認手順(地点設定、ダーク切替、英語切替、ネットワーク切断時の表示)を書く。

## 範囲外

- 複数地点、地点の並列表示、警報・注意報、雨雲レーダー画像、通知。
- 気象庁文言の英訳(英語モードでは WMO コードからの短文で代替)。
- オフラインキャッシュ(Service Worker)。
