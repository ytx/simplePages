import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));

test('splitName', () => {
  assert.deepEqual(Logic.splitName('alpha (web)'), ['alpha', '(web)']);
  assert.deepEqual(Logic.splitName('delta'), ['delta', '']);
  assert.deepEqual(Logic.splitName('(odd)'), ['(odd)', '']);
});
test('fitFontSize', () => {
  assert.equal(Logic.fitFontSize([500, 300], 240, 1), 48);
  assert.equal(Logic.fitFontSize([500], 240, 0.7), 68);
  assert.equal(Logic.fitFontSize([], 240, 1), null);
  assert.equal(Logic.fitFontSize([500], 0, 1), null);
});
test('tileLayout', () => {
  const L = (n) => Logic.tileLayout(n, 1316, 912);
  assert.deepEqual(L(12), { cols: 4, rows: 3, tileW: 318, tileH: 294, visible: 12, truncated: false });
  assert.deepEqual(L(20), { cols: 5, rows: 4, tileW: 252, tileH: 217, visible: 20, truncated: false });
  assert.deepEqual(L(25), { cols: 6, rows: 5, tileW: 207, tileH: 171, visible: 25, truncated: false });
  assert.deepEqual(L(40), { cols: 8, rows: 5, tileW: 152, tileH: 171, visible: 40, truncated: false });
  assert.deepEqual(L(100), { cols: 8, rows: 13, tileW: 152, tileH: 57, visible: 100, truncated: false });
  assert.deepEqual(L(200), { cols: 8, rows: 17, tileW: 152, tileH: 40, visible: 136, truncated: true });
  assert.deepEqual(L(1), { cols: 1, rows: 1, tileW: 1316, tileH: 912, visible: 1, truncated: false });
  assert.deepEqual(L(0), { cols: 1, rows: 0, tileW: 0, tileH: 0, visible: 0, truncated: false });
});
test('tileFontSize', () => {
  assert.deepEqual(Logic.tileFontSize(294, [61], 16), { nameSize: 61, subSize: 42, lineGap: 7 });
  assert.deepEqual(Logic.tileFontSize(217, [48], 16), { nameSize: 48, subSize: 33, lineGap: 6 });
  assert.deepEqual(Logic.tileFontSize(171, [28], 16), { nameSize: 28, subSize: 19, lineGap: 3 });
  assert.deepEqual(Logic.tileFontSize(57, [28], 16), { nameSize: 22, subSize: 15, lineGap: 2 });
  assert.deepEqual(Logic.tileFontSize(40, [10], 16), { nameSize: 16, subSize: 12, lineGap: 2 });
  assert.deepEqual(Logic.tileFontSize(294, [], 16), { nameSize: 64, subSize: 44, lineGap: 8 });
});
test('visibleRows', () => {
  assert.equal(Logic.visibleRows(30, 20, 940), 17);
  assert.equal(Logic.visibleRows(5, 20, 940), 5);
  assert.equal(Logic.visibleRows(30, 10, 940), 10);
  assert.equal(Logic.visibleRows(3, 20, 60), 1);
});
test('summaryText', () => {
  assert.deepEqual(Logic.summaryText({ hostsTotal: 12, hostsOk: 10, hostsBad: 2, problems: 3, bySeverity: [0, 0, 0, 0, 2, 1] }, 'en', Logic.t), { left: '12 hosts (OK:10 BAD:2)', right: '3 problems  D:1  H:2' });
  assert.equal(Logic.summaryText({ hostsTotal: 0, hostsOk: 0, hostsBad: 0, problems: 0, bySeverity: [0, 0, 0, 0, 0, 0] }, 'ja', Logic.t).right, '0 problems  -');
});
test('isStale and ageText', () => {
  assert.equal(Logic.isStale(1000, 1000 + 150000, 150), true);
  assert.equal(Logic.isStale(1000, 1000 + 149999, 150), false);
  assert.equal(Logic.isStale(null, 5000, 150), false);
  assert.equal(Logic.ageText(150000), '2m 30s');
  assert.equal(Logic.ageText(59999), '0m 59s');
});
