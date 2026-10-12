import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Logic } from './logic.test.mjs';

test('JMA_OFFICES has 58 entries sorted by code', () => {
  assert.equal(Logic.JMA_OFFICES.length, 58);
  const codes = Logic.JMA_OFFICES.map((o) => o.code);
  assert.deepEqual(codes, [...codes].sort());
  for (const o of Logic.JMA_OFFICES) {
    assert.match(o.code, /^\d{6}$/);
    assert.ok(o.name && o.enName && o.pref, JSON.stringify(o));
  }
});

test('guessJmaOffices', () => {
  assert.deepEqual(Logic.guessJmaOffices('千葉県').map((o) => o.code), ['120000']);
  assert.deepEqual(Logic.guessJmaOffices('東京都').map((o) => o.code), ['130000']);
  assert.equal(Logic.guessJmaOffices('北海道').length, 8);
  assert.equal(Logic.guessJmaOffices('沖縄県').length, 4);
  assert.equal(Logic.guessJmaOffices('鹿児島県').length, 2);
  assert.deepEqual(Logic.guessJmaOffices('Bavaria'), []);
  assert.deepEqual(Logic.guessJmaOffices(undefined), []);
});

test('findOffice', () => {
  assert.equal(Logic.findOffice('120000').name, '千葉県');
  assert.equal(Logic.findOffice('000000'), undefined);
});
