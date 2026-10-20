# l_timer

講義用タイマー。講義(既定 50 分)と休憩(10 分 / 60 分)を繰り返し、予鈴・終了音・超過中の経過音で区切りを知らせる。講義中は演習タイマーを重ねて動かせ、右側のエディタに講義メモを書ける。`index.html` と `audio/` だけで動く。

元は単体アプリ <https://github.com/ytx/l_timer>。機能を引き継ぎ、simplePages の規約(1 ファイル、共通ツールバー、設定の保存形式)に合わせて作り直した。

## 機能

- 講義開始 / 休憩開始(2 種類) / 停止。講義は 0 で終了音を鳴らし `+MM:SS` で超過を続け、超過中は一定間隔で経過音。休憩は 0 で終了音、1 秒後に自動で講義開始
- 予鈴: 講義・休憩・演習すべてで終了 N 分前(既定 3 分)
- 終了時刻の調整 `-10 / -1 / +1 / +10`(分)。秒は 00 に丸める。過去にはできない(超過中だけ可)
- 演習タイマー: 講義中(超過中も)に起動できる独立タイマー。タイトル入力(履歴 20 件を候補表示)、分の調整、終了時刻の調整、次の演習の事前設定(複数をキューに追加可、タイマーの右の独立カラムに表示)と自動開始。演習中は講義タイマーを小さく表示し、休憩で演習が一時停止している間は逆に演習側を小さく表示
- 休憩開始で演習を一時停止し、講義再開で同じ残りから再開。停止で演習も終了
- エディタ: 太字・箇条書き・見出しの 3 書式。複数文書の保存・切替・削除、下書きの自動保存、貼り付けはプレーンテキスト。本文だけの拡大 75〜400 %。タイマーとの境界をドラッグして幅を変更
- 音 3 種 × 3 バリエーション、音量、ミュート(講義・休憩開始で自動解除)、試聴
- 右上のアイコンで ミュート、エディタ表示、ダーク/ライト、拡大/縮小、フルスクリーン、日英。設定は歯車
- 幅 700px 未満ではエディタをタイマーの下に積む

## 設定項目

| キー | 型/範囲 | 既定 | 説明 |
|---|---|---|---|
| `lecture` | 整数 1〜300 | 50 | 講義時間(分) |
| `break1` / `break2` | 整数 1〜120 | 10 / 60 | 休憩 / 昼休憩(分) |
| `warning` | 整数 1〜10 | 3 | 予鈴(終了の何分前) |
| `tick` | 整数 10〜300 | 60 | 超過中の経過音の間隔(秒) |
| `exercise` / `nextExercise` | 整数 1〜120 | 15 / 15 | 演習 / 次の演習の既定(分) |
| `sound1` / `sound2` / `sound3` | `soundN-1` 〜 `soundN-3` | `-1` | 予鈴音 / 終了音 / 経過音 |
| `volume` | 整数 0〜100 | 50 | 音量 |
| `muted` | 真偽 | false | ミュート |
| `editor` | 真偽 | false | エディタを表示 |
| `editorWidth` | 整数 30〜70 | 50 | タイマー列の幅(%) |
| `editorZoom` | 75 / 100 / 150 / 200 / 300 / 400 | 100 | エディタ本文の拡大率(%) |
| `lang` / `theme` / `zoom` | 共通 | 共通 | 言語 / テーマ / 拡大率(共通設定) |

## URL パラメータ

設定キーと同名のパラメータで指定できる(`?lecture=90&break1=15&warning=5&sound2=sound2-3&editor=1`)。`save=1` を付けると localStorage に保存する。真偽は `1`/`0`、`true`/`false`。範囲外の値は無視される(保存値があればそれ、なければ既定値になる)。

タイマーの状態は保存しない。再読込すると停止状態に戻る。文書と下書きは保存する。

## データの保存形式

localStorage キー `simplePages.l_timer`(設定):

```json
{ "version": 1, "settings": { "lang": "ja", "theme": "auto", "zoom": 100, "lecture": 50, "break1": 10, "break2": 60,
  "warning": 3, "tick": 60, "exercise": 15, "nextExercise": 15, "sound1": "sound1-1", "sound2": "sound2-1", "sound3": "sound3-1",
  "volume": 50, "muted": false, "editor": false, "editorWidth": 50, "editorZoom": 100 } }
```

localStorage キー `simplePages.l_timer.data`(文書・下書き・演習タイトル履歴):

```json
{ "version": 1,
  "documents": [ { "id": "doc_1760500000000", "title": "第 3 回", "blocks": [ { "type": "h", "runs": [ { "text": "見出し", "bold": false } ] },
    { "type": "p", "runs": [ { "text": "本文 ", "bold": false }, { "text": "強調", "bold": true } ] }, { "type": "li", "runs": [ { "text": "項目", "bold": false } ] } ],
    "createdAt": "2026-10-15T04:00:00.000Z", "updatedAt": "2026-10-15T04:10:00.000Z" } ],
  "draft": { "documentId": "doc_1760500000000", "blocks": [], "updatedAt": "2026-10-15T04:12:00.000Z" },
  "exerciseTitles": [ "演習 2", "演習 1" ] }
```

文書はブロック(`p` 段落 / `h` 見出し / `li` 箇条書き)と run(`text`, `bold`)の JSON で持ち、HTML は保存しない。

データタブの書き出しは `{ "version": 1, "settings": …, "data": … }`。読み込みは設定を置き換え、文書は追加(id が重なれば改名)、履歴は結合する。旧 l_timer の書き出し JSON(`version: "1.0"`、`settings.timerSettings`、`documents.documents[]`)も読み込め、Quill の HTML は太字・箇条書き・見出しだけ残して取り込む。

## 書体

残り時間・終了時刻・演習タイマーの数字と、エディタの拡大率表示には Courier Prime(The Courier Prime Project Authors、SIL Open Font License 1.1)の Regular を `fonts/courier-prime/CourierPrime-Regular-latin.woff2`(Google Fonts の latin 分割、11 KB)として同梱し、CSS 変数 `--font-num` で当てている(Courier Prime にない文字、たとえば「終了」は `--font` に落ちる)。太字は使わない。ライセンス全文は同ディレクトリの `OFL.txt`。他の文字は Zen Maru Gothic(The Zen Maru Gothic Project Authors、SIL Open Font License 1.1)の Regular を `fonts/zen-maru-gothic/`(Google Fonts の unicode-range 分割 woff2 122 本、合計 2.2 MB。midsleep と同じもの)として同梱し、`--font` の先頭に置いている。ライセンス全文は同ディレクトリの `OFL.txt`。

## 音声

`audio/sound1-1.wav`(予鈴、mixkit.co `mixkit-correct-answer-tone-2870`)、`sound2-1.wav`(終了、`mixkit-happy-bells-notification-937`)、`sound3-1.wav`(経過、`mixkit-access-allowed-tone-2869`)は Mixkit License。他の 6 本は生成音。読み込めないときはステータスが赤になり、Web Audio の 880 Hz ビープで代替する。

iOS Safari は `<audio>` の音量変更を受け付けないため、音量設定はビープ代替にのみ効く。ブラウザの自動再生制限のため、音は開始ボタンを押した(ユーザー操作があった)あとにだけ鳴る。

## テスト

```bash
node --test l_timer/test/*.test.mjs
```

## 手動確認

- 講義開始 → `49:59` から減り「終了 HH:MM:SS」。3 分前に予鈴、0 で終了音と赤い `+00:01…`、60 秒ごとに経過音
- 休憩開始 → 緑。3 分前に予鈴、0 で終了音、1 秒後に自動で講義開始
- 講義中に演習 → タイトルを入れて開始。講義タイマーが小さくなる。次の演習を設定しておくと終了時に自動で切り替わり、「+ 追加」で 2 件目以降もキューに入れておける(先頭から順に開始、先頭のタイトルが空なら超過に入る)
- 演習中に休憩開始 → 「一時停止中」で止まり、休憩明けに同じ残りから再開。休憩中に停止を押すと演習も消える
- `±` で終了時刻の秒が 00 になる。超過中に `+1` で通常カウントに戻る
- エディタで太字・箇条書き・見出し。リロードで下書きが戻る。保存・切替・削除。貼り付けがプレーンテキスト。`−`/`+` で本文だけ拡縮
- リサイザのドラッグで幅が変わりタイマー文字が追従。ダブルクリックで 50 %
- 旧 l_timer の書き出し JSON をデータタブから取り込むと設定と文書が入る
- 幅 700px 未満でエディタが下に積まれる。ダーク/ライト、拡縮、日英で崩れない
- `audio/` を一時的にリネームするとステータスが赤、ビープで鳴る
