import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const html = fileURLToPath(new URL('../index.html', import.meta.url));
const Logic = loadLogic(html);
const src = readFileSync(html, 'utf8');
const ui = src.match(/<script id="app-ui">([\s\S]*?)<\/script>/)[1];

test('Logic exposes the shared helpers and the page constants', () => {
  assert.equal(Logic.VERSION, 1);
  assert.equal(Logic.DATA_VERSION, 1);
  assert.equal(typeof Logic.resolveSettings, 'function');
  assert.deepEqual(Object.keys(Logic.SOUND_FILES), ['sound1-1', 'sound1-2', 'sound1-3', 'sound2-1', 'sound2-2', 'sound2-3', 'sound3-1', 'sound3-2', 'sound3-3']);
  for (const [k, p] of Object.entries(Logic.SOUND_FILES)) assert.equal(p, `audio/${k}.wav`);
  assert.deepEqual(Logic.SOUND_GROUPS, {
    sound1: ['sound1-1', 'sound1-2', 'sound1-3'],
    sound2: ['sound2-1', 'sound2-2', 'sound2-3'],
    sound3: ['sound3-1', 'sound3-2', 'sound3-3'],
  });
  assert.deepEqual(Logic.EDITOR_ZOOM_LEVELS, [75, 100, 150, 200, 300, 400]);
  assert.equal(Logic.handAngles, undefined, 'k_timer leftovers removed');
  assert.equal(Logic.initialState, undefined, 'k_timer leftovers removed');
});

test('SCHEMA has every key from the spec with the spec defaults', () => {
  assert.match(ui, /const PAGE = 'l_timer'/);
  assert.match(ui, /lecture: \{ type: 'int', min: 1, max: 300, default: 50 \}/);
  assert.match(ui, /break1: \{ type: 'int', min: 1, max: 120, default: 10 \}/);
  assert.match(ui, /break2: \{ type: 'int', min: 1, max: 120, default: 60 \}/);
  assert.match(ui, /warning: \{ type: 'int', min: 1, max: 10, default: 3 \}/);
  assert.match(ui, /tick: \{ type: 'int', min: 10, max: 300, default: 60 \}/);
  assert.match(ui, /exercise: \{ type: 'int', min: 1, max: 120, default: 15 \}/);
  assert.match(ui, /nextExercise: \{ type: 'int', min: 1, max: 120, default: 15 \}/);
  assert.match(ui, /sound1: \{ type: 'enum', values: Logic\.SOUND_GROUPS\.sound1, default: 'sound1-1' \}/);
  assert.match(ui, /sound2: \{ type: 'enum', values: Logic\.SOUND_GROUPS\.sound2, default: 'sound2-1' \}/);
  assert.match(ui, /sound3: \{ type: 'enum', values: Logic\.SOUND_GROUPS\.sound3, default: 'sound3-1' \}/);
  assert.match(ui, /volume: \{ type: 'int', min: 0, max: 100, default: 50 \}/);
  assert.match(ui, /muted: \{ type: 'bool', default: false \}/);
  assert.match(ui, /editor: \{ type: 'bool', default: false \}/);
  assert.match(ui, /editorWidth: \{ type: 'int', min: 30, max: 70, default: 50 \}/);
  assert.match(ui, /editorZoom: \{ type: 'enum', values: Logic\.EDITOR_ZOOM_LEVELS, default: 100 \}/);
  assert.doesNotMatch(ui, /preset1|fetchJson|scheduleRefresh|refreshMinutes/);
});

test('DISPLAY_ONLY_KEYS lists every schema key', () => {
  assert.match(ui, /DISPLAY_ONLY_KEYS = new Set\(\['theme', 'zoom', 'lang', 'lecture', 'break1', 'break2', 'warning', 'tick', 'exercise', 'nextExercise', 'sound1', 'sound2', 'sound3', 'volume', 'muted', 'editor', 'editorWidth', 'editorZoom'\]\)/);
});

test('ABOUT names the page and credits the sounds', () => {
  assert.match(ui, /page: 'l_timer'/);
  assert.match(ui, /https:\/\/mixkit\.co\//);
  assert.doesNotMatch(src, /buymeacoffee|Quill|quill/);
});

test('settings schema coerces as the spec says', () => {
  const schema = {
    lecture: { type: 'int', min: 1, max: 300, default: 50 },
    editorZoom: { type: 'enum', values: Logic.EDITOR_ZOOM_LEVELS, default: 100 },
    muted: { type: 'bool', default: false },
  };
  assert.equal(Logic.resolveSettings(schema, {}, { lecture: '90' }).lecture, 90);
  assert.equal(Logic.resolveSettings(schema, {}, { lecture: '0' }).lecture, 50);
  assert.equal(Logic.resolveSettings(schema, {}, { editorZoom: '300' }).editorZoom, 300);
  assert.equal(Logic.resolveSettings(schema, {}, { editorZoom: '125' }).editorZoom, 100);
  assert.equal(Logic.resolveSettings(schema, {}, { muted: '1' }).muted, true);
  assert.equal(Logic.resolveSettings(schema, {}, { muted: 'yes' }).muted, false);
});

test('page markup: no external resources, no innerHTML, no keyboard shortcuts', () => {
  assert.doesNotMatch(src, /<link\s/);
  assert.doesNotMatch(src, /<script[^>]*\ssrc=/);
  assert.doesNotMatch(src, /fonts\.googleapis|material-icons/i);
  assert.doesNotMatch(src, /innerHTML/);
  assert.doesNotMatch(src, /\bprompt\(|\balert\(/);
  assert.equal((src.match(/\bconfirm\(/g) || []).length, 1, 'confirm only for clear-all');
});

test('page markup has the toolbar page buttons, the panes, the dialog and the audio elements', () => {
  const order = src.indexOf('id="btn-mute"') < src.indexOf('id="btn-editor"') && src.indexOf('id="btn-editor"') < src.indexOf('id="btn-theme"');
  assert.ok(order, 'mute and editor buttons come before the shared buttons');
  for (const id of ['timer-pane', 'timer-stack', 'exercise-area', 'exercise-setup', 'exercise-running', 'main-remaining', 'main-progress-fill', 'main-end-time',
    'btn-lecture', 'btn-lecture-from-break', 'btn-break1', 'btn-break2', 'btn-stop', 'btn-exercise',
    'ex-title-input', 'ex-setup-time', 'ex-setup-ok', 'ex-setup-cancel', 'ex-title', 'ex-paused', 'ex-remaining', 'ex-progress-fill', 'ex-end-time', 'ex-stop',
    'ex-next-open', 'ex-next-panel', 'ex-next-list', 'ex-next-add', 'ex-next-close', 'exercise-titles',
    'resizer', 'editor-pane', 'ed-bold', 'ed-list', 'ed-heading', 'ed-zoom-out', 'ed-zoom-in', 'ed-zoom-level', 'editor', 'doc-select', 'doc-save', 'doc-delete',
    'audio-warning', 'audio-end', 'audio-tick', 'dialog', 'dialog-message', 'dialog-input', 'dialog-ok', 'dialog-cancel']) {
    assert.ok(src.includes(`id="${id}"`), id);
  }
  assert.match(src, /<main id="content">\s*<h1 id="page-title"/);
  assert.doesNotMatch(src, /id="clock"|hand-second/);
  for (const tab of ['display', 'timer', 'sound', 'data', 'about']) assert.ok(src.includes(`data-tab="${tab}"`), tab);
  assert.doesNotMatch(src, /data-tab="general"/);
  // exercise end time and ± share one row like the main timer; Next is an icon button; the shrunken main countdown keeps full opacity
  assert.match(src, /<div class="end-row"><span id="ex-end-time"><\/span>\s*<div class="adj">\s*<button type="button" class="tbtn ex-adj"/);
  assert.match(src, /<button id="ex-next-open" class="cbtn exercise"[^>]*><svg aria-hidden="true"><use href="#icon-arrow-right">/);
  assert.match(src, /<button id="ex-stop" class="cbtn stop"/);
  // the next-exercise panel is its own column beside the timer stack, not inside the exercise area
  const stackEnd = src.indexOf('id="btn-exercise"');
  const panel = src.indexOf('id="ex-next-panel"');
  assert.ok(stackEnd > 0 && panel > stackEnd, 'next panel follows the timer stack');
  assert.ok(src.indexOf('id="exercise-area"') > src.indexOf('id="timer-stack"'), 'exercise area sits inside the timer stack');
  // ± buttons use a real minus sign
  assert.equal((src.match(/data-delta="-10">−10<\/button>/g) || []).length, 3);
  assert.doesNotMatch(src, /data-delta="-1">-1</);
  assert.match(src, /<symbol id="icon-arrow-right"/);
  assert.doesNotMatch(src, /#timer-pane\.exercise-active #main-remaining \{[^}]*opacity/);
  assert.match(src, /#timer-pane\.exercise-paused #ex-remaining \{ font-size: var\(--fs-timer-small\)/);
  for (const key of ['lecture', 'break1', 'break2', 'warning', 'tick', 'exercise', 'nextExercise', 'sound1', 'sound2', 'sound3', 'volume', 'muted', 'editor', 'editorWidth', 'editorZoom', 'lang', 'theme']) {
    assert.ok(src.includes(`data-setting="${key}"`), `data-setting ${key}`);
  }
  assert.equal((src.match(/class="btn preview"/g) || []).length, 3);
});

test('every i18n key used in index.html exists in both languages', () => {
  const keys = new Set();
  for (const re of [/data-i18n(?:-label|-placeholder)?="([^"]+)"/g, /Logic\.t\(\s*settings\.lang\s*,\s*'([^']+)'/g, /\bt\(\s*lang\s*,\s*'([^']+)'/g]) {
    for (const m of src.matchAll(re)) keys.add(m[1]);
  }
  assert.ok(keys.size > 40);
  for (const k of keys) for (const lang of ['ja', 'en']) assert.equal(typeof Logic.I18N[lang][k], 'string', `${lang} missing ${k}`);
  for (const k of ['title_idle', 'title_lecture', 'title_overtime', 'title_break', 'exercise_paused', 'start_break', 'error_audio', 'error_storage',
    'sound1_1', 'sound1_2', 'sound1_3', 'sound2_1', 'sound2_2', 'sound2_3', 'sound3_1', 'sound3_2', 'sound3_3',
    'doc_title_prompt', 'doc_unsaved_confirm', 'doc_delete_confirm', 'ok', 'cancel', 'untitled']) {
    assert.equal(typeof Logic.I18N.ja[k], 'string', `ja.${k}`);
    assert.equal(typeof Logic.I18N.en[k], 'string', `en.${k}`);
  }
  assert.equal(Logic.I18N.ja.page_title, undefined);
  assert.equal(Logic.I18N.ja.preset1, undefined);
});

test('formatDateTimeLine shows date, weekday and time', () => {
  const d = new Date(2026, 9, 15, 13, 2, 48);
  assert.equal(Logic.formatDateTimeLine(d, 'ja'), '2026-10-15 (木) 13:02:48');
  assert.equal(Logic.formatDateTimeLine(d, 'en'), 'Thu, Oct 15, 2026 13:02:48');
});
