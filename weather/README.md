# weather

設定した 1 地点の天気予報を、横長モニタやタブレットのブラウザ全画面に常時表示するページ。
`index.html` 単体で動き、API キーは不要。

## 機能

- 現在の天気: 気温、天気文言(気象庁)、湿度、体感温度、風、波
- 今日・明日の時間別: 気温の折れ線、降水確率と降水量の棒、天気アイコン(既定 3 時間刻み 16 コマ)
- 週間予報: 7 日分の天気、最高/最低気温、降水確率(気象庁。欠けは Open-Meteo で補完し薄く表示)
- 10 分ごとに自動更新(変更可)。失敗時は前回表示を保ち、ステータス帯に赤で理由を表示
- ダーク/ライト(自動/手動)、日本語/英語
- 地点検索で都道府県に複数の予報区がある場合(北海道・鹿児島・沖縄)は、座標に最も近い予報区を既定にする

## 使い方

1. `index.html` をブラウザで開く。
2. 左下の歯車 → 「地点」タブで地名を検索(例: 千葉市、新宿)し、候補を選ぶ。
3. 気象庁の府県予報区と一次細分区域が自動で入る。外れていればプルダウンで直す。
4. 常時表示端末では、設定済みの URL をブックマークするか、`?...&save=1` で一度保存する。

### URL パラメータ

| パラメータ | 例 | 説明 |
|---|---|---|
| `lat`, `lon` | `lat=35.6&lon=140.12` | 緯度経度(両方必須で地点を上書き) |
| `office` | `office=120000` | 気象庁 府県予報区コード |
| `area` | `area=120010` | 気象庁 一次細分区域コード |
| `name` | `name=千葉市` | 表示名 |
| `refreshMinutes` | `refreshMinutes=30` | 更新間隔(分、1〜120) |
| `hourlyStep` | `hourlyStep=1` | 時間別の刻み(1 または 3) |
| `hourlyCount` | `hourlyCount=12` | 時間別のコマ数(6〜24) |
| `dailyDays` | `dailyDays=5` | 週間の日数(5〜7) |
| `lang` | `lang=en` | `ja` / `en` |
| `theme` | `theme=dark` | `auto` / `light` / `dark` |
| `save` | `save=1` | URL の設定を localStorage に保存する |

優先順位は URL > localStorage > 既定値。

## データの保存形式

localStorage キー `simplePages.weather`:

```json
{
  "version": 1,
  "settings": {
    "lang": "ja", "theme": "auto", "refreshMinutes": 10,
    "hourlyStep": 3, "hourlyCount": 16, "dailyDays": 7,
    "location": { "name": "千葉市", "lat": 35.6, "lon": 140.11667, "jmaOffice": "120000", "jmaClass10": "120010", "jmaClass10Name": "北西部" }
  }
}
```

## 使用 API

| API | 用途 | 備考 |
|---|---|---|
| 気象庁 `https://www.jma.go.jp/bosai/forecast/data/forecast/<office>.json` | 天気文言、風、波、3 時間ごとの降水確率、週間予報 | キー不要、CORS 可。日本国内のみ。湿度は含まれない |
| Open-Meteo `https://api.open-meteo.com/v1/forecast` | 現在値、時間別、日別 | キー不要、CORS 可。非商用無料枠 1 日 1 万回 |
| Open-Meteo Geocoding `https://geocoding-api.open-meteo.com/v1/search` | 地名検索 | 日本語可。短い語(「千葉」「札幌」)は 0 件になることがあるので市区町村名まで入力する |

気象庁の府県予報区表 `JMA_OFFICES` は `tools/gen-jma-offices.mjs` で `area.json` から生成したものを埋め込んでいる。更新するときは `node weather/tools/gen-jma-offices.mjs` の出力で置き換える。

## 既知の制約

- 時間別の気象庁降水確率は、時刻が一致するコマ(00/06/12/18 時)にだけ併記される
- Open-Meteo の取得に失敗した間は数値が「--」になる(気象庁の文言・週間は表示を続ける)
- 画面を縮めると時間別のコマ数が自動で減る(高さ 900px 未満で最大 12)

## テスト

```bash
node --test weather/test/*.test.mjs
```

fixture は `test/fixtures/` にある。更新するときは `docs/superpowers/plans/2026-10-12-weather.md` Task 1 の curl を使う。

## 手動確認

- 地点未設定で案内文が出る(左下の歯車 → 地点タブ)
- 地点を選ぶと 3 パネルが描かれる
- ネットワークを切って更新すると表示が残り、ステータスが赤になる
- 言語を English にすると UI と天気短文が英語になる(気象庁文言は出ない)
- ダークに切り替えてアイコン色が見える
- 1920×1080 と 1280×800 でスクロールが出ない
