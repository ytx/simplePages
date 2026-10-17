process.env.TZ = 'Asia/Tokyo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';
const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));

const slots = [{ date: '2026-10-20', start: '13:00', end: '14:30' }, { date: '2026-10-22', start: '10:40', end: '12:10' }];

test('buildMessage: header, blank, dates, blank, footer with deadline', () => {
  const t = { header: 'H1\nH2', footer: 'F {期限} F' };
  assert.equal(Logic.buildMessage(t, slots, '2026-10-22', 'ja'), 'H1\nH2\n\n・10月20日(火) 13:00〜14:30\n・10月22日(木) 10:40〜12:10\n\nF 10月22日(木) F');
  assert.equal(Logic.buildMessage(t, slots, '2026-10-22', 'en'), 'H1\nH2\n\n- Tue, Oct 20 13:00–14:30\n- Thu, Oct 22 10:40–12:10\n\nF Thu, Oct 22 F');
});

test('buildMessage replaces every {期限} and tolerates empty header/footer', () => {
  assert.equal(Logic.buildMessage({ header: '', footer: '{期限}/{期限}' }, slots.slice(0, 1), '2026-10-22', 'ja'), '・10月20日(火) 13:00〜14:30\n\n10月22日(木)/10月22日(木)');
  assert.equal(Logic.buildMessage({ header: 'H', footer: '' }, slots.slice(0, 1), '2026-10-22', 'ja'), 'H\n\n・10月20日(火) 13:00〜14:30');
});

test('buildReminder replaces {日時}', () => {
  assert.equal(Logic.buildReminder({ reminder: 'R {日時} R' }, slots[0], 'ja'), 'R 10月20日(火) 13:00〜14:30 R');
});

test('default templates round-trip through buildMessage', () => {
  const t = Logic.DEFAULT_TEMPLATES.ja.business;
  const m = Logic.buildMessage(t, slots, '2026-10-22', 'ja');
  assert.match(m, /^お世話になっております。/);
  assert.match(m, /10月22日\(木\) までにご返信/);
});

test('templatesFrom settings', () => {
  assert.deepEqual(Logic.templatesFrom({ tplHeader: 'a', tplFooter: 'b', tplReminder: 'c' }), { header: 'a', footer: 'b', reminder: 'c' });
});
