// calendar/test/response.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';
const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));

const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

test('normalizeHex', () => {
  assert.equal(Logic.normalizeHex('#039BE5'), '#039be5');
  assert.equal(Logic.normalizeHex('039be5'), '#039be5');
  assert.equal(Logic.normalizeHex('x'), '');
  assert.equal(Logic.normalizeHex(undefined), '');
});

test('normalizeResponse: list', () => {
  const r = Logic.normalizeResponse(fx('gas-list.json'));
  assert.equal(r.ok, true);
  assert.equal(r.tz, 'Asia/Tokyo');
  assert.deepEqual(r.calendars, [
    { id: 'a@group.calendar.google.com', name: '仕事', color: '#039be5' },
    { id: 'b@group.calendar.google.com', name: '家族', color: '#33b679' },
  ]);
  assert.deepEqual(r.events, []);
  assert.deepEqual(r.errors, []);
});

test('normalizeResponse: events, dropped broken item, zero-length fix, errors', () => {
  const r = Logic.normalizeResponse(fx('gas-events.json'));
  assert.equal(r.ok, true);
  assert.equal(r.events.length, 12);
  const e2 = r.events.find((e) => e.id === 'e2');
  assert.deepEqual(e2.start, new Date(2026, 9, 13, 10, 0));
  assert.deepEqual(e2.end, new Date(2026, 9, 13, 11, 30));
  assert.equal(e2.allDay, false);
  assert.equal(e2.location, '3F 会議室');
  const e6 = r.events.find((e) => e.id === 'e6');
  assert.equal(e6.allDay, true);
  assert.deepEqual(e6.start, new Date(2026, 9, 12));
  assert.deepEqual(e6.end, new Date(2026, 9, 13));
  assert.equal(r.events.some((e) => e.id === 'e12'), false);
  assert.deepEqual(r.errors, [{ calendarId: 'missing@group.calendar.google.com', error: 'not_found' }]);
  const z = Logic.normalizeResponse({ ok: true, events: [{ id: 'z', calendarId: 'a', start: '2026-10-13T10:00:00+09:00', end: '2026-10-13T10:00:00+09:00' }] });
  assert.equal(z.events[0].end - z.events[0].start, 30 * 60000);
});

test('normalizeResponse: failures', () => {
  assert.deepEqual(Logic.normalizeResponse(null), { ok: false, error: 'invalid_response' });
  assert.deepEqual(Logic.normalizeResponse('<html>'), { ok: false, error: 'invalid_response' });
  assert.deepEqual(Logic.normalizeResponse([1]), { ok: false, error: 'invalid_response' });
  assert.deepEqual(Logic.normalizeResponse({ foo: 1 }), { ok: false, error: 'invalid_response' });
  assert.deepEqual(Logic.normalizeResponse({ ok: false, error: 'unauthorized' }), { ok: false, error: 'unauthorized', detail: '' });
  assert.deepEqual(Logic.normalizeResponse({ ok: false }), { ok: false, error: 'unknown', detail: '' });
  assert.equal(Logic.normalizeResponse({ ok: false, error: 'internal', detail: 'x'.repeat(200) }).detail.length, 120);
});

test('validCalendars / mergeCalendarList', () => {
  assert.deepEqual(Logic.validCalendars('x'), []);
  assert.deepEqual(Logic.validCalendars([{ id: 'a', name: 'A', color: '#FFFFFF' }, { id: 'a' }, { name: 'no id' }, { id: 'b', enabled: false, color: 'bad' }]),
    [{ id: 'a', name: 'A', color: '#ffffff', enabled: true }, { id: 'b', name: 'b', color: '', enabled: false }]);
  const merged = Logic.mergeCalendarList(
    [{ id: 'a', name: 'old', color: '#111111', enabled: false }, { id: 'gone', name: 'gone', color: '', enabled: true }],
    [{ id: 'a', name: '仕事', color: '#039be5' }, { id: 'c', name: '新規', color: '#33b679' }]);
  assert.deepEqual(merged, [
    { id: 'a', name: '仕事', color: '#111111', enabled: false },
    { id: 'c', name: '新規', color: '#33b679', enabled: true },
  ]);
});

test('eventColor priority and textColorFor', () => {
  const cals = [{ id: 'a', name: 'A', color: '#111111', enabled: true }];
  const gas = [{ id: 'a', name: 'A', color: '#222222' }, { id: 'b', name: 'B', color: '#333333' }];
  assert.equal(Logic.eventColor({ calendarId: 'a', color: '#dc2127' }, cals, gas), '#dc2127');
  assert.equal(Logic.eventColor({ calendarId: 'a', color: '' }, cals, gas), '#111111');
  assert.equal(Logic.eventColor({ calendarId: 'b', color: '' }, cals, gas), '#333333');
  assert.equal(Logic.eventColor({ calendarId: 'zz', color: '' }, cals, gas), '');
  assert.equal(Logic.textColorFor('#ffffff'), '#000');
  assert.equal(Logic.textColorFor('#000000'), '#fff');
  assert.equal(Logic.textColorFor('#fbd75b'), '#000');
  assert.equal(Logic.textColorFor('#5484ed'), '#fff');
  assert.equal(Logic.textColorFor(''), '#fff');
  assert.equal(Logic.textColorFor('#33b679'), '#000');
  assert.equal(Logic.textColorFor('#e67c73'), '#000');
  assert.equal(Logic.textColorFor('#039be5'), '#fff');
});

test('validGasUrl / gasRequestUrl', () => {
  const good = 'https://script.google.com/macros/s/AKfycbxYZ_12-ab/exec';
  assert.equal(Logic.validGasUrl(` ${good} `), good);
  assert.equal(Logic.validGasUrl('https://script.google.com/macros/s/AKfycbxYZ/dev'), '');
  assert.equal(Logic.validGasUrl('http://script.google.com/macros/s/AKfycbxYZ/exec'), '');
  assert.equal(Logic.validGasUrl('https://example.com/macros/s/AKfycbxYZ/exec'), '');
  assert.equal(Logic.validGasUrl(''), '');
  assert.equal(Logic.gasRequestUrl(good, { from: '2026-10-11', to: '2026-10-18', cal: 'a@x,b@y', token: '' }),
    `${good}?from=2026-10-11&to=2026-10-18&cal=a%40x%2Cb%40y`);
  assert.equal(Logic.gasRequestUrl(good, { action: 'list', token: 's3cret' }), `${good}?action=list&token=s3cret`);
  assert.equal(Logic.gasRequestUrl(good, {}), good);
  assert.equal(Logic.gasRequestUrl('nope', { action: 'list' }), null);
});

test('swipeOffset: 1:1 follow clamped to the pane width, armed past the swipe threshold, inactive while mostly vertical', () => {
  const W = 1000;
  assert.deepEqual(Logic.swipeOffset(0, 0, W), { offset: 0, armed: false, active: true });
  assert.deepEqual(Logic.swipeOffset(100, 0, W), { offset: 100, armed: true, active: true });
  assert.deepEqual(Logic.swipeOffset(-40, 10, W), { offset: -40, armed: false, active: true });
  assert.deepEqual(Logic.swipeOffset(1500, 0, W), { offset: 1000, armed: true, active: true });
  assert.deepEqual(Logic.swipeOffset(-1500, 0, W), { offset: -1000, armed: true, active: true });
  assert.deepEqual(Logic.swipeOffset(150.4, 70, W), { offset: 150, armed: true, active: true });
  assert.deepEqual(Logic.swipeOffset(100, 80, W), { offset: 100, armed: false, active: true });
  assert.deepEqual(Logic.swipeOffset(30, 60, W), { offset: 0, armed: false, active: false });
  assert.deepEqual(Logic.swipeOffset(10, 40, W), { offset: 0, armed: false, active: false });
  assert.deepEqual(Logic.swipeOffset(5, 8, W), { offset: 5, armed: false, active: true });
});

test('isSwipe / normalizeHours / nowLinePct', () => {
  assert.equal(Logic.isSwipe(-80, 10), true);
  assert.equal(Logic.isSwipe(59, 0), false);
  assert.equal(Logic.isSwipe(100, 40), true);   // angle rule: horizontal >= 1.5x vertical
  assert.equal(Logic.isSwipe(150, 70), true);
  assert.equal(Logic.isSwipe(150, 100), true);
  assert.equal(Logic.isSwipe(150, 101), false);
  assert.equal(Logic.isSwipe(-90, -60), true);
  assert.equal(Logic.isSwipe(-90, -61), false);
  assert.deepEqual(Logic.normalizeHours(6, 23), [6, 23]);
  assert.deepEqual(Logic.normalizeHours(0, 24), [0, 24]);
  assert.deepEqual(Logic.normalizeHours(10, 10), [6, 23]);
  assert.deepEqual(Logic.normalizeHours(12, 8), [6, 23]);
  assert.deepEqual(Logic.normalizeHours('6', 23), [6, 23]);
  assert.equal(Logic.nowLinePct(new Date(2026, 9, 13, 6, 0), 6, 23), 0);
  assert.equal(Logic.nowLinePct(new Date(2026, 9, 13, 14, 30), 6, 23), 50);
  assert.equal(Logic.nowLinePct(new Date(2026, 9, 13, 5, 59), 6, 23), null);
  assert.equal(Logic.nowLinePct(new Date(2026, 9, 13, 23, 1), 6, 23), null);
});

test('normalizeResponse: tolerates mixed all-day formats', () => {
  const a = Logic.normalizeResponse({ ok: true, events: [{ id: 'm1', calendarId: 'a', allDay: true, start: '2026-10-13T00:00:00+09:00', end: '2026-10-14T00:00:00+09:00' }] });
  assert.equal(a.events.length, 1);
  assert.deepEqual(a.events[0].start, new Date(2026, 9, 13));
  assert.deepEqual(a.events[0].end, new Date(2026, 9, 14));
  const b = Logic.normalizeResponse({ ok: true, events: [{ id: 'm2', calendarId: 'a', allDay: false, start: '2026-10-13', end: '2026-10-14' }] });
  assert.deepEqual(b.events[0].start, new Date(2026, 9, 13));
});
