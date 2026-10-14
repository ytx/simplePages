# l_timer ページ 設計書

日付: 2026-10-15
対象: `l_timer/index.html`、`l_timer/audio/`、`l_timer/test/`、`l_timer/README.md`
前提: 共通規約 `2026-10-12-simplepages-conventions-design.md`、`2026-10-13-toolbar-and-settings-modal-design.md`、k_timer 設計書 `2026-10-14-k_timer-design.md`(同一ディレクトリ内メディアの例外、`bool` 型、音声の自動再生解除とフォールバック)。
元になる実装: `/Users/yt/git/l_timer`(HEAD `b2a28bf`)。機能はそのまま引き継ぎ、構成と作法を simplePages に合わせる。

## 目的

研修用の講義タイマー。講義(既定 50 分)と休憩(10 分 / 60 分)を繰り返し、終了前の予鈴・終了音・超過中の経過音で区切りを知らせる。講義中には独立した演習タイマーを重ねて動かせる。右側に講義メモ用の簡易エディタを置く。

ネットワーク取得はしない。`refresh()` は何もしない。

## 元実装からの変更点(要約)

| 元実装 | 本ページ |
|---|---|
| `css/*.css`、`js/*.js` 6 本、`lib/quill.min.js` | `index.html` 単体(`app-logic` / `app-ui`) |
| Google Fonts の Material Icons | インライン SVG |
| Quill.js リッチテキストエディタ | `contenteditable` 自作。書式は太字・箇条書き・見出しの 3 つ |
| ヘッダー(状態 h1、現在時刻、設定/エディタ/ミュート/テーマ/全画面)、左下 GitHub ボタン | 共通ツールバー + ページ固有ボタン(ミュート、エディタ)、`h1#page-title`、下部ステータス帯、GitHub は About |
| localStorage 8 キーに分散 | `simplePages.l_timer`(設定)と `simplePages.l_timer.data`(文書・下書き・演習タイトル履歴) |
| 設定タブ 時間 / 言語・サウンド / 設定管理 / ライセンス / ☕️ | 表示 / タイマー / 音 / データ / About。Buy Me a Coffee と Quill ライセンスは削除 |
| キーボードショートカット L/B/S/F/T/Esc | 廃止 |
| 予鈴は講義のみ | 講義・休憩・演習すべて |
| 演習中は講義側の操作ボタンを隠す | 残す。休憩開始で演習を一時停止し、講義再開で再開 |
| エディタ独自のズーム(50〜200%、localStorage `editorSettings`) | 維持。段階を 75〜400% に変え、設定 `editorZoom` として保存し、共通の `--zoom` と掛け合わせる |
| 初回起動時の言語選択ダイアログ | 廃止(共通の言語検出とツールバー切替) |
| `prompt` / `confirm` / `alert` | ページ内の小ダイアログ(全消去の `confirm` のみ共通どおり) |
| 1 秒 `setInterval` で `===` 判定(背景タブで取りこぼす) | 終了時刻基準。閾値の跨ぎで判定 |

## 構成

```
l_timer/
  index.html             ページ本体
  audio/sound1-1.wav     予鈴音 1(既定。mixkit.co 由来)
  audio/sound1-2.wav     予鈴音 2
  audio/sound1-3.wav     予鈴音 3
  audio/sound2-1.wav     終了音 1(既定。mixkit.co 由来)
  audio/sound2-2.wav     終了音 2
  audio/sound2-3.wav     終了音 3
  audio/sound3-1.wav     経過音 1(既定。mixkit.co 由来)
  audio/sound3-2.wav     経過音 2
  audio/sound3-3.wav     経過音 3
  test/                  Logic のテスト
  README.md
```

音声ファイルは `../l_timer/audio/sound*-*.wav` 9 本をそのままコピーする(合計約 6.8 MB)。`src` に入れるパスは `Logic.SOUND_FILES` の値のみ。

## 画面レイアウト

```
┌──────────────────────────────────── [🔇][✎]│[◐][−][+][⛶][A][⚙]┐
│ 講義中                              ║                           │
│   ┌ 演習エリア(演習中のみ) ──────┐  ║  [B][•][H]      [−]100%[+] │
│   │ 演習1            [一時停止中]│  ║ ┌───────────────────────┐ │
│   │        12:34                 │  ║ │ メモ本文…              │ │
│   │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  ║ │                       │ │
│   │ 終了 14:12:00                │  ║ │                       │ │
│   │ [-10][-1][+1][+10] [■] [Next]│  ║ │                       │ │
│   └──────────────────────────────┘  ║ └───────────────────────┘ │
│                37:12               ║ [▼ 文書 ][💾][🗑]          │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    ║                           │
│   終了 14:40:00  [-10][-1][+1][+10] ║                           │
│      [▶] [☕] [🍽] [■] [⏱]          ║                           │
│                    2026-10-15 (木) 13:02:48 ●                   │
└────────────────────────────────────────────────────────────────┘
```

- `main#content` は grid。エディタ表示時は `grid-template-columns: var(--left-width) 8px 1fr`(左タイマー、リサイザ、右エディタ)、非表示時は `1fr`。
- **リサイザ**(`#resizer`): pointer イベントでドラッグ、左幅 30〜70% にクランプ、ダブルクリックで 50%。離した時点で設定 `editorWidth` に保存。
- **幅 700px 未満**: 1 カラムで上にタイマー、下にエディタを積む(エディタ表示時)。リサイザは隠す。
- `h1#page-title` は `main` 先頭。状態を表す(下表)。残りが予鈴分以下のとき `.warning` を付けて橙で 1 秒周期に点滅(`prefers-reduced-motion: reduce` では点滅なし)。

| 状態 | ja | en | 色 |
|---|---|---|---|
| idle | 講義の準備 | Lecture Preparation | `--fg` |
| lecture | 講義中 | Lecture | `--c-lecture` |
| lecture 超過 | 講義超過 | Lecture Overtime | `--c-overtime` |
| break | 休憩中 | Break | `--c-break` |

### ツールバーのページ固有ボタン

共通ボタン列の **左** に、同じ `.tbtn` スタイルで 2 つ追加する。共通ボタンと同じく無操作 10 秒で減光する。

- `#btn-mute`: ミュート切替。スピーカー / スピーカー斜線の SVG。ミュート中は `--error` 色。設定 `muted` に保存。
- `#btn-editor`: エディタ表示切替。鉛筆の SVG。表示中は `aria-pressed="true"`。設定 `editor` に保存。

### タイマー列(`#timer-pane`)

`container-type: inline-size` を持ち、文字サイズは列幅に追従する。上から:

1. `#exercise-area`: 演習エリア(後述)。演習が `none` のとき非表示。
2. `#main-remaining`: 講義/休憩の残り時間 `MM:SS`。超過は `+MM:SS`。`--fs-timer = calc(clamp(48px, min(16cqw, 20vh), 180px) * var(--zoom))`、`tabular-nums`。色は講義 `--c-lecture`、休憩 `--c-break`、超過 `--c-overtime`。idle では設定の講義時間を表示(`50:00`)。演習が `running`/`paused` のあいだは `font-size` を 0.5 倍、`opacity: 0.45`。
3. `#main-progress`: 進捗バー。幅は残り時間の文字幅に合わせる(`width: 7ch; font-size: var(--fs-timer)` の容器に入れる)。超過中は 100%。idle では 0%。
4. `#main-end`: 「終了 14:40:00」(`end_at`: `終了 {time}` / `Ends {time}`、`HH:MM:SS`)と `±` ボタン 4 つ(`-10` `-1` `+1` `+10`、単位は分)。idle では時刻を `--:--:--` にし `±` は非表示(高さは確保)。
5. `.row.controls`: 操作ボタン(円形アイコンボタン、下表)。

| ボタン | アイコン | 表示される状態 | 動作 |
|---|---|---|---|
| `#btn-lecture` | ▶ | idle | 講義開始 |
| `#btn-lecture-from-break` | 本 | break | 講義開始(休憩を終える) |
| `#btn-break1` | コーヒーカップ | idle / lecture | 休憩開始(`break1` 分) |
| `#btn-break2` | 食事 | idle / lecture | 昼休憩開始(`break2` 分) |
| `#btn-stop` | ■ | lecture / break | 停止(idle へ) |
| `#btn-exercise` | ストップウォッチ | lecture かつ演習 `none` | 演習の設定パネルを開く |

演習の設定中・実行中・一時停止中でも講義側のボタンは隠さない。ツールチップ(`title`)は i18n(`休憩開始(10 分)` のように設定値を埋め込む: `start_break` = `休憩開始({min} 分)` / `Start break ({min} min)`)。

### 演習エリア(`#exercise-area`)

**設定パネル**(`phase = setup`): タイトル入力(`<input list="exercise-titles">`、履歴を候補表示)、✓(開始)、×(キャンセル)、`MM:00` 表示(橙)、`-10` `-1` `+1` `+10`(分、1〜120 にクランプ)。分の初期値は設定 `exercise`。開くとタイトル入力にフォーカス。

**実行パネル**(`phase = running` / `paused`): 左に 現在の演習(タイトル、残り `MM:SS` 橙、超過は `+MM:SS` 赤、進捗バー、終了時刻、`±` 4 つ、停止 ■ 赤)、右に **次の演習パネル**(ラベル「次の演習」、タイトル入力、`MM:00`、`±` 4 つ、× で折りたたみ)。折りたたみ中は左下に「Next」ボタンが出る。演習開始時は折りたたんだ状態。`paused` のあいだはタイトル横に「一時停止中」(`exercise_paused` / `Paused`)を出し、エリア全体を `opacity: 0.6`。残り時間は止まったまま。`±`、停止、次の演習パネルは `paused` でも操作できる。

### ステータス帯

共通の `footer#status-bar`。日付 + 現在時刻(`2026-10-15 (木) 13:02:48`)。「最終更新」は出さない。状態ドット: 緑 = 正常、赤 = 音声読込失敗(`error_audio`)。

## 講義タイマーの状態機械(Logic)

```js
// MainState
{ mode: 'idle' | 'lecture' | 'break',
  breakType: null | 1 | 2,
  startedAt: null | ms,   // 開始時刻(予鈴の下限判定用)
  endAt: null | ms,       // 終了時刻
  totalMs: 0,             // 進捗率の分母(開始時の長さ。± では変えない)
  overtime: false,        // lecture のみ true になりうる
  lastTickAt: null | ms } // 前回 tick の時刻(閾値跨ぎ判定用)
```

純粋関数は `(state, now, ...) => { state, events }` を返す。`events` は `'warning' | 'end' | 'tick' | 'break_end'` の配列(発生順)。App は `events` を見て音を鳴らす。

| 操作 | idle | lecture | break |
|---|---|---|---|
| `startLecture(s, now, min)` | lecture。`startedAt = lastTickAt = now`、`endAt = now + min*60000`、`totalMs = min*60000`、`overtime = false` | 同左(やり直し) | 同左(休憩を終える) |
| `startBreak(s, now, type, min)` | break。`breakType = type`、他は startLecture と同じ | 同左(超過も終わる) | 同左(種類を変えてやり直し) |
| `stopMain(s)` | 変化なし | idle。全部初期値 | idle |
| `adjustEnd(s, deltaMin, now)` | 無視 | `newEnd = floorToMinute(endAt + deltaMin*60000)`。`newEnd <= now` かつ `overtime` でないなら無視。採用時 `overtime = newEnd <= now` | 同左。break は `newEnd <= now` なら常に無視 |
| `tickMain(s, now)` | 変化なし、events 空 | 下記 | 下記 |

`tickMain` の判定(`prev = lastTickAt`、終了後 `lastTickAt = now`):

- `warning`: `t = endAt - warning*60000` が `prev < t <= now` かつ `t > startedAt` のとき。開始時点ですでに予鈴分以下なら鳴らない。`±` で `endAt` が動けば新しい `t` で再び判定する(延長後にもう一度鳴る)。
- `end`: `prev < endAt <= now` のとき。lecture では `overtime = true` にして継続。break では `break_end` も加え、`mode` は **そのまま break** にする(App が 1 秒後に `startLecture` を呼ぶ。この 1 秒間は `00:00` 表示)。
- `tick`: lecture の `overtime` 中、`floor((now - endAt) / (tick*1000)) > floor((prev - endAt) / (tick*1000))` かつ `now - endAt >= tick*1000` のとき。背景タブで複数回分飛んだ場合も 1 回だけ鳴らす。
- `remainingMain(s, now)`: idle → `null`、それ以外 → `endAt - now`(超過は負)。
- `floorToMinute(ms)`: ローカル時刻の秒・ミリ秒を 0 にする(`new Date(ms).setSeconds(0, 0)` 相当)。

## 演習タイマーの状態機械(Logic)

```js
// ExerciseState
{ phase: 'none' | 'setup' | 'running' | 'paused',
  title: '',
  setupMinutes: 15,
  startedAt: null, endAt: null, totalMs: 0,
  remainingMs: null,      // paused のときだけ。負なら超過中に止めた
  overtime: false,
  lastTickAt: null,
  next: { title: '', minutes: 15 },
  nextOpen: false }
```

| 操作 | 内容 |
|---|---|
| `exerciseOpenSetup(e, defaultMin)` | `phase = setup`、`setupMinutes = defaultMin`、`title = ''`。lecture 中で `phase = none` のときのみ呼ぶ(`canStartExercise(main, e)` が true) |
| `exerciseAdjustSetup(e, deltaMin)` | `setupMinutes` を 1〜120 にクランプ |
| `exerciseCancelSetup(e)` | `phase = none` |
| `exerciseStart(e, now, title, min, nextDefaultMin)` | `phase = running`、`title = title.trim() || '演習'`、`startedAt = lastTickAt = now`、`endAt = now + min*60000`、`totalMs`、`overtime = false`、`next = { title: '', minutes: nextDefaultMin }`、`nextOpen = false` |
| `exerciseStop(e)` | `phase = none`、残りは初期値 |
| `exerciseAdjust(e, deltaMin, now)` | `adjustEnd` と同じ規則(`floorToMinute`、超過中は過去も許す、採用時 `overtime = newEnd <= now`)。`paused` では `remainingMs += deltaMin*60000`(結果が 0 以下なら `overtime = true`) |
| `exercisePause(e, now)` | running → paused。`remainingMs = endAt - now`(負も保持) |
| `exerciseResume(e, now)` | paused → running。`endAt = now + remainingMs`、`lastTickAt = now`、`overtime = remainingMs <= 0` |
| `exerciseSetNext(e, title, minutes)` / `exerciseAdjustNext(e, deltaMin)` / `exerciseToggleNext(e, open)` | 次の演習の編集。分は 1〜120 |
| `tickExercise(e, now, warningMin, tickSec)` | `running` のみ。`warning` / `end` / `tick` は `tickMain` と同じ規則。`end` のとき `next.title.trim()` が空でなければ `exerciseStart(e, now, next.title, next.minutes, next.minutes)` を適用して events に `'next_started'` を加える(遅延なし)。空なら `overtime = true` で継続 |

`paused` / `setup` / `none` では events は常に空。

### 講義タイマーとの連動(App が担う順序)

| 講義側の操作 | 演習への影響 |
|---|---|
| 休憩開始(`startBreak`) | `setup` → `exerciseCancelSetup`。`running` → `exercisePause`。`paused` はそのまま |
| 講義開始(`startLecture`、休憩の自動終了・休憩中の「講義開始」どちらも) | `paused` → `exerciseResume` |
| 停止(`stopMain`) | `exerciseStop`(`paused` も含めて破棄) |
| 講義の超過突入 | 影響なし。演習は続く |

- `canStartExercise(main, e)`: `main.mode === 'lecture' && e.phase === 'none'`。
- 2 つのタイマーの音は互いに独立に鳴る。同じ tick で両方に events が出たら両方鳴らす(同種の音は 1 回)。
- 予鈴分前(`warning`)と経過音間隔(`tick`)は講義と演習で設定を共有する。

### 演習タイトル履歴(Logic)

- `addTitle(list, title)`: `title` が空または `'演習'` なら `list` をそのまま返す。重複を除いて先頭に入れ、20 件に切る。
- `exerciseStart` 時に App が呼び、`data.exerciseTitles` に保存して `<datalist id="exercise-titles">` を作り直す。

### 時刻の扱い(App)

- `now = Date.now()`。描画は 250 ms の `setInterval`。毎 tick で `tickMain` → `tickExercise` → render。`visibilitychange` 復帰時に即 tick。
- 講義・演習とも終了時刻ちょうどに `setTimeout` を 1 本ずつ張り(`endAt` が変わったときだけ張り直す)、背景タブでも終了音が遅れないようにする(k_timer と同じ)。
- 休憩の `break_end` を受けたら 1000 ms 後に `startLecture(settings.lecture)`。その間に利用者が別の操作をしたら(`mode` が break でなくなっていたら)自動開始しない。
- タイマー状態は localStorage に保存しない。リロードで idle。

## 書式(Logic)

- `formatClock(ms)`: 残り時間。`ms >= 0` は `ceil(ms/1000)` 秒を `MM:SS`(分は 2 桁以上、`300:00` も可)。負は `'+' + MM:SS`(`floor(-ms/1000)` 秒)。超過 1 秒未満は `00:00`。
- `formatMinutes(min)`: `MM:00`(設定パネル・次の演習の表示)。
- `formatEndAt(endAt)`: ローカル `HH:MM:SS`。null は `--:--:--`。
- `formatDateTimeLine(date, lang)`: ステータス帯(`2026-10-15 (木) 13:02:48` / `Thu, Oct 15, 2026 13:02:48`)。
- `progress(totalMs, remainingMs)`: 0〜100 の数値。`remainingMs <= 0` は 100。

## サウンド

- `<audio id="audio-warning">`、`<audio id="audio-end">`、`<audio id="audio-tick">`(`preload="auto"`、loop なし)。`src` は `SOUND_FILES = { 'sound1-1': 'audio/sound1-1.wav', …, 'sound3-3': 'audio/sound3-3.wav' }` から `settings.sound1/2/3` で選ぶ(辞書にないキーは既定へ)。
- 再生: `currentTime = 0; volume = settings.volume/100; play()`。`muted` が true または `volume` が 0 なら鳴らさない。
- 講義開始・休憩開始(ボタン押下)でミュートを自動解除する(元実装どおり)。演習開始では解除しない。
- 自動再生制限の解除: 講義開始・休憩開始・演習開始ボタンの capture フェーズで 3 要素を `muted` で `play()` → `pause()`(k_timer と同じ)。
- 失敗時: `AbortError` は無視。`NotAllowedError` とそれ以外の reject、`error` イベントは、ステータス赤 `error_audio` と Web Audio API の 880 Hz 0.2 秒ビープ 1 回で代替(`AudioContext` は開始ボタン押下時に生成)。
- 試聴ボタン(設定 → 音): 選択中の音を 1 回再生。もう一度押すか選択変更で停止。

## エディタ(`#editor-pane`)

### 文書モデル(Logic)

```js
// Document
{ id: 'doc_1760500000000', title: '第 3 回 講義メモ', blocks: [...], createdAt: iso, updatedAt: iso }
// Block
{ type: 'p' | 'h' | 'li', runs: [ { text: 'ここは', bold: false }, { text: '重要', bold: true } ] }
// Draft
{ documentId: null | id, blocks: [...], updatedAt: iso }
```

- `normalizeBlocks(value)`: 任意の値を上の形に正規化する(未知の type は `p`、runs でない要素は捨てる、`text` は文字列化、`bold` は boolean 化、空の runs は `[{text:'', bold:false}]`)。壊れた保存データでも落ちない。
- `blocksToPlainText(blocks)`: 行ごとの文字列。タイトル既定値の抽出(`firstLine(blocks, 50)`: 最初の空でない行を 50 文字まで。なければ `Untitled - YYYY-MM-DD HH:MM`)に使う。
- `importLegacyHtml(html)`: 旧 Quill 文書の `content.html` を blocks に落とす。簡易トークナイザで、`<h1>`〜`<h3>` → `h`、`<li>` → `li`、`<p>`/`<div>`/`<br>` → 段落区切り、`<strong>`/`<b>` の内側を `bold`、その他のタグは捨て、文字実体参照(`&amp; &lt; &gt; &quot; &#39; &nbsp;` と数値参照)を復号する。DOM は使わない。
- `parseLegacyExport(obj)`: 旧 l_timer のエクスポート JSON(`version: "1.0"`、`settings.timerSettings`、`documents.documents[]`)を `{ settings, documents }` に変換する。

| 旧キー | 新キー |
|---|---|
| `lectureTime` / `break1Time` / `break2Time` | `lecture` / `break1` / `break2` |
| `warningTime` / `tickInterval` | `warning` / `tick` |
| `defaultExerciseTime` / `defaultNextExerciseTime` | `exercise` / `nextExercise` |
| `volume`(0〜1) | `volume`(0〜100、四捨五入) |
| `isMuted` | `muted` |
| `sound1Src` `audio/sound1-2.wav` | `sound1` `sound1-2`(辞書にないものは捨てる) |
| `timerTheme` | `theme` |
| `editorSettings.zoomLevel`(50〜200) | `editorZoom`(50 → 75、125 → 100、それ以外は同じ値。段階にないものは既定) |
| 文書 `{ id, title, content: { html }, createdAt, updatedAt }` | `{ id, title, blocks: importLegacyHtml(html), createdAt, updatedAt }` |

### 編集 UI(App)

- `#editor` は `contenteditable="true"` の `<div>`。ツールバー `.editor-tools` に **B**(太字)、**•**(箇条書き)、**H**(見出し)の 3 ボタン。`document.execCommand('bold' | 'insertUnorderedList' | 'formatBlock')` で操作し、見出しは `H2` と `P` のトグル。選択位置の状態に応じて `aria-pressed` を更新する。
- 貼り付けは `paste` を横取りしてプレーンテキストを `insertText` する。ドロップも同様。
- **DOM → blocks**(`readBlocks()`): `#editor` 直下を走査し、`H1〜H6` → `h`、`UL/OL > LI` → `li`、それ以外のブロック → `p`。インラインは `STRONG`/`B`/`font-weight >= 600` を bold とし、テキストノードを runs に積む。`BR` は段落区切り。
- **blocks → DOM**(`renderBlocks()`): `createElement` と `textContent` だけで `p` / `h2` / `ul>li`(連続する `li` を 1 つの `ul` に)、bold は `strong`。`innerHTML` は使わない。読み込み・文書切替・リロード時だけ呼ぶ(入力中は呼ばない。キャレットを保つため)。
- 入力(`input`)ごとに `readBlocks()` → 下書き保存(500 ms デバウンス)。`hasUnsavedChanges` は「下書きの blocks と保存済み文書の blocks の JSON が異なる」で判定する。
- 文書操作(`.editor-docs`): `<select id="doc-select">`(先頭は「新規文書」、以下更新日時の新しい順)、保存 💾、削除 🗑(選択中のみ有効)。
  - 保存: ダイアログでタイトルを求める(初期値は現在の文書タイトル、なければ `firstLine`)。選択中の文書と同じタイトルなら上書き、違えば新規文書として追加(元実装の最新仕様)。保存後 2 秒間ボタンを ✓ 緑にする。
  - 切替・新規: 未保存の変更があればダイアログで確認。
  - 削除: ダイアログで確認。
- **ダイアログ**(`#dialog`): メッセージ、任意の入力欄、OK / キャンセル の固定サイズモーダル。設定モーダルと同じ見た目。`prompt` / `confirm` / `alert` は使わない(データタブの全消去だけ共通どおり `confirm`)。
- **エディタ拡縮**: ツールバー右端に `−` / `100%` / `+`。段階は 75 / 100 / 150 / 200 / 300 / 400(%)。縮小は 75 の 1 段だけ、拡大側を厚くする。設定 `editorZoom` に保存し、`#editor` の `font-size` を `calc(var(--fs-base) * var(--zoom) * var(--editor-zoom))` とする。共通の `--zoom`(ツールバーの拡大縮小)はタイマーとエディタの両方に、`--editor-zoom` はエディタ本文だけに掛かる。ツールバー・文書操作欄の大きさは `--editor-zoom` の影響を受けない。
- 表示切替はツールバーの `#btn-editor`。非表示にしても下書きは保持する。

### 保存(App)

- `simplePages.l_timer.data` に `{ version: 1, documents: [], draft: null, exerciseTitles: [] }`。文書・下書き・履歴の変更ごとに書く。読込時は `normalizeBlocks` で各文書と下書きを正規化し、`draft.documentId` が存在しない文書を指していたら `null` にする。
- 起動時: `draft` があればその blocks を表示し、`documentId` を選択。なければ空の新規文書。
- `localStorage` が使えない環境では文書機能はメモリ上だけで動き、保存ボタン押下時にステータス帯へ `error_storage`(黄)を出す。

## 設定項目

localStorage キー `simplePages.l_timer`、`version: 1`。

| キー | 型 | 既定 | URL | 説明 |
|---|---|---|---|---|
| `theme` | enum auto/light/dark | auto | `theme=dark` | 共通 |
| `lang` | enum ja/en | 検出 | `lang=en` | 共通 |
| `zoom` | int 50〜200 | 100 | `zoom=120` | 共通 |
| `lecture` | int 1〜300 | 50 | `lecture=90` | 講義時間(分) |
| `break1` | int 1〜120 | 10 | `break1=15` | 休憩時間(分) |
| `break2` | int 1〜120 | 60 | `break2=45` | 昼休憩時間(分) |
| `warning` | int 1〜10 | 3 | `warning=5` | 予鈴(終了の何分前) |
| `tick` | int 10〜300(step 10) | 60 | `tick=30` | 超過中の経過音間隔(秒) |
| `exercise` | int 1〜120 | 15 | `exercise=20` | 演習時間の既定(分) |
| `nextExercise` | int 1〜120 | 15 | `nextExercise=10` | 次の演習時間の既定(分) |
| `sound1` | enum sound1-1/1-2/1-3 | sound1-1 | `sound1=sound1-2` | 予鈴音 |
| `sound2` | enum sound2-1/2-2/2-3 | sound2-1 | `sound2=sound2-3` | 終了音 |
| `sound3` | enum sound3-1/3-2/3-3 | sound3-1 | `sound3=sound3-2` | 経過音 |
| `volume` | int 0〜100 | 50 | `volume=70` | 音量 |
| `muted` | bool | false | `muted=1` | ミュート |
| `editor` | bool | false | `editor=1` | エディタを表示 |
| `editorWidth` | int 30〜70 | 50 | `editorWidth=40` | タイマー列の幅(%) |
| `editorZoom` | enum 75/100/150/200/300/400 | 100 | `editorZoom=150` | エディタ本文の拡大率(%) |

- 全キーが表示専用なので `DISPLAY_ONLY_KEYS` に全部入れる。`?save=1` で URL の値を保存(共通)。
- 設定モーダルのタブ: **表示 / タイマー / 音 / データ / About**(更新間隔がないため一般タブは置かない。k_timer と同じ)。
  - 表示: エディタを表示(checkbox)、タイマー列の幅(number 30〜70)、エディタ本文の拡大率(select)。共通のテーマ・拡大率・言語。
  - タイマー: 7 項目を **2 列グリッド**(ラベル + number)でスクロールなしに収める。並びは 講義 / 休憩、昼休憩 / 予鈴、超過通知間隔 / 演習、次の演習。
  - 音: 音量(range + 数値)、ミュート(checkbox)、予鈴音・終了音・経過音(select + 試聴)。
  - データ: 共通のエクスポート/インポート(ファイルとテキストエリア)。エクスポート JSON は `{ version: 1, settings, data }`。インポートは `settings` を置き換え、`data.documents` は **追加**(id が衝突したら新しい id を振る)、`data.exerciseTitles` は結合して 20 件。旧 l_timer 形式(`parseLegacyExport` が認識)も同じ扱い。全消去は `simplePages.l_timer` と `simplePages.l_timer.data` の両方を消す。
  - About: 説明、GitHub、MIT、クレジット(`ABOUT.credits`: 「予鈴音 sound1-1 / 終了音 sound2-1 / 経過音 sound3-1: mixkit.co(Mixkit License)」)。
- 設定変更は即時反映: 講義時間は idle の表示に、休憩時間はツールチップに、音の選択は `<audio>` の `src` に、エディタ関連は表示に。

## CSS 変数(ページ固有)

`--c-lecture`(青)、`--c-break`(緑)、`--c-overtime`(赤)、`--c-exercise`(橙)をライト/ダークで定義。`--fs-timer`、`--fs-timer-small = calc(var(--fs-timer) * 0.5)`、`--left-width`(リサイザが更新)、`--editor-zoom`(`editorZoom / 100`)。ボタン類は共通の `--gap`、`--fs-base`、`--radius` を使う。円形アイコンボタンは `calc(60px * var(--zoom))`、700px 未満では 48px。

## エラー処理

- 音声読込失敗: ステータス赤 + ビープ代替。タイマーは動き続ける。
- `localStorage` 不可: 設定は既定値、文書はメモリのみ(上記)。
- 保存データの破損: `normalizeBlocks` と共通の設定正規化で既定に戻す。例外で止まらない。

## Logic(純粋関数、テスト対象)

共通の `resolveSettings` 等に加えて:

- 定数: `SOUND_FILES`、`LIMITS`(各設定の範囲)、`ADJUST_STEPS = [-10, -1, 1, 10]`、`MAX_TITLES = 20`
- 講義: `initialMain()`、`startLecture`、`startBreak`、`stopMain`、`adjustEnd`、`tickMain`、`remainingMain`、`floorToMinute`
- 演習: `initialExercise(defaultMin, nextDefaultMin)`、`exerciseOpenSetup`、`exerciseAdjustSetup`、`exerciseCancelSetup`、`exerciseStart`、`exerciseStop`、`exerciseAdjust`、`exercisePause`、`exerciseResume`、`exerciseSetNext`、`exerciseAdjustNext`、`exerciseToggleNext`、`tickExercise`、`canStartExercise`
- 表示: `pageTitleKey(main)`、`buttonVisibility(main, e)`(ボタン id → boolean)、`stepEditorZoom(level, dir)`(段階の前後へ、端で止まる)、`formatClock`、`formatMinutes`、`formatEndAt`、`formatDateTimeLine`、`progress`
- データ: `addTitle`、`normalizeBlocks`、`blocksToPlainText`、`firstLine`、`importLegacyHtml`、`parseLegacyExport`、`mergeImport(data, incoming)`

## テスト(`l_timer/test/`)

- `load-logic.mjs`(`TZ=Asia/Tokyo`)。
- `main.test.mjs`: 状態表の各セル。予鈴が `prev < t <= now` で 1 回だけ鳴る、開始時点で予鈴分以下なら鳴らない、`+10` の後にもう一度鳴る、休憩でも鳴る。`end` で lecture は `overtime`、break は `break_end`。背景タブ想定(prev から 5 分飛ぶ)で `end` と `tick` がそれぞれ 1 回。`adjustEnd` の分丸めと過去拒否、超過中の `+` で復帰。
- `exercise.test.mjs`: setup → running → end → `next_started`(次の演習あり)/ overtime(なし)。`pause` が残りを保持し `resume` で `endAt = now + remainingMs`、超過中に止めた場合は再開後も超過。`paused` 中は events 空。`exerciseAdjust` の paused 分岐。`canStartExercise`。`buttonVisibility` の各状態(演習中も講義側ボタンが出る)。
- `format.test.mjs`: `formatClock`(0、999 → `00:01`、3000000 → `50:00`、18000000 → `300:00`、-500 → `00:00`、-1500 → `+00:01`)、`formatEndAt`、`formatDateTimeLine` ja/en、`progress`(0 / 50 / 100 / 超過 100)、`stepEditorZoom`(100→150、400→400、75→75)。
- `documents.test.mjs`: `normalizeBlocks`(壊れた入力 7 種)、`firstLine`、`addTitle`(重複・20 件・`'演習'` 除外)、`importLegacyHtml`(段落・見出し・箇条書き・strong・実体参照・未知タグ・ネスト)、`parseLegacyExport`(旧 JSON 固定サンプルを `test/fixtures/legacy-export.json` に置く。音 src の変換、volume の換算、不正キーの除外)、`mergeImport`(id 衝突、履歴結合)。
- `settings.test.mjs`: スキーマの範囲外・型変換、`DISPLAY_ONLY_KEYS` が全キーを含む、i18n キー網羅(index.html 内の `data-i18n*` と `Logic.t(…)` の全キーが ja/en にある)、`page_title` 系キーと `exercise_paused` の存在。
- `audio.test.mjs`: `SOUND_FILES` の 9 パスが `l_timer/` 配下に存在し、先頭 4 バイトが `RIFF`。
- `node --test l_timer/test/*.test.mjs`。ネットワーク不要。

## 手動確認

- 講義開始 → `49:59` から減り「終了 HH:MM:SS」が出る。3 分前に予鈴、0 で終了音、以後 `+00:01…` と 60 秒ごとに経過音
- 休憩開始 → 緑。3 分前に予鈴、0 で終了音、1 秒後に自動で講義開始
- 講義中に演習 → タイトルを入れて開始。講義タイマーが小さく薄くなる。演習の予鈴・終了音が鳴り、次の演習を設定していれば自動で切り替わる
- 演習中に休憩開始 → 演習が「一時停止中」で止まり、休憩明けに同じ残りから再開する。休憩中に停止を押すと演習も消える
- 演習中でも講義側の休憩・停止ボタンが押せる
- `±` で終了時刻の秒が 00 になる。超過中に `+1` で通常カウントに戻る
- ミュート、エディタ切替が共通ボタンの左に並び、10 秒で一緒に減光する
- エディタで太字・箇条書き・見出し。リロードで下書きが戻る。保存・切替・削除。貼り付けがプレーンテキストになる
- エディタの `−` / `+` で本文だけが拡縮し、ツールバーの拡大縮小ではタイマーとエディタの両方が拡縮する
- リサイザのドラッグで幅が変わり、タイマー文字が追従する。ダブルクリックで 50%
- 旧 l_timer のエクスポート JSON をデータタブから取り込むと設定と文書が入る
- 幅 700px 未満でエディタが下に積まれる。ダーク/ライト、拡縮、日英で崩れない
- `audio/` を一時的にリネームするとステータスが赤になり、ビープで鳴る

## 範囲外

- キーボードショートカット
- 旧 localStorage キーからの自動取り込み(インポート経由のみ)
- エディタの斜体・下線・色・揃え・番号付きリスト・文字サイズ、画像
- Buy Me a Coffee、タイマー状態の保存・復元、通知 API
