# k_timer ページ 設計書

日付: 2026-10-14
対象: `k_timer/index.html`、`k_timer/audio/`、`k_timer/test/`、`k_timer/README.md`
前提: 共通規約 `2026-10-12-simplepages-conventions-design.md` と `2026-10-13-toolbar-and-settings-modal-design.md`(右上ツールバー、下部ステータス帯、固定サイズ設定モーダル、`--zoom`)。

## 目的

キッチンタイマー。横長モニタ/タブレットでは左にアナログ時計(現在時刻)、右にタイマーを並べて常時表示する。プリセット(3 / 5 / 12 分)と ± ボタンで時間を決め、スタート/ストップ/リセットで操作する。0 になったら終了音をループ再生し、利用者が止めるまで鳴り続ける。

ネットワーク取得はしない。`refresh()` は何もしない。

## 構成

```
k_timer/
  index.html             ページ本体
  audio/sound2-1.wav     終了音 1(ロングトーン、既定。mixkit.co 由来)
  audio/sound2-2.wav     終了音 2(ダブルビープ)
  audio/sound2-3.wav     終了音 3(下降トーン)
  test/                  Logic のテスト
  README.md
```

音声ファイルは `../l_timer/audio/sound2-*.wav` をそのままコピーする(合計約 2.7 MB)。

### 規約の緩和(共通規約への追記)

「index.html 単体・外部読込禁止」の例外として、**同じページディレクトリ内のメディアファイル(音声・画像)は相対パスで読み込んでよい**。`src` に入れるパスは index.html 内の定数リストに限り、設定値や URL クエリの文字列をそのまま `src` に渡さない。CDN・他ドメイン・他ページディレクトリの参照は引き続き禁止。

## 画面レイアウト

```
┌────────────────────────────────────────────── [◐][−][+][⛶][A][⚙]┐
│                             │                                      │
│        ┌─────────┐          │              4:37                    │
│        │ 12      │          │           終了 14:32                 │
│        │9   ·   3│          │                                      │
│        │    6    │          │     [ 3 分 ] [ 5 分 ] [ 12 分 ]       │
│        └─────────┘          │  [-10][-1][-0.5][00][+0.5][+1][+10]   │
│                             │        [ スタート ]  [ リセット ]      │
│                             │                                      │
│                       2026-10-14 (火) ●                            │
└────────────────────────────────────────────────────────────────────┘
```

- `main` は `grid-template-columns: 1fr 1fr`。左カラム `section#clock`、右カラム `section#timer`。縦横ともに中央寄せ。
- **幅 700px 未満**(スマホ縦など)は `#clock` を `display: none` にして 1 カラム。縦積みはしない。
- `h1#page-title` は規約どおり `main` 先頭に置くが `k_timer` では視覚的に非表示(`.visually-hidden`)。表題は不要なため。

### アナログ時計(`#clock`)

- `<svg viewBox="0 0 200 200">`。外周円、12 の数字(1〜12)、分目盛(60、5 分ごと太く)、時針・分針・秒針、中心点。
- 針は `transform: rotate(deg 100 100)` を `Logic.handAngles(date)` の値で毎 tick 更新(秒針は 1 秒刻み、滑らかにしない)。
- `settings.seconds` が false なら秒針を非表示。
- 大きさは `min(90vw/2, 70vh)` 程度で、カラムに収まる最大。色は `--fg` / `--fg-muted` / 秒針 `--accent`。

### タイマー(`#timer`)

上から順に:

1. `#remaining`: 残り時間。`m:ss`(例 `4:37`、`12:00`、`0:05`)。alarm 中は超過を `-m:ss`(例 `-0:42`)で表示し点滅。フォントは `--fs-timer = calc(clamp(64px, 14vw, 180px) * var(--zoom))`、等幅数字(`font-variant-numeric: tabular-nums`)。
2. `#end-at`: 動作中のみ「終了 14:32」(`end_at` i18n: `終了 {time}` / `Ends {time}`)。`HH:MM` 24 時間。終了時刻が翌日なら「終了 翌 0:05」(`end_at_tomorrow`)。idle / paused / alarm では空(高さは確保し、レイアウトが跳ねないようにする)。
3. `.row.presets`: ボタン 3 つ。表記は `{n} 分` / `{n} min`。設定 `preset1..3`。
4. `.row.adjust`: ボタン 7 つ。表記は固定 `-10` `-1` `-0.5` `00` `+0.5` `+1` `+10`。単位は分(0.5 = 30 秒)。
5. `.row.controls`: `#btn-start`(idle / paused で「スタート」、running で「ストップ」、alarm で「停止」)と `#btn-reset`(「リセット」)。`#btn-start` は `--accent` 塗り。

ボタンは `min-height: calc(48px * var(--zoom))`、`min-width: calc(56px * var(--zoom))`、`--fs-base` の 1.1 倍、タッチ対象の間隔 `--gap`。

### ステータス帯

共通の `footer#status-bar` を使うが、現在時刻の代わりに**日付のみ**(`2026-10-14 (火)` / `Tue, Oct 14, 2026`)を表示する。「最終更新」は出さない。状態ドット: 緑 = 正常、赤 = 音声ファイル読込失敗(メッセージ `error_audio`)。黄は使わない。

## タイマーの状態機械(Logic)

状態は 1 オブジェクト `TimerState`。純粋関数が `(state, now, ...) => state` で返す。

```js
{ phase: 'idle' | 'running' | 'paused' | 'alarm',
  startMs: 300000,      // リセットの戻り先。プリセット押下または停止中の調整で更新
  remainingMs: 300000,  // idle / paused のときの残り
  endAt: null }         // running / alarm のときの終了エポック ms
```

| 操作 | idle | running | paused | alarm |
|---|---|---|---|---|
| `start(s, now)` | `remainingMs > 0` なら running、`endAt = now + remainingMs`。0 なら無視 | → paused(`remainingMs = max(0, endAt - now)`) | → running(`endAt = now + remainingMs`) | → idle(`remainingMs = startMs`)音停止 |
| `reset(s)` | `remainingMs = startMs` | → idle、`remainingMs = startMs` | 同左 | 同左、音停止 |
| `preset(s, minutes)` | `startMs = remainingMs = minutes*60000`、idle | 同左(停止する) | 同左 | 同左、音停止 |
| `adjust(s, deltaMs, now)` | `remainingMs = clamp(remainingMs + delta, 0, MAX)`、`startMs = remainingMs` | `endAt += delta`。`endAt - now <= 0` なら alarm(`endAt = now`) | idle と同じ(`startMs` も更新) | 無視 |
| `zero(s, now)` | `remainingMs = floor(remainingMs / 60000) * 60000`、`startMs` も同じ | `endAt` を分単位に切り下げ(`endAt` の秒・ミリ秒を 00 に)。結果が `now` 以下なら alarm | idle と同じ | 無視 |
| `tick(s, now)` | 変化なし | `endAt - now <= 0` なら alarm | 変化なし | 変化なし |

- `MAX = 180 * 60000`(3 時間)。
- `adjust` の delta は `-600000, -60000, -30000, +30000, +60000, +600000`。
- 動作中の `adjust`/`zero` は `startMs` を変えない(リセットは元の開始値に戻る)。
- `remainingFor(s, now)`: idle/paused → `remainingMs`、running → `endAt - now`、alarm → `endAt - now`(負)。
- `formatRemaining(ms)`: `ms >= 0` は `ceil(ms/1000)` 秒を `m:ss`。負は `-` + `floor(-ms/1000)` 秒を `m:ss`。表示上 1 秒残っているうちは `0:01`、0 到達の瞬間 `0:00`。
- `formatEndAt(endAt, now, lang)`: `HH:MM`。`endAt` の日付が `now` の翌日なら翌日表記。
- `handAngles(date)`: `{ hour, minute, second }` 度。`hour = (h%12)*30 + m*0.5 + s/120`、`minute = m*6 + s*0.1`、`second = s*6`。
- `formatDateLine(date, lang)`: ステータス帯の日付文字列。

### 時刻の扱い(App)

- `now = Date.now()`。描画は 250 ms の `setInterval`(`tick` → `render`)。`visibilitychange` 復帰時に即 tick + render。
- 0 到達判定は Logic の `tick` に任せる。App は phase が `alarm` に変わった瞬間に音と点滅を開始。
- タイマー状態は localStorage に保存しない。リロードで `idle`、`startMs = remainingMs = preset1 * 60000`。

## サウンド

- `<audio id="alarm-audio" loop preload="auto">` 1 要素。`src` は `SOUNDS = { 'sound2-1': 'audio/sound2-1.wav', ... }` から `settings.sound` で選ぶ(キーが辞書にないときは既定)。
- `alarm` 開始で `audio.currentTime = 0; audio.volume = settings.volume / 100; audio.play()`。
- **停止条件**(いずれか): `document` の `pointerdown`、`keydown`、ストップ/リセット/プリセット押下。設定モーダル内の操作や右上ツールバーの操作も `pointerdown` として止める(どこを触っても止まる)。止めたら `start(s)` の alarm 遷移と同じく idle(`remainingMs = startMs`)。
- 自動再生制限: スタート押下(ユーザー操作)時に `audio.load()` し、`audio.play().then(() => audio.pause())` を一度実行して再生許可を得る(`volume` は 0 にして無音で)。これが reject されても無視し、alarm 時の `play()` で再試行する。
- 読込失敗(`audio` の `error` イベント、または `play()` が `NotSupportedError`/`NotAllowedError` 以外で reject): ステータス赤 `error_audio`、Web Audio API で 880 Hz 0.2 s のビープを 0.6 s 周期で鳴らすフォールバック(`AudioContext` はスタート押下時に生成)。
- 試聴ボタン(設定 → タイマー タブ): 選択中の音を 1 回(loop なし)再生、もう一度押すか音の変更で停止。alarm 中は試聴しない。
- 画面点滅: `settings.flash` が true なら `html.alarm` クラスを付け、`body` 背景を `--bg` と `--error` 系の薄い色で 0.5 s ごとに交互(`@keyframes`)。`prefers-reduced-motion: reduce` では点滅せず薄い赤に固定。`#remaining` は flash と無関係に 1 s 周期で点滅。

## 設定項目

localStorage キー `simplePages.k_timer`、`version: 1`。

| キー | 型 | 既定 | URL | 説明 |
|---|---|---|---|---|
| `theme` | enum auto/light/dark | auto | `theme=dark` | 共通 |
| `lang` | enum ja/en | 検出 | `lang=en` | 共通 |
| `zoom` | int 50〜200 | 100 | `zoom=120` | 共通 |
| `preset1` | int 1〜180 | 3 | `preset1=4` | プリセット 1(分) |
| `preset2` | int 1〜180 | 5 | `preset2=7` | プリセット 2 |
| `preset3` | int 1〜180 | 12 | `preset3=15` | プリセット 3 |
| `sound` | enum sound2-1/2-2/2-3 | sound2-1 | `sound=sound2-2` | 終了音 |
| `volume` | int 0〜100 | 80 | `volume=50` | 音量 |
| `flash` | bool | true | `flash=0` | 終了時に画面を点滅 |
| `seconds` | bool | true | `seconds=0` | 秒針を表示 |

- 全キーが表示専用なので `DISPLAY_ONLY_KEYS` に全部入れる(`refresh()` は空)。
- `coerce` に `type: 'bool'` を追加する(テンプレートにはまだない)。受理する値は `true`/`false`(boolean)と文字列 `'1'`/`'0'`/`'true'`/`'false'`。それ以外は `undefined`(既定値へ)。`_template/index.html` と weather / calendar の共通 Logic にも同じ実装を入れ、テンプレートのテストに追加する。
- 設定モーダルのタブ: 一般 / 表示 / タイマー / データ / About。
  - 表示タブに「秒針を表示」。
  - タイマータブ: プリセット 1〜3(number)、終了音(select)+「試聴」ボタン、音量(range 0〜100 と数値表示)、「終了時に画面を点滅」(checkbox)。
- プリセット変更は即座にボタン表記へ反映。idle のときは `startMs`/`remainingMs` も `preset1` に追従させない(ユーザーがプリセットを押すまで現在値を保つ)。
- About: 説明、GitHub、MIT、クレジット(`ABOUT.credits`: 「終了音 sound2-1: mixkit.co(Mixkit License)」「Material Icons」)。

## エラー処理

- 音声読込失敗: 上記フォールバック + ステータス赤。タイマー自体は動き続ける。
- `localStorage` 不可: 共通どおり既定値で動く。
- `AudioContext` 非対応: フォールバックも鳴らせない場合は点滅のみ(ステータス赤のまま)。

## Logic(純粋関数、テスト対象)

`Logic` に以下を公開(共通の `resolveSettings` 等に加えて):

- `initialState(presetMinutes)`
- `start(s, now)`, `stop` は `start` に統合(トグル)、`reset(s)`, `preset(s, minutes)`, `adjust(s, deltaMs, now)`, `zero(s, now)`, `tick(s, now)`
- `remainingFor(s, now)`, `formatRemaining(ms)`, `formatEndAt(endAt, now, lang)`, `formatDateLine(date, lang)`
- `handAngles(date)`
- `isDisplayOnly`、`MAX_MS`、`ADJUST_STEPS`、`SOUNDS`(キー一覧)

## テスト(`k_timer/test/`)

- `logic.test.mjs`: 共通ヘルパー(テンプレート由来)。
- `timer.test.mjs`: 状態遷移表の各セル、`adjust` のクランプ(0 と MAX)、動作中 `adjust` で 0 以下 → alarm、`zero` の切り下げ(idle: 4:37 → 4:00、running: endAt 14:32:37 → 14:32:00、now 以下なら alarm)、`tick` の alarm 遷移、alarm からの `start`/`reset`/`preset` が idle に戻し `remainingMs = startMs`。
- `format.test.mjs`: `formatRemaining`(0、999 ms → `0:01`、60000 → `1:00`、-1500 → `-0:01`、180 分)、`formatEndAt`(同日、翌日、ja/en)、`formatDateLine`、`handAngles`(0:00:00、3:30:00、12:00 の 12 時間化)。
- `settings.test.mjs`: スキーマ(bool 型の URL 正規化、範囲外の既定化)、i18n キー網羅(index.html 内の全キー)、`DISPLAY_ONLY_KEYS` が全スキーマキーを含むことを index.html の文字列から確認。
- `audio.test.mjs`: `SOUNDS` の各パスのファイルが `k_timer/` 配下に存在し、先頭 4 バイトが `RIFF`。
- `node --test k_timer/test/*.test.mjs`。ネットワーク不要。

## 手動確認

- 5 分を押してスタート → `4:59` から減り、「終了 HH:MM」が出る
- 動作中に `+1` で終了時刻が 1 分遅れる。`00` で終了時刻の秒が 00 になる
- 0 到達で音がループし、画面が点滅、`-0:03` と超過が進む。画面のどこかをタップすると止まり `5:00` に戻る
- ストップ → スタートで残りから再開。リセットで開始値に戻る
- 設定で音を変えて試聴できる。音量が反映される
- 幅 700px 未満で時計が消えタイマーだけになる
- ダーク/ライト、拡縮、日英で崩れない。`zoom=150` でもボタンが収まる
- `audio/` を一時的にリネームするとステータスが赤になり、ビープで鳴る

## 範囲外

- 複数タイマーの同時動作、ラップ/経過時間計測、途中経過音
- 通知 API、バイブレーション
- タイマー状態の保存・復元
