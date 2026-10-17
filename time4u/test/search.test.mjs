import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';
const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));

test('normalizeKana', () => {
  assert.equal(Logic.normalizeKana('タナカ'), 'たなか');
  assert.equal(Logic.normalizeKana('ﾀﾅｶ'), 'たなか');
  assert.equal(Logic.normalizeKana('ＡＢＣ １２３'), 'abc123');
  assert.equal(Logic.normalizeKana(' Tanaka  Taro '), 'tanakataro');
  assert.equal(Logic.normalizeKana('ガ'), 'が');
  assert.equal(Logic.normalizeKana('ｶﾞ'), 'が');
});

test('matchesClient on name or reading, partial, any kana width', () => {
  const c = { name: '田中', reading: 'たなか' };
  for (const q of ['たな', 'タナ', 'ﾀﾅ', '田', '田中']) assert.equal(Logic.matchesClient(c, q), true, q);
  assert.equal(Logic.matchesClient(c, 'さと'), false);
  assert.equal(Logic.matchesClient(c, ''), true);
  assert.equal(Logic.matchesClient({ name: 'Smith', reading: '' }, 'smi'), true);
  assert.equal(Logic.matchesClient({ name: '田中' }, 'たな'), false);
});
