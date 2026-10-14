import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const html = fileURLToPath(new URL('../index.html', import.meta.url));
const Logic = loadLogic(html);
const src = readFileSync(html, 'utf8');
const ui = src.match(/<script id="app-ui">([\s\S]*?)<\/script>/)[1];

test('Logic exposes the shared helpers and the timer constants', () => {
  assert.equal(Logic.VERSION, 1);
  assert.equal(typeof Logic.resolveSettings, 'function');
  assert.equal(Logic.MAX_MS, 180 * 60000);
  assert.deepEqual(Logic.ADJUST_STEPS, [-600000, -60000, -30000, 30000, 60000, 600000]);
  assert.deepEqual(Object.keys(Logic.SOUND_FILES), ['sound2-1', 'sound2-2', 'sound2-3']);
  for (const p of Object.values(Logic.SOUND_FILES)) assert.match(p, /^audio\/sound2-[123]\.wav$/);
});

test('SCHEMA has every key from the spec with the spec defaults', () => {
  assert.match(ui, /const PAGE = 'k_timer'/);
  assert.match(ui, /preset1: \{ type: 'int', min: 1, max: 180, default: 3 \}/);
  assert.match(ui, /preset2: \{ type: 'int', min: 1, max: 180, default: 5 \}/);
  assert.match(ui, /preset3: \{ type: 'int', min: 1, max: 180, default: 12 \}/);
  assert.match(ui, /sound: \{ type: 'enum', values: Object\.keys\(Logic\.SOUND_FILES\), default: 'sound2-1' \}/);
  assert.match(ui, /volume: \{ type: 'int', min: 0, max: 100, default: 80 \}/);
  assert.match(ui, /flash: \{ type: 'bool', default: true \}/);
  assert.match(ui, /seconds: \{ type: 'bool', default: true \}/);
  assert.doesNotMatch(ui, /refreshMinutes/);
  assert.doesNotMatch(ui, /fetchJson|scheduleRefresh/);
});

test('DISPLAY_ONLY_KEYS lists every schema key', () => {
  assert.match(ui, /DISPLAY_ONLY_KEYS = new Set\(\['theme', 'zoom', 'lang', 'preset1', 'preset2', 'preset3', 'sound', 'volume', 'flash', 'seconds'\]\)/);
});

test('ABOUT names the page and credits the sound', () => {
  assert.match(ui, /page: 'k_timer'/);
  assert.match(ui, /https:\/\/mixkit\.co\//);
});

test('i18n has the timer keys in both languages', () => {
  const keys = ['page_title', 'tab_timer', 'preset_minutes', 'start', 'stop', 'stop_alarm', 'reset', 'end_at', 'end_at_tomorrow',
    'preset1', 'preset2', 'preset3', 'sound', 'sound_1', 'sound_2', 'sound_3', 'preview', 'preview_stop', 'volume', 'flash',
    'seconds_hand', 'error_audio', 'about_description'];
  for (const k of keys) {
    assert.equal(typeof Logic.I18N.ja[k], 'string', `ja.${k}`);
    assert.equal(typeof Logic.I18N.en[k], 'string', `en.${k}`);
  }
  assert.equal(Logic.t('ja', 'preset_minutes', { n: 5 }), '5 分');
  assert.equal(Logic.t('en', 'preset_minutes', { n: 5 }), '5 min');
  assert.equal(Logic.t('ja', 'end_at', { time: '14:32' }), '終了 14:32');
  assert.equal(Logic.t('en', 'end_at_tomorrow', { time: '00:05' }), 'Ends tomorrow 00:05');
  for (const k of ['refresh_minutes', 'updating', 'updated_at', 'never_updated', 'error_fetch', 'placeholder_content', 'tab_general']) {
    assert.equal(Logic.I18N.ja[k], undefined, `ja.${k} should be removed`);
  }
});

test('every i18n key used in index.html exists in both languages', () => {
  const keys = new Set();
  for (const re of [/data-i18n(?:-label)?="([^"]+)"/g, /Logic\.t\(\s*settings\.lang\s*,\s*'([^']+)'/g]) {
    for (const m of src.matchAll(re)) keys.add(m[1]);
  }
  assert.ok(keys.size > 0);
  for (const k of keys) {
    for (const lang of ['ja', 'en']) assert.equal(typeof Logic.I18N[lang][k], 'string', `${lang} missing ${k}`);
  }
});

test('markup: two columns, timer controls, audio element, no external resources', () => {
  assert.match(src, /<section id="clock"/);
  assert.match(src, /<section id="timer"/);
  assert.match(src, /<h1 id="page-title" class="visually-hidden"/);
  assert.match(src, /<audio id="alarm-audio" loop preload="auto"><\/audio>/);
  assert.doesNotMatch(src, /<audio[^>]*src=/);
  for (const d of ['-600000', '-60000', '-30000', '30000', '60000', '600000']) assert.match(src, new RegExp(`data-delta="${d}"`));
  assert.match(src, /id="btn-zero"/);
  assert.match(src, /@media \(max-width: 699px\)/);
  assert.doesNotMatch(src, /<link|<script src=|https?:\/\/[^"']*\.(css|js|woff)/);
});

test('audio src comes only from Logic.SOUND_FILES and the alarm stops on any pointerdown/keydown', () => {
  assert.match(ui, /\.src = Logic\.SOUND_FILES\[/);
  assert.doesNotMatch(ui, /\.src = settings/);
  assert.match(ui, /document\.addEventListener\('pointerdown', onAnyInput/);
  assert.match(ui, /document\.addEventListener\('keydown', onAnyInput/);
  assert.match(ui, /function onAnyInput[\s\S]*?swallowNextClick = true/);
  assert.match(ui, /function swallowClickAfterStop[\s\S]*?swallowNextClick = false/);
  assert.doesNotMatch(ui, /SWALLOW_CLICK_MS|alarmStoppedAt/);
});
