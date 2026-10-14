import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, openSync, readSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const Logic = loadLogic(here('../index.html'));

test('every SOUND_FILES entry exists under k_timer/ and is a RIFF/WAVE file', () => {
  for (const rel of Object.values(Logic.SOUND_FILES)) {
    const fd = openSync(here(`../${rel}`), 'r');
    const buf = Buffer.alloc(12);
    readSync(fd, buf, 0, 12, 0);
    closeSync(fd);
    assert.equal(buf.toString('ascii', 0, 4), 'RIFF', rel);
    assert.equal(buf.toString('ascii', 8, 12), 'WAVE', rel);
  }
});

test('no sound file is referenced by a path outside SOUND_FILES', () => {
  const src = readFileSync(here('../index.html'), 'utf8');
  const refs = [...src.matchAll(/audio\/sound[^"'`\s]+/g)].map((m) => m[0]);
  const allowed = new Set(Object.values(Logic.SOUND_FILES));
  for (const r of refs) assert.ok(allowed.has(r), r);
});
