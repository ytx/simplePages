import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const html = fileURLToPath(new URL('../index.html', import.meta.url));
const Logic = loadLogic(html);

test('Logic exposes VERSION', () => {
  assert.equal(Logic.VERSION, 1);
});

const schema = {
  theme: { type: 'enum', values: ['auto', 'light', 'dark'], default: 'auto' },
  lang: { type: 'enum', values: ['ja', 'en'], default: 'ja' },
  refreshMinutes: { type: 'int', min: 1, max: 120, default: 10 },
  title: { type: 'string', default: '' },
  location: { type: 'object', default: null },
};

test('resolveSettings returns defaults when nothing stored', () => {
  const s = Logic.resolveSettings(schema, {}, {});
  assert.deepEqual(s, { theme: 'auto', lang: 'ja', refreshMinutes: 10, title: '', location: null });
});

test('resolveSettings: query overrides stored overrides default', () => {
  const s = Logic.resolveSettings(schema, { theme: 'dark', refreshMinutes: 30 }, { refreshMinutes: '5' });
  assert.equal(s.theme, 'dark');
  assert.equal(s.refreshMinutes, 5);
});

test('resolveSettings: invalid values fall back to default', () => {
  const s = Logic.resolveSettings(schema, { theme: 'blue', refreshMinutes: 999 }, { refreshMinutes: 'abc', lang: 'fr' });
  assert.equal(s.theme, 'auto');
  assert.equal(s.refreshMinutes, 10);
  assert.equal(s.lang, 'ja');
});

test('resolveSettings: unknown keys are ignored, object type ignores query', () => {
  const s = Logic.resolveSettings(schema, { bogus: 1, location: { lat: 1 } }, { location: 'x', other: 'y' });
  assert.equal('bogus' in s, false);
  assert.deepEqual(s.location, { lat: 1 });
});

test('migrateStored: accepts current format, rejects garbage', () => {
  assert.deepEqual(Logic.migrateStored({ version: 1, settings: { theme: 'dark' } }, 1), { theme: 'dark' });
  assert.deepEqual(Logic.migrateStored(null, 1), {});
  assert.deepEqual(Logic.migrateStored('junk', 1), {});
  assert.deepEqual(Logic.migrateStored({ theme: 'dark' }, 1), {});
  assert.deepEqual(Logic.migrateStored({ version: 1, settings: 'x' }, 1), {});
});

test('t: lookup, fallback to ja, then key, with params', () => {
  assert.equal(Logic.t('ja', 'settings'), '設定');
  assert.equal(Logic.t('en', 'settings'), 'Settings');
  assert.equal(Logic.t('en', 'no.such.key'), 'no.such.key');
  assert.equal(Logic.t('en', 'updated_at', { time: '19:40' }), 'Updated 19:40');
});

test('detectLang', () => {
  assert.equal(Logic.detectLang('ja-JP'), 'ja');
  assert.equal(Logic.detectLang('en-US'), 'en');
  assert.equal(Logic.detectLang(undefined), 'en');
});

test('effectiveTheme', () => {
  assert.equal(Logic.effectiveTheme('auto', true), 'dark');
  assert.equal(Logic.effectiveTheme('auto', false), 'light');
  assert.equal(Logic.effectiveTheme('light', true), 'light');
  assert.equal(Logic.effectiveTheme('dark', false), 'dark');
});

test('t: parameter values containing $ patterns are inserted literally', () => {
  assert.equal(Logic.t('en', 'error_fetch', { reason: 'cost $$ and $& ok' }), 'Fetch failed: cost $$ and $& ok');
});

test('stepZoom: 10 steps, clamped 50..200, rounds odd values first', () => {
  assert.equal(Logic.stepZoom(100, 1), 110);
  assert.equal(Logic.stepZoom(100, -1), 90);
  assert.equal(Logic.stepZoom(200, 1), 200);
  assert.equal(Logic.stepZoom(50, -1), 50);
  assert.equal(Logic.stepZoom(195, 1), 200);
  assert.equal(Logic.stepZoom(155, 1), 170);
  assert.equal(Logic.stepZoom(155, -1), 150);
  assert.equal(Logic.stepZoom(154, 1), 160);
  assert.equal(Logic.stepZoom(NaN, 1), 110);
});

test('toggleTheme / toggleLang flip between the two concrete values', () => {
  assert.equal(Logic.toggleTheme('dark'), 'light');
  assert.equal(Logic.toggleTheme('light'), 'dark');
  assert.equal(Logic.toggleTheme(undefined), 'dark');
  assert.equal(Logic.toggleLang('ja'), 'en');
  assert.equal(Logic.toggleLang('en'), 'ja');
  assert.equal(Logic.toggleLang('fr'), 'ja');
});

test('parseImport: valid, broken JSON, wrong shape, blank', () => {
  assert.deepEqual(Logic.parseImport('{"version":1,"settings":{"lang":"en"}}', 1), { ok: true, settings: { lang: 'en' } });
  assert.deepEqual(Logic.parseImport('{bad json', 1), { ok: false, reason: 'invalid_json' });
  assert.deepEqual(Logic.parseImport('   \n', 1), { ok: false, reason: 'invalid_json' });
  assert.deepEqual(Logic.parseImport('{"lang":"en"}', 1), { ok: false, reason: 'unrecognized_format' });
  assert.deepEqual(Logic.parseImport('{"version":99,"settings":{"lang":"en"}}', 1), { ok: false, reason: 'unrecognized_format' });
  assert.deepEqual(Logic.parseImport('[1,2]', 1), { ok: false, reason: 'unrecognized_format' });
});

test('zoom schema entry coerces URL strings and rejects out-of-range', () => {
  const zoomSchema = { zoom: { type: 'int', min: 50, max: 200, default: 100 } };
  assert.equal(Logic.resolveSettings(zoomSchema, {}, { zoom: '120' }).zoom, 120);
  assert.equal(Logic.resolveSettings(zoomSchema, {}, { zoom: 'abc' }).zoom, 100);
  assert.equal(Logic.resolveSettings(zoomSchema, {}, { zoom: '999' }).zoom, 100);
  assert.equal(Logic.resolveSettings(zoomSchema, { zoom: 40 }, {}).zoom, 100);
});
