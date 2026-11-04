# zabbix 設計書

日付: 2026-11-04
状態: 承認済み(2026-11-04、会話で合意。失敗・STALE は帯を重ねる、トークン欄は text、localStorage に平文で保持)
分類: キオスク向け(`docs/conventions.md` 3.1)

## 目的

Zabbix の API から取得したホストの状態と障害の一覧を、横長 1 画面に常時表示する。`../pi-setup/ansible/roles/zabbix-display`(Python + PIL で `/dev/fb0` に描くロール)と同じ画面を、ブラウザで開くだけの index.html 1 ファイルとして作り直す。Raspberry Pi 以外の端末(余ったタブレットや PC、Chromium のキオスク起動)でも同じ表示が出て、設定を画面上で変えられるのが利点。Pi Zero のような X を載せられない端末は対象外(そこは従来のロールを使う)。

対象の Zabbix は 6.0(確認済み 6.0.34)。6.0 の `api_jsonrpc.php` は `Access-Control-Allow-Origin: *` と `OPTIONS` への即答を返すので、ページはどこに置いても API を直接呼べる。API トークンは JSON 本文の `auth` に入れる(`Authorization` ヘッダーは 6.4 から)。

## 用語

- **ホスト**: Zabbix の host。表示名 `name`、技術名 `host`、`status`(`"1"` が無効)。
- **障害**: `problem.get` が返す未解決の問題。`severity` 0〜5、`objectid` はトリガー ID。
- **severity**: 0 NotCls / 1 Info / 2 Warn / 3 Avg / 4 High / 5 Disaster。
- **ホストの色**: そのホストに紐づく障害の最大 severity の色。障害なしは緑(OK)、無効ホストは暗灰。
- **STALE**: 最後の取得成功から `staleSec` 以上たった状態。

## 画面構成

```
┌ Zabbix Status                    (右上ツールバー: テーマ/拡大/縮小/全画面/日英/設定) ┐
├──────────────────────────────────────────────┬───────────────────────────┤
│ ホストのタイル(7)                             │ 障害の一覧(3)              │
│ ┌────────┐┌────────┐┌────────┐┌────────┐     │ ▌Disaster  host01         │
│ │ host01 ││ host02 ││ host03 ││ host04 │     │ ▌          Zabbix agent … │
│ │(web)   ││(db)    ││        ││        │     │ ▌High      host07         │
│ └────────┘└────────┘└────────┘└────────┘     │ ▌          Free disk …    │
│ …                                            │ …                         │
│                                  + 3 more    │             + 5 more      │
├──────────────────────────────────────────────┴───────────────────────────┤
│ 12 hosts (OK:10 BAD:2)   14:03:25  最終更新 14:03   ●   3 problems  D:1 H:2 │
└──────────────────────────────────────────────────────────────────────────┘
```

- 上下の帯は規約の `h1#page-title`(左上「Zabbix Status」)と `footer#status-bar`(現在時刻、最終更新、状態ドット)。ロールのヘッダー右の時刻とフッターの集計は、ステータス帯の左右に置く(左: ホスト集計、右: 障害集計)。
- 本体は左右 7:3 の 2 ペイン。高さは画面に合わせ、スクロールしない(`body { overflow: hidden }`)。
- 配色はロールと同じ値を `:root` の変数に置く(下表)。ライトテーマは背景だけ明るくし、severity とタイルの色はそのまま(色が意味を持つため)。

| 変数 | 値(dark) | 用途 |
|---|---|---|
| `--bg` | `#14181e` | 画面 |
| `--pane` | `#1e242c` | ペイン |
| `--fg` / `--fg-dim` | `#f0f0f0` / `#aaaaaa` | 文字 |
| `--sev-0` … `--sev-5` | `#97aab3` `#7499ff` `#ffc859` `#ffa059` `#e97659` `#e45959` | severity |
| `--ok` / `--disabled` | `#5cb85c` / `#505050` | ホストの色 |
| `--error-bg` / `--stale-bg` | `#6e1414` / `#6e4600` | 失敗 / STALE の帯 |

タイルと障害行の文字色は黒(severity の色の上)で、太字は使わない(規約)。距離からの可読性は文字サイズで取る。

### ホストのタイル(左ペイン)

ロールの `render_hosts_pane` と同じ規則を `Logic.tileLayout` で計算し、CSS Grid で並べる。

- 列数 `cols = clamp(1, round(sqrt(n × aspect)), min(n, 8))`、行数 `rows = ceil(n / cols)`。`aspect` はペインの幅 ÷ 高さ(余白 14px を引いたもの)。
- タイルの高さが 40px を切るなら行数を `floor((avail_h + 14) / 54)` に減らし、収まらない分は最後の行の下に「+ N more (out of M)」を 1 行出す。
- 文字サイズ: `min(64, tile_h × 0.40)` から始め、各ホスト名の先頭 `tileMinChars` 文字(括弧の前と括弧の中を別に)がタイル幅 − 12px に収まるまで下げる。下限は `tileMinFont`。それでも入らない名前は `…` で切る。幅の測定は `canvas` の `measureText`(UI 側)で行い、`Logic.fitFontSize(widths, boxW, scale)` には「基準サイズ 100px での各文字列の幅」を渡す。
- 名前は `split_name` と同じく `foo (bar)` → 1 行目 `foo`、2 行目 `(bar)`(0.7 倍)。
- タイルの並びは `host.get` の `sortfield: name`。`hosts` 設定があればその順(存在しない名前は無視)。

### 障害の一覧(右ペイン)

- 1 行 50px。左に severity の色の帯(幅 140px、文字は severity 名)、右にホスト名(22px)とトリガー名(20px、薄い色)。どちらも幅で `…`。
- 行数は `min(件数, problemMaxRows, ペインに入る行数)`。あふれた分は「+ N more (out of M)」。
- 並びは `eventid` 降順(新しいものが上)。
- 0 件なら「No active problems」。

### 失敗と STALE

- 取得に失敗したら前回の表示を残し、画面上端に赤い帯(高さ 80px)「CONNECTION FAILED — <理由>」を重ねる。ステータス帯は赤ドット。
- 最後の成功から `staleSec` 以上たったら、橙の帯「DATA STALE — Last update <時刻> (Age <分>m <秒>s)」に変える(失敗の帯より優先)。1 秒ごとの時計更新で判定する。
- 一度も成功していない(設定直後など)ときはペインに「No data yet」。URL やトークンが空ならロールの必須チェックと同じく、ペインに「Set Zabbix URL and token in settings」を出し、`setToolbarAttention(true)`。

私の判断: ロールは失敗・STALE を全画面の赤/橙で描くが、ここでは前回のデータを残して帯を重ねる(規約「失敗時も前回データを残す」)。全画面にしたければ設定で切り替えられるようにはせず、仕様変更で対応する。

## 取得(`App.refresh`)

ロールの `fetch_data` と同じ 4 呼び出しを順に行う(`Logic.apiRequest(method, params, token)` が JSON-RPC の本文を作る)。

1. `hostgroup.get` `{ filter: { name: hostGroups }, output: ['groupid', 'name'] }` → 1 つも無ければ失敗「No matching host groups: …」。
2. `host.get` `{ groupids, output: ['hostid', 'host', 'name', 'status'], sortfield: ['name'] }` → `hosts` 設定で絞り・並べ替え(`Logic.orderHosts`)。
3. `problem.get` `{ groupids, severities: [severityMin … 5], output: 'extend', sortfield: ['eventid'], sortorder: 'DESC' }`。
4. 障害が 1 件以上なら `trigger.get` `{ triggerids, output: ['triggerid'], selectHosts: ['hostid', 'name'], monitored: true }`。

`Logic.mergeData(hosts, problems, triggers)` が、表示対象ホストに紐づく障害だけを残し、ホストごとの最大 severity と `_disabled`、障害ごとの表示ホスト名(対象内のホストを優先)を付けて `{ hosts, problems, summary }` を返す。`summary` は `{ hostsTotal, hostsOk, hostsBad, problems, bySeverity: [6 つの件数] }`。

- `fetch` は `POST`、`Content-Type: application/json`、本文 `{ jsonrpc: '2.0', id, method, params, auth: token }`、`AbortSignal.timeout(requestTimeoutSec × 1000)`、`cache: 'no-store'`。
- API の `error` は `error.data` か `error.message` を理由にして失敗扱い。
- 更新は「次回更新時刻」方式(`refreshSec`)。`visibilitychange` 復帰時に期限切れなら即時。
- 設定のうち `DISPLAY_ONLY_KEYS` 以外(URL、トークン、グループ、ホスト、severityMin、refreshSec、requestTimeoutSec)が変わったら即時再取得。

## 設定

| セクション | キー | 型・範囲 | 既定 | 意味(ロールの変数) |
|---|---|---|---|---|
| 接続 | `zabbixUrl` | 文字列(`http(s)://` で始まる。末尾の `/` と `api_jsonrpc.php` は取り除く) | `''` | `zabbix_url` |
| 接続 | `token` | 文字列 | `''` | `zabbix_token` |
| 接続 | `hostGroups` | 文字列(カンマ区切り) | `''` | `zabbix_host_groups` |
| 接続 | `hosts` | 文字列(カンマ区切り、空なら全ホスト) | `''` | `zabbix_hosts` |
| 接続 | `severityMin` | int 0〜5 | 2 | `zabbix_severity_min` |
| 接続 | `refreshSec` | int 15〜600 | 60 | `zabbix_refresh_interval` |
| 接続 | `requestTimeoutSec` | int 3〜60 | 10 | `zabbix_request_timeout` |
| 表示 | `staleSec` | int 30〜3600 | 150 | `zabbix_stale_threshold` |
| 表示 | `problemMaxRows` | int 1〜50 | 20 | `zabbix_problem_max_rows` |
| 表示 | `tileMinChars` | int 4〜30 | 10 | `zabbix_tile_min_chars` |
| 表示 | `tileMinFont` | int 10〜40 | 16 | `zabbix_tile_min_font` |

共通キー `lang` / `theme` / `zoom` は規約どおり。`DISPLAY_ONLY_KEYS` は `theme` `zoom` `lang` `staleSec` `problemMaxRows` `tileMinChars` `tileMinFont`。設定モーダルのタブは 一般(接続) / 表示 / データ / About。`token` の入力欄は `type="text"`(端末の localStorage に平文で残る。calendar の GAS トークンと同じ扱い)。画面サイズの設定(`zabbix_screen_width/height`)は不要(ビューポートに合わせる)。

設置端末向けには calendar と同じく URL クエリで全設定を渡せる(例: `?zabbixUrl=https://zabbix.example.com/zabbix&token=…&hostGroups=Linux%20servers&save=1`)。トークンが URL に載るので、`save=1` で一度保存したら素の URL を開き直す運用を README に書く。

## データ

ユーザーデータは無い(設定のみ)。データタブは設定の書き出し/読み込み/全消去(ひな形どおり)。

## Logic(純粋関数、テスト対象)

| 関数 | 内容 |
|---|---|
| `normalizeUrl(s)` | 末尾 `/`・`api_jsonrpc.php` を除き、`http(s)://` でなければ `''` |
| `parseList(s)` | カンマ区切り → trim 済みの空でない配列 |
| `apiRequest(method, params, token, id)` | JSON-RPC 本文(`auth: token`、トークン空なら `null`) |
| `apiResult(json)` | `{ ok, result }` か `{ ok: false, error }`(`error.data` 優先) |
| `orderHosts(hosts, names)` | `hosts` 設定の順に絞る(表示名か技術名で一致、重複なし)。空ならそのまま |
| `mergeData(hosts, problems, triggers)` | 上記「取得」の結果形 |
| `hostColorKey(host)` | `'disabled'` / `'ok'` / `'sev0'`〜`'sev5'` |
| `splitName(name)` | `foo (bar)` → `['foo', '(bar)']` |
| `fitFontSize(widths100, boxW, scale)` | 基準 100px での幅から入る最大サイズ |
| `tileLayout(n, availW, availH, opts)` | `{ cols, rows, tileW, tileH, visible, truncated }` |
| `tileFontSize(tileH, limits, minFont)` | `min(64, tileH × 0.4)` と各 limit の最小、下限 `minFont` |
| `visibleRows(count, maxRows, paneH, rowH, pad)` | 障害一覧の表示行数 |
| `summaryText(summary, lang)` | フッター左右の文字列 |
| `isStale(lastOkAt, now, staleSec)` / `ageText(ms)` | STALE 判定と `Xm Ys` |

テストの固定データは `test/fixtures/` に `hostgroup.json` `host.json` `problem.json` `trigger.json` を置く(ロールと同じ環境から取った形で、名前は架空にする)。

## App(DOM)

ひな形(`_template`)を起点に: ツールバー(全画面あり)、設定モーダル、ステータス帯、更新タイマー。本体は `main#content` に `#pane-hosts`(CSS Grid)と `#pane-problems`、上端の `#banner`(失敗 / STALE)。タイルの文字幅は非表示の `canvas` で `measureText` し、`Logic.fitFontSize` に渡す。1 秒ごとの `tickClock` で時計と STALE 判定を更新し、取得は `scheduleRefresh`。

## エラー処理

- URL かトークンが空: 取得しない。ペインに案内、設定ボタンを強調。
- ネットワーク/HTTP/API エラー: 前回表示を残し、赤い帯 + 赤ドット。理由はステータス帯にも出す。
- `hostgroup.get` が空: 失敗扱い(理由「No matching host groups」)。
- localStorage が使えない: メモリ上で動作、黄ドット。

## テスト(`zabbix/test/`)

- `logic.test.mjs`: `normalizeUrl`、`parseList`、`apiRequest`、`apiResult`、`orderHosts`。
- `merge.test.mjs`: fixtures から `mergeData`(対象外ホストの障害を落とす、最大 severity、無効ホスト、複数ホストにまたがるトリガーの表示名、summary の件数)。
- `layout.test.mjs`: `tileLayout`(ロールの実測表: 12 → 64px、16 → 54px、20 → 46px、25 → 29px、40 → 21px を、DejaVu 相当の幅係数で近似して検査)、`visibleRows`、`fitFontSize`、`isStale` / `ageText`。
- `page.test.mjs`: 外部リソースなし、`innerHTML` なし、絵文字・太字なし、両スクリプトの構文解析、id の存在、i18n の ja/en 対応。

## 手動確認

1. 設定に URL・トークン・グループを入れると 60 秒以内にタイルと障害が出る。
2. グループ名を間違えると赤い帯に「No matching host groups」。
3. Zabbix を止める(または URL を壊す)と赤い帯、前回のタイルは残る。150 秒後に橙の STALE 帯に変わる。
4. 1920×1080 でホスト 12 / 20 / 40 件のときのタイル文字が、ロールの実測表と同程度。
5. `?…&save=1` で設定した端末で素の URL を開いても表示が続く。

## 範囲外

- ブラウザ自体が固まったときの復旧(端末側の systemd 等で行う)。
- 6.4 以降の `Authorization` ヘッダー方式(6.0 の `auth` に固定)。
- 障害の確認(acknowledge)などの書き込み操作。
- 日本語ホスト名の特別扱い(システム書体で出す)。
