// calendar/test/gas-code.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const gs = readFileSync(new URL('../gas/Code.gs', import.meta.url), 'utf8');

test('the Code.gs embedded in the connection tab matches calendar/gas/Code.gs', () => {
  const m = html.match(/<textarea id="gas-code"[^>]*>([\s\S]*?)<\/textarea>/);
  assert.ok(m, 'textarea#gas-code not found');
  const embedded = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  assert.equal(embedded.trim(), gs.trim());
});
