import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const ui = src.match(/<script id="app-ui">([\s\S]*?)<\/script>/)[1];

test('audio: three elements, kinds map to the sound groups, unlock on the start buttons, fallbacks', () => {
  assert.match(ui, /SOUND_KIND = \{ warning: 'sound1', end: 'sound2', tick: 'sound3' \}/);
  assert.match(ui, /AUDIO_ID = \{ sound1: '#audio-warning', sound2: '#audio-end', sound3: '#audio-tick' \}/);
  assert.match(ui, /function playSound\(kind\)/);
  assert.match(ui, /function unlockAudio\(\)/);
  assert.match(ui, /'AbortError'/);
  assert.match(ui, /'NotAllowedError'/);
  assert.match(ui, /a\.src = Logic\.SOUND_FILES\[key\]/);
  for (const id of ['#btn-lecture', '#btn-lecture-from-break', '#btn-break1', '#btn-break2', '#ex-setup-ok']) {
    assert.ok(ui.includes(`'${id}'`), `${id} unlocks audio`);
  }
  assert.match(ui, /muted: !settings\.muted/);
});
