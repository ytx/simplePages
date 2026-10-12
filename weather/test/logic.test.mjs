import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export const Logic = loadLogic(here('../index.html'));
export const fx = {
  jma: JSON.parse(readFileSync(here('./fixtures/jma-120000.json'), 'utf8')),
  om: JSON.parse(readFileSync(here('./fixtures/open-meteo.json'), 'utf8')),
  geo: JSON.parse(readFileSync(here('./fixtures/geocoding.json'), 'utf8')),
};

test('weather Logic loads with template functions', () => {
  assert.equal(Logic.VERSION, 1);
  assert.equal(typeof Logic.resolveSettings, 'function');
  assert.equal(typeof Logic.t, 'function');
});
