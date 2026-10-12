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

test('pickJmaOffice chooses nearest region for multi-office prefectures', () => {
  const g = (p) => Logic.guessJmaOffices(p);
  assert.equal(Logic.pickJmaOffice(g('北海道'), 43.06, 141.35).code, '016000');   // 札幌
  assert.equal(Logic.pickJmaOffice(g('北海道'), 41.77, 140.73).code, '017000');   // 函館
  assert.equal(Logic.pickJmaOffice(g('鹿児島県'), 31.6, 130.56).code, '460100'); // 鹿児島市
  assert.equal(Logic.pickJmaOffice(g('鹿児島県'), 28.38, 129.49).code, '460040'); // 奄美
  assert.equal(Logic.pickJmaOffice(g('沖縄県'), 24.34, 124.16).code, '474000');   // 石垣
  assert.equal(Logic.pickJmaOffice(g('千葉県'), 35.6, 140.1).code, '120000');
  assert.equal(Logic.pickJmaOffice(g('千葉県'), NaN, NaN).code, '120000');
  assert.equal(Logic.pickJmaOffice([], 0, 0), null);
});
