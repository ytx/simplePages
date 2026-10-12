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
