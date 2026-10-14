import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const Logic = loadLogic(here('../index.html'));
const legacy = JSON.parse(readFileSync(here('./fixtures/legacy-export.json'), 'utf8'));
const NOW = new Date(2026, 9, 15, 13, 0, 0).getTime();
const P = (text, bold = false) => ({ type: 'p', runs: [{ text, bold }] });

test('emptyBlocks and normalizeBlocks never return an empty list and never throw', () => {
  assert.deepEqual(Logic.emptyBlocks(), [{ type: 'p', runs: [{ text: '', bold: false }] }]);
  for (const bad of [undefined, null, 'x', 42, {}, [], [null], [{}], [{ type: 'table', runs: 'no' }], [{ type: 'h', runs: [null, 7, { text: 5, bold: 'yes' }] }]]) {
    const out = Logic.normalizeBlocks(bad);
    assert.ok(Array.isArray(out) && out.length >= 1, JSON.stringify(bad));
    for (const b of out) {
      assert.ok(['p', 'h', 'li'].includes(b.type));
      assert.ok(b.runs.length >= 1);
      for (const r of b.runs) { assert.equal(typeof r.text, 'string'); assert.equal(typeof r.bold, 'boolean'); }
    }
  }
  assert.deepEqual(Logic.normalizeBlocks([{ type: 'h', runs: [{ text: 5, bold: 'yes' }] }]), [{ type: 'h', runs: [{ text: '5', bold: false }] }]);
  assert.deepEqual(Logic.normalizeBlocks(['plain string block']), [P('plain string block')]);
  assert.deepEqual(Logic.normalizeBlocks([{ type: 'li', runs: [] }]), [{ type: 'li', runs: [{ text: '', bold: false }] }]);
  const good = [{ type: 'p', runs: [{ text: 'a', bold: false }, { text: 'b', bold: true }] }];
  assert.deepEqual(Logic.normalizeBlocks(good), good);
  assert.notEqual(Logic.normalizeBlocks(good), good, 'returns a copy');
});

test('blocksToPlainText and firstLine', () => {
  const blocks = [P(''), { type: 'h', runs: [{ text: '  Title ', bold: false }, { text: 'bold', bold: true }] }, P('body')];
  assert.equal(Logic.blocksToPlainText(blocks), '\n  Title bold\nbody');
  assert.equal(Logic.firstLine(blocks), 'Title bold');
  assert.equal(Logic.firstLine(blocks, 3), 'Tit');
  assert.equal(Logic.firstLine([P('   ')]), '');
  assert.equal(Logic.firstLine(Logic.emptyBlocks()), '');
});

test('normalizeDocument fills ids, titles and dates', () => {
  const d = Logic.normalizeDocument({ id: 'doc_1', title: 'T', blocks: [P('x')], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' }, NOW);
  assert.deepEqual(d, { id: 'doc_1', title: 'T', blocks: [P('x')], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' });
  const f = Logic.normalizeDocument({ title: 7, blocks: 'nope' }, NOW);
  assert.equal(f.id, `doc_${NOW}`);
  assert.equal(f.title, '7');
  assert.deepEqual(f.blocks, Logic.emptyBlocks());
  assert.equal(f.createdAt, new Date(NOW).toISOString());
  assert.equal(f.updatedAt, new Date(NOW).toISOString());
  assert.equal(Logic.normalizeDocument('garbage', NOW), null);
  assert.equal(Logic.normalizeDocument(null, NOW), null);
});

test('normalizeData: defaults, draft pointing at a deleted document, title cap', () => {
  assert.deepEqual(Logic.normalizeData(undefined), { version: 1, documents: [], draft: null, exerciseTitles: [] });
  assert.deepEqual(Logic.normalizeData({ version: 1, documents: 'x', draft: 5, exerciseTitles: 'y' }), { version: 1, documents: [], draft: null, exerciseTitles: [] });
  const d = Logic.normalizeData({
    documents: [{ id: 'a', title: 'A', blocks: [P('a')], createdAt: 'c', updatedAt: 'u' }, 'junk'],
    draft: { documentId: 'gone', blocks: [P('draft')], updatedAt: 'd' },
    exerciseTitles: Array.from({ length: 25 }, (_, i) => `t${i}`).concat([7, '', '  ']),
  });
  assert.equal(d.documents.length, 1);
  assert.deepEqual(d.draft, { documentId: null, blocks: [P('draft')], updatedAt: 'd' });
  assert.equal(d.exerciseTitles.length, 20);
  assert.deepEqual(d.exerciseTitles.slice(0, 2), ['t0', 't1']);
  const kept = Logic.normalizeData({ documents: [{ id: 'a', title: 'A', blocks: [P('a')] }], draft: { documentId: 'a', blocks: [P('x')] } });
  assert.equal(kept.draft.documentId, 'a');
  assert.equal(typeof kept.draft.updatedAt, 'string');
});

test('importLegacyHtml: headings, lists, bold, entities, blank paragraphs, unknown tags, nesting', () => {
  const html = legacy.documents.documents[0].content.html;
  assert.deepEqual(Logic.importLegacyHtml(html), [
    { type: 'h', runs: [{ text: 'Intro', bold: false }] },
    { type: 'p', runs: [{ text: 'Hello ', bold: false }, { text: 'world', bold: true }, { text: ' & friends', bold: false }] },
    { type: 'p', runs: [{ text: '', bold: false }] },
    { type: 'li', runs: [{ text: 'one', bold: false }] },
    { type: 'li', runs: [{ text: 'two', bold: false }] },
    { type: 'li', runs: [{ text: 'three', bold: false }] },
    { type: 'p', runs: [{ text: "red text 'q'", bold: false }] },
  ]);
  assert.deepEqual(Logic.importLegacyHtml(''), Logic.emptyBlocks());
  assert.deepEqual(Logic.importLegacyHtml(null), Logic.emptyBlocks());
  assert.deepEqual(Logic.importLegacyHtml('<p>a<br>b</p>'), [P('a'), P('b')]);
  assert.deepEqual(Logic.importLegacyHtml('<h2>T</h2>\n  <p>x</p>'), [{ type: 'h', runs: [{ text: 'T', bold: false }] }, P('x')]);
  assert.deepEqual(Logic.importLegacyHtml('<p><b>a</b><strong>b</strong>c &lt;tag&gt; &#x41;</p>'), [{ type: 'p', runs: [{ text: 'ab', bold: true }, { text: 'c <tag> A', bold: false }] }]);
  assert.deepEqual(Logic.importLegacyHtml('loose text'), [P('loose text')]);
});

test('isLegacyExport / parseLegacyExport map the old keys', () => {
  assert.equal(Logic.isLegacyExport(legacy), true);
  assert.equal(Logic.isLegacyExport({ version: 1, settings: { lecture: 50 } }), false);
  assert.equal(Logic.isLegacyExport(null), false);
  const { settings, documents } = Logic.parseLegacyExport(legacy, NOW);
  assert.deepEqual(settings, {
    lecture: 90, break1: 15, break2: 45, warning: 5, tick: 30, exercise: 20, nextExercise: 10,
    volume: 70, muted: true, sound1: 'sound1-2', sound2: 'sound2-3', theme: 'dark', editor: true, editorZoom: 100, editorWidth: 40,
  });
  assert.equal(documents.length, 2, 'garbage dropped, empty doc kept');
  assert.equal(documents[0].id, 'doc_1700000000000');
  assert.equal(documents[0].title, '第 1 回');
  assert.equal(documents[0].blocks[0].type, 'h');
  assert.equal(documents[0].createdAt, '2026-04-01T00:00:00.000Z');
  assert.equal(documents[1].id, `doc_${NOW}`);
  assert.equal(documents[1].title, 'Untitled');
  assert.deepEqual(documents[1].blocks, Logic.emptyBlocks());
  // zoom mapping: 50 -> 75, 125 -> 100, 200 -> 200, 999 -> absent
  for (const [from, to] of [[50, 75], [125, 100], [200, 200], [999, undefined]]) {
    const o = { version: '1.0', settings: { editorSettings: { zoomLevel: from } } };
    assert.equal(Logic.parseLegacyExport(o, NOW).settings.editorZoom, to, String(from));
  }
});

test('parseImportAll accepts the new export, the legacy export, and rejects junk', () => {
  const fresh = Logic.parseImportAll(JSON.stringify({ version: 1, settings: { lecture: 45 }, data: { documents: [{ id: 'a', title: 'A', blocks: [P('a')] }], exerciseTitles: ['x'] } }), 1);
  assert.equal(fresh.ok, true);
  assert.deepEqual(fresh.settings, { lecture: 45 });
  assert.equal(fresh.documents.length, 1);
  assert.deepEqual(fresh.exerciseTitles, ['x']);
  const settingsOnly = Logic.parseImportAll(JSON.stringify({ version: 1, settings: { lecture: 45 } }), 1);
  assert.equal(settingsOnly.ok, true);
  assert.deepEqual(settingsOnly.documents, []);
  const old = Logic.parseImportAll(JSON.stringify(legacy), 1);
  assert.equal(old.ok, true);
  assert.equal(old.settings.lecture, 90);
  assert.equal(old.documents.length, 2);
  assert.deepEqual(Logic.parseImportAll('{bad', 1), { ok: false, reason: 'invalid_json' });
  assert.deepEqual(Logic.parseImportAll('{"lang":"en"}', 1), { ok: false, reason: 'unrecognized_format' });
  assert.deepEqual(Logic.parseImportAll('{"version":9,"settings":{}}', 1), { ok: false, reason: 'unrecognized_format' });
});

test('mergeImport appends documents, renames colliding ids, merges titles', () => {
  const data = Logic.normalizeData({ documents: [{ id: 'a', title: 'A', blocks: [P('a')] }], exerciseTitles: ['t1', 't2'] });
  const merged = Logic.mergeImport(data, { documents: [{ id: 'a', title: 'A2', blocks: [P('a2')] }, { id: 'b', title: 'B', blocks: [P('b')] }], exerciseTitles: ['t3', 't2'] }, NOW);
  assert.equal(merged.documents.length, 3);
  assert.equal(merged.documents[0].id, 'a');
  assert.equal(merged.documents[0].title, 'A', 'existing document untouched');
  assert.equal(merged.documents[1].id, `a_${NOW}_0`);
  assert.equal(merged.documents[1].title, 'A2');
  assert.equal(merged.documents[2].id, 'b');
  assert.deepEqual(merged.exerciseTitles, ['t3', 't2', 't1']);
  assert.equal(merged.draft, data.draft);
  assert.equal(data.documents.length, 1, 'input not mutated');
});
