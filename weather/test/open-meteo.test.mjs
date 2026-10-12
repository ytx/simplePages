import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Logic, fx } from './logic.test.mjs';

const mini = {
  current: { time: '2026-10-12T19:45', interval: 900, temperature_2m: 20.0, relative_humidity_2m: 80, apparent_temperature: 21.2, wind_speed_10m: 6.9, wind_direction_10m: 45, weather_code: 0, is_day: 0 },
  hourly: {
    time: ['2026-10-12T18:00', '2026-10-12T19:00', '2026-10-12T20:00', '2026-10-12T21:00', '2026-10-12T22:00', '2026-10-12T23:00', '2026-10-13T00:00'],
    temperature_2m: [21, 20, 19, 18, 18, 17, 17],
    precipitation_probability: [0, 10, 30, 20, null, 50, 60],
    precipitation: [0, 0, 0.2, 0.3, 0, 1.0, 2.0],
    weather_code: [0, 1, 3, 61, 3, 63, 95],
  },
  daily: {
    time: ['2026-10-12', '2026-10-13'],
    temperature_2m_max: [23, 22],
    temperature_2m_min: [15, 14],
    weather_code: [1, 61],
    precipitation_probability_max: [10, 60],
  },
};

test('normalizeOpenMeteo: current/hourly/daily', () => {
  const om = Logic.normalizeOpenMeteo(mini);
  assert.deepEqual(om.current, { time: '2026-10-12T19:45', temp: 20, humidity: 80, apparent: 21.2, windSpeed: 6.9, windDir: 45, code: 0, isDay: false });
  assert.equal(om.hourly.length, 7);
  assert.deepEqual(om.hourly[2], { time: '2026-10-12T20:00', temp: 19, pop: 30, precip: 0.2, code: 3 });
  assert.deepEqual(om.daily[1], { date: '2026-10-13', code: 61, icon: 'rain-light', tMax: 22, tMin: 14, pop: 60 });
});

test('normalizeOpenMeteo: missing sections', () => {
  const om = Logic.normalizeOpenMeteo({});
  assert.equal(om.current, null);
  assert.deepEqual(om.hourly, []);
  assert.deepEqual(om.daily, []);
});

test('aggregateHourly: 3h step aligned to multiples of 3', () => {
  const om = Logic.normalizeOpenMeteo(mini);
  const agg = Logic.aggregateHourly(om.hourly, 3, '2026-10-12T19:45', 16);
  // 19:45 -> 18:00 開始。[18,19,20], [21,22,23], [00]
  assert.equal(agg.length, 3);
  assert.deepEqual(agg[0], { time: '2026-10-12T18:00', temp: 21, pop: 30, precip: 0.2, icon: 'cloudy' });
  assert.deepEqual(agg[1], { time: '2026-10-12T21:00', temp: 18, pop: 50, precip: 1.3, icon: 'rain' });
  assert.deepEqual(agg[2], { time: '2026-10-13T00:00', temp: 17, pop: 60, precip: 2, icon: 'thunder' });
});

test('aggregateHourly: 1h step and count limit', () => {
  const om = Logic.normalizeOpenMeteo(mini);
  const agg = Logic.aggregateHourly(om.hourly, 1, '2026-10-12T20:10', 2);
  assert.deepEqual(agg.map((h) => h.time), ['2026-10-12T20:00', '2026-10-12T21:00']);
});

test('aggregateHourly: now beyond data -> []', () => {
  const om = Logic.normalizeOpenMeteo(mini);
  assert.deepEqual(Logic.aggregateHourly(om.hourly, 3, '2026-10-14T00:00', 16), []);
  assert.deepEqual(Logic.aggregateHourly([], 3, '2026-10-12T00:00', 16), []);
});

test('aggregateHourly: all pops null -> null', () => {
  const agg = Logic.aggregateHourly([{ time: '2026-10-12T00:00', temp: 1, pop: null, precip: 0, code: 0 }], 3, '2026-10-12T00:00', 1);
  assert.equal(agg[0].pop, null);
});

test('normalizeOpenMeteo: real fixture', () => {
  const om = Logic.normalizeOpenMeteo(fx.om);
  assert.ok(om.current);
  assert.equal(om.hourly.length, 7 * 24);
  assert.equal(om.daily.length, 7);
});
