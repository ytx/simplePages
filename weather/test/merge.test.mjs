import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Logic } from './logic.test.mjs';

const jma = {
  reportTime: '2026-10-12T17:00:00+09:00',
  areaName: '北西部',
  days: [
    { date: '2026-10-12', code: '111', icon: 'sunny-cloudy', weather: '晴れ 夜 くもり', wind: '北東の風', wave: '0.5m' },
    { date: '2026-10-13', code: '201', icon: 'cloudy-sunny', weather: 'くもり', wind: '北の風', wave: '0.5m' },
  ],
  pops: [{ time: '2026-10-12T18:00', pop: 0 }, { time: '2026-10-13T00:00', pop: 10 }],
  weekly: [
    { date: '2026-10-13', code: '201', icon: 'cloudy-sunny', pop: null, tMin: null, tMax: null },
    { date: '2026-10-14', code: '202', icon: 'rain-light', pop: 40, tMin: 14, tMax: 22 },
  ],
};
const om = {
  current: { time: '2026-10-12T19:45', temp: 20, humidity: 80, apparent: 21.2, windSpeed: 6.9, windDir: 45, code: 3, isDay: false },
  hourly: [
    { time: '2026-10-12T18:00', temp: 21, pop: 0, precip: 0, code: 0 },
    { time: '2026-10-12T19:00', temp: 20, pop: 10, precip: 0, code: 1 },
    { time: '2026-10-12T20:00', temp: 19, pop: 30, precip: 0.2, code: 3 },
    { time: '2026-10-12T21:00', temp: 18, pop: 20, precip: 0.3, code: 61 },
    { time: '2026-10-12T22:00', temp: 18, pop: 0, precip: 0, code: 3 },
    { time: '2026-10-12T23:00', temp: 17, pop: 50, precip: 1.0, code: 63 },
    { time: '2026-10-13T00:00', temp: 17, pop: 60, precip: 2.0, code: 95 },
  ],
  daily: [
    { date: '2026-10-12', code: 1, icon: 'sunny-cloudy', tMax: 23, tMin: 15, pop: 10 },
    { date: '2026-10-13', code: 61, icon: 'rain-light', tMax: 22, tMin: 14, pop: 60 },
    { date: '2026-10-14', code: 3, icon: 'cloudy', tMax: 21, tMin: 13, pop: 30 },
  ],
};
const opts = { step: 3, count: 16, days: 3 };

test('addDays', () => {
  assert.equal(Logic.addDays('2026-10-12', 1), '2026-10-13');
  assert.equal(Logic.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(Logic.addDays('2026-03-01', -1), '2026-02-28');
});

test('mergeForecast: current combines OM numbers and JMA text', () => {
  const m = Logic.mergeForecast(jma, om, '2026-10-12T19:45', opts);
  assert.equal(m.current.temp, 20);
  assert.equal(m.current.humidity, 80);
  assert.equal(m.current.icon, 'cloudy');
  assert.equal(m.current.text, '晴れ 夜 くもり');
  assert.equal(m.current.wind, '北東の風');
  assert.equal(m.current.wave, '0.5m');
  assert.equal(m.current.isDay, false);
  assert.deepEqual(m.meta, { jmaReportTime: '2026-10-12T17:00:00+09:00', omTime: '2026-10-12T19:45', jmaOk: true, omOk: true });
});

test('mergeForecast: hourly gets jmaPop when times match', () => {
  const m = Logic.mergeForecast(jma, om, '2026-10-12T19:45', opts);
  assert.equal(m.hourly.length, 3);
  assert.equal(m.hourly[0].jmaPop, 0);
  assert.equal(m.hourly[1].jmaPop, null);
  assert.equal(m.hourly[2].jmaPop, 10);
});

test('mergeForecast: daily prefers JMA, fills blanks from OM with flags', () => {
  const m = Logic.mergeForecast(jma, om, '2026-10-12T19:45', opts);
  assert.equal(m.daily.length, 3);
  // 今日: 週間に無い。アイコンは JMA days から、他は OM。
  assert.deepEqual(m.daily[0], { date: '2026-10-12', icon: 'sunny-cloudy', tMax: 23, tMin: 15, pop: 10, fromFallback: { icon: false, tMax: true, tMin: true, pop: true } });
  // 明日: 週間にコードのみ。
  assert.deepEqual(m.daily[1], { date: '2026-10-13', icon: 'cloudy-sunny', tMax: 22, tMin: 14, pop: 60, fromFallback: { icon: false, tMax: true, tMin: true, pop: true } });
  // 明後日: 週間が揃っている。
  assert.deepEqual(m.daily[2], { date: '2026-10-14', icon: 'rain-light', tMax: 22, tMin: 14, pop: 40, fromFallback: { icon: false, tMax: false, tMin: false, pop: false } });
});

test('mergeForecast: JMA missing', () => {
  const m = Logic.mergeForecast(null, om, '2026-10-12T19:45', opts);
  assert.equal(m.current.text, null);
  assert.equal(m.current.icon, 'cloudy');
  assert.equal(m.hourly[0].jmaPop, null);
  assert.equal(m.daily[2].icon, 'cloudy');
  assert.equal(m.daily[2].fromFallback.icon, true);
  assert.equal(m.meta.jmaOk, false);
});

test('mergeForecast: OM missing', () => {
  const m = Logic.mergeForecast(jma, null, '2026-10-12T19:45', opts);
  assert.equal(m.current.temp, null);
  assert.equal(m.current.humidity, null);
  assert.equal(m.current.icon, 'sunny-cloudy');
  assert.equal(m.current.isDay, true);
  assert.deepEqual(m.hourly, []);
  assert.deepEqual(m.daily[0], { date: '2026-10-12', icon: 'sunny-cloudy', tMax: null, tMin: null, pop: null, fromFallback: { icon: false, tMax: false, tMin: false, pop: false } });
  assert.equal(m.meta.omOk, false);
});

test('mergeForecast: both missing yields empty model without throwing', () => {
  const m = Logic.mergeForecast(null, null, '2026-10-12T19:45', opts);
  assert.equal(m.current.icon, 'unknown');
  assert.deepEqual(m.hourly, []);
  assert.equal(m.daily.length, 3);
  assert.equal(m.daily[0].icon, 'unknown');
});
