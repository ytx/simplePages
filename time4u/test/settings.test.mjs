import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const html = fileURLToPath(new URL('../index.html', import.meta.url));
const Logic = loadLogic(html);
const src = readFileSync(html, 'utf8');

test('schema has exactly the spec keys and all are display-only', () => {
  const schema = src.match(/const SCHEMA = \{([\s\S]*?)\n  \};/)[1];
  const keys = [...schema.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]).sort();
  const expected = ['dayEnd', 'dayStart', 'deadlineDays', 'defaultSlot', 'eveStart', 'honorific', 'interval', 'lang', 'pickCount', 'pmStart', 'rangeDays', 'rangeStartDays', 'slots', 'theme', 'tplFooter', 'tplHeader', 'tplReminder', 'weekStart', 'zoom'];
  assert.deepEqual(keys, expected);
  const only = src.match(/DISPLAY_ONLY_KEYS = new Set\(\[([^\]]*)\]\)/)[1];
  for (const k of expected) assert.match(only, new RegExp(`'${k}'`), k);
});

test('parseSlotList normalizes, sorts, dedupes, bounds and falls back', () => {
  assert.deepEqual(Logic.parseSlotList('60, 90,120'), [60, 90, 120]);
  assert.deepEqual(Logic.parseSlotList('120,60,60'), [60, 120]);
  assert.deepEqual(Logic.parseSlotList('5,60,500'), [60]);
  assert.deepEqual(Logic.parseSlotList(''), [60, 90, 120]);
  assert.deepEqual(Logic.parseSlotList('abc'), [60, 90, 120]);
  assert.deepEqual(Logic.parseSlotList('10,20,30,40,50,60,70'), [10, 20, 30, 40, 50, 60]);
});

test('default templates exist for both languages and styles with placeholders', () => {
  for (const lang of ['ja', 'en']) for (const style of ['business', 'friendly']) {
    const t = Logic.DEFAULT_TEMPLATES[lang][style];
    assert.match(t.footer, /\{期限\}/);
    assert.match(t.reminder, /\{日時\}/);
    assert.ok(t.header.length > 0);
  }
  assert.equal(Logic.DEFAULT_TEMPLATES.ja.business.header, 'お世話になっております。\n面会の候補日時をお送りします。\nご都合のよい日時をお知らせください。');
  assert.equal(Logic.DEFAULT_TEMPLATES.ja.business.footer, '恐れ入りますが {期限} までにご返信いただけますと幸いです。\nいずれも難しい場合は別途ご相談ください。');
  assert.equal(Logic.DEFAULT_TEMPLATES.ja.friendly.header, 'こんにちは!\n面会の候補日をいくつか挙げてみました。\n都合のいい日時を教えてください。');
});

test('settings resolve with spec defaults', () => {
  const schema = src.match(/const SCHEMA = \{([\s\S]*?)\n  \};/)[1];
  for (const [k, v] of [['honorific', 'HONORIFIC_DEFAULT'], ['weekStart', '1'], ['dayStart', '8'], ['dayEnd', '21'], ['slots', "'60,90,120'"], ['defaultSlot', '90'], ['interval', '10'], ['deadlineDays', '3'], ['pickCount', '3'], ['rangeStartDays', '1'], ['rangeDays', '21'], ['pmStart', '12'], ['eveStart', '17']]) {
    assert.match(schema, new RegExp(`${k}:[^\\n]*default: ${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), k);
  }
});

test('parseImportAll accepts settings, data or both; replaces, never merges', () => {
  const both = JSON.stringify({ version: 1, settings: { zoom: 120 }, data: { version: 1, clients: [{ id: 'c_1', name: 'A' }], bands: [], blocks: [], proposals: [] } });
  const r = Logic.parseImportAll(both, 1, 1);
  assert.equal(r.ok, true);
  assert.equal(r.settings.zoom, 120);
  assert.equal(r.data.clients.length, 1);
  const onlyData = Logic.parseImportAll(JSON.stringify({ version: 1, data: { version: 1, clients: [], bands: [], blocks: [], proposals: [] } }), 1, 1);
  assert.equal(onlyData.ok, true);
  assert.equal(onlyData.settings, undefined);
  assert.equal(Logic.parseImportAll('nope', 1, 1).ok, false);
  assert.equal(Logic.parseImportAll(JSON.stringify({ version: 9, settings: {} }), 1, 1).ok, false);
  assert.equal(Logic.parseImportAll(JSON.stringify({ version: 1 }), 1, 1).ok, false);
});
