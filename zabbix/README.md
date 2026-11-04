# zabbix

Zabbix の API から取得したホストの状態と障害を横長 1 画面に常時表示するページ。`index.html` 1 ファイルで動き、ビルドも外部読込もありません。Zabbix 6.0 を対象にしています。

## 機能

- 画面は左右 7:3 の 2 ペイン。左にホストのタイル、右に障害の一覧
- タイルは、そのホストの未解決の障害のうち最も重い severity の色で塗る。障害がなければ正常色、無効化されたホストは別の色。文字はタイルに収まる最大のフォントサイズで表示し、`tileMinFont` を下回るなら表示しきれないタイルを切り詰めて `+ N more (out of M)` を出す
- 右の障害一覧は新しい順。`problemMaxRows` 行まで表示し、超えた分は同じく `+ N more` で示す
- 下部のサマリーに、ホスト数・障害数と severity ごとの件数。中央のステータス帯に現在時刻、最終更新時刻、状態ドット(緑/黄/赤)
- 取得に失敗すると赤い `CONNECTION FAILED` バナーを出し、前回取得したデータは残す。最後に成功してから `staleSec` 秒が過ぎるとオレンジの `DATA STALE` バナーに変わる(データが古いことを見落とさないため)
- 未設定のとき(URL かトークンが空)は設定ボタンを強調して設定を促す
- 共通のツールバー(ダーク/ライト、拡大、縮小、フルスクリーン、日英、設定)と設定モーダル

## 前提

- Zabbix 6.0。トークンは API トークンを使い、JSON-RPC リクエスト本文の `auth` に載せる(6.4 以降の `Authorization` ヘッダー認証は使わない)
- CORS: Zabbix 6.0 の `api_jsonrpc.php` は `Access-Control-Allow-Origin: *` を返すので、このページは任意の場所に置ける(Zabbix と同じオリジンである必要はない)
- トークンは localStorage に平文で保存される(calendar の GAS トークンと同じ扱い)。Zabbix 側には読み取り専用のユーザーとトークンを用意することを推奨する
- ブラウザが必要。Raspberry Pi Zero クラスの端末では、これまでどおり `pi-setup` の `zabbix-display` ロールを使う

## キオスクでの使い方

1. 一度だけ `?zabbixUrl=https://zabbix.example.com/zabbix&token=…&hostGroups=Linux%20servers&save=1` を付けて開く。`save=1` のときだけ localStorage に保存される
2. 以降は素の URL(`zabbix/`)を開く。設定は localStorage から読まれる

`hostGroups` が空なら全ホストグループが対象(Ansible ロールと同じ)。

## 設定項目

優先順位は URL クエリ > localStorage > 既定値。「表示のみ」の設定は変更しても再取得せず、再描画だけ行う。それ以外のキーが変わると即座に再取得する。

| セクション | キー | 型 | 既定 | 説明 |
|---|---|---|---|---|
| 一般 | `lang` | `'ja' \| 'en'` | 言語検出 | 共通(表示のみ) |
| 表示 | `theme` | `'auto' \| 'light' \| 'dark'` | `auto`(OS) | 共通(表示のみ) |
| 表示 | `zoom` | 50〜200 | 100 | 共通(表示のみ) |
| Zabbix | `zabbixUrl` | 文字列 | 空 | Zabbix のベース URL。`/api_jsonrpc.php` はページが補う |
| Zabbix | `token` | 文字列 | 空 | API トークン。JSON-RPC 本文の `auth` に載せる |
| Zabbix | `hostGroups` | 文字列(カンマ区切り) | 空(全グループ) | 対象のホストグループ名。該当するグループがなければエラー |
| Zabbix | `hosts` | 文字列(カンマ区切り) | 空(全ホスト) | 指定すると、そのホスト(表示名またはホスト名)だけを指定した順に表示 |
| Zabbix | `severityMin` | 0〜5 | 2 | 取得する障害の最小 severity(0 未分類〜5 災害)。2 = Warning 以上 |
| 取得 | `refreshSec` | 15〜600 | 60 | 更新間隔(秒) |
| 取得 | `requestTimeoutSec` | 3〜60 | 10 | 1 リクエストのタイムアウト(秒) |
| 表示 | `staleSec` | 30〜3600 | 150 | 最終成功からこの秒数を過ぎると `DATA STALE`(表示のみ) |
| 表示 | `problemMaxRows` | 1〜50 | 20 | 障害一覧の最大行数(表示のみ) |
| 表示 | `tileMinChars` | 4〜30 | 10 | タイルの文字数の目安。これに合わせてタイルの大きさを決める(表示のみ) |
| 表示 | `tileMinFont` | 10〜40 | 16 | タイルの最小フォントサイズ(px)。下回る分は `+ N more` に回す(表示のみ) |

### URL パラメータ

上の設定キーはすべて同名のクエリパラメータで上書きできる(例: `?hostGroups=Linux%20servers&severityMin=3`)。`save=1` を付けたときだけ localStorage に保存する。

## データ形式

localStorage `simplePages.zabbix` に `{ version, settings }` を保存する。取得したデータは保存せず、メモリ上にだけ持つ(データ用のキーはない)。エクスポート/インポートは設定のみが対象。

## 使用 API

Zabbix JSON-RPC API(`POST <zabbixUrl>/api_jsonrpc.php`)。

- `hostgroup.get`: `hostGroups` の名前からグループ ID を解決
- `host.get`: 対象グループのホスト
- `problem.get`: `severityMin` 以上の未解決の障害
- `trigger.get`: 障害のトリガーから所属ホストを引く

## テスト

```bash
node --test zabbix/test/*.test.mjs
```

手動確認用のモック API(テストではない): `node zabbix/test/mock-api.mjs 8790 [--hosts N] [--fail]`。リポジトリルートを静的配信し、`POST /zabbix/api_jsonrpc.php` を fixtures から返す。`http://localhost:8790/zabbix/?zabbixUrl=http://localhost:8790/zabbix&token=t&hostGroups=Linux%20servers` で開く。実行中は `GET /__mock?fail=1|0&hosts=N` で切り替えられる。
