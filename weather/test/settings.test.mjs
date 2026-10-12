import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Logic } from './logic.test.mjs';

test('locationFromQuery: lat/lon required and validated', () => {
  assert.equal(Logic.locationFromQuery({}), null);
  assert.equal(Logic.locationFromQuery({ lat: '35.6' }), null);
  assert.equal(Logic.locationFromQuery({ lat: 'x', lon: '140' }), null);
  assert.equal(Logic.locationFromQuery({ lat: '95', lon: '140' }), null);
  assert.deepEqual(Logic.locationFromQuery({ lat: '35.6', lon: '140.12' }),
    { name: '35.6, 140.12', lat: 35.6, lon: 140.12, jmaOffice: null, jmaClass10: null, jmaClass10Name: null });
});

test('locationFromQuery: office/area/name', () => {
  assert.deepEqual(Logic.locationFromQuery({ lat: '35.6', lon: '140.12', office: '120000', area: '120010', name: '千葉市' }),
    { name: '千葉市', lat: 35.6, lon: 140.12, jmaOffice: '120000', jmaClass10: '120010', jmaClass10Name: null });
  const bad = Logic.locationFromQuery({ lat: '35.6', lon: '140.12', office: '999999', area: 'abc' });
  assert.equal(bad.jmaOffice, null);
  assert.equal(bad.jmaClass10, null);
});

test('validLocation', () => {
  assert.equal(Logic.validLocation(null), null);
  assert.equal(Logic.validLocation({ lat: 1 }), null);
  const loc = { name: 'A', lat: 1, lon: 2, jmaOffice: '120000', jmaClass10: '120010', jmaClass10Name: '北西部' };
  assert.deepEqual(Logic.validLocation(loc), loc);
  assert.deepEqual(Logic.validLocation({ name: 'A', lat: 1, lon: 2 }), { name: 'A', lat: 1, lon: 2, jmaOffice: null, jmaClass10: null, jmaClass10Name: null });
});

test('API urls', () => {
  assert.equal(Logic.jmaForecastUrl('120000'), 'https://www.jma.go.jp/bosai/forecast/data/forecast/120000.json');
  const u = new URL(Logic.openMeteoUrl(35.6, 140.12));
  assert.equal(u.origin + u.pathname, 'https://api.open-meteo.com/v1/forecast');
  assert.equal(u.searchParams.get('latitude'), '35.6');
  assert.equal(u.searchParams.get('timezone'), 'Asia/Tokyo');
  assert.equal(u.searchParams.get('forecast_days'), '7');
  assert.equal(u.searchParams.get('current'), 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code,is_day');
  assert.equal(u.searchParams.get('hourly'), 'temperature_2m,precipitation_probability,precipitation,weather_code');
  assert.equal(u.searchParams.get('daily'), 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max');
  const g = new URL(Logic.geocodingUrl('千葉市'));
  assert.equal(g.origin + g.pathname, 'https://geocoding-api.open-meteo.com/v1/search');
  assert.equal(g.searchParams.get('name'), '千葉市');
  assert.equal(g.searchParams.get('language'), 'ja');
  assert.equal(g.searchParams.get('count'), '10');
});

test('toLocalIso', () => {
  assert.equal(Logic.toLocalIso(new Date(2026, 9, 12, 19, 45)), '2026-10-12T19:45');
  assert.equal(Logic.toLocalIso(new Date(2026, 0, 1, 0, 5)), '2026-01-01T00:05');
});

test('i18n has weather keys in both languages', () => {
  for (const k of ['tab_location', 'search', 'search_hint', 'no_results', 'office', 'area', 'area_none', 'current', 'hourly', 'weekly', 'humidity', 'apparent', 'wind', 'wave', 'pop', 'precip', 'set_location_hint', 'hourly_step', 'hourly_count', 'daily_days', 'jma_report']) {
    assert.ok(Logic.I18N.ja[k], `ja.${k}`);
    assert.ok(Logic.I18N.en[k], `en.${k}`);
  }
});

test('hourlyStep numeric enum coerces select string values', () => {
  const schema = { hourlyStep: { type: 'enum', values: [1, 3], default: 3 } };
  assert.equal(Logic.resolveSettings(schema, {}, { hourlyStep: '1' }).hourlyStep, 1);
  assert.equal(Logic.resolveSettings(schema, { hourlyStep: '3' }, {}).hourlyStep, 3);
  assert.equal(Logic.resolveSettings(schema, {}, { hourlyStep: '2' }).hourlyStep, 3);
});

test('t: parameter values containing $ patterns are inserted literally', () => {
  assert.equal(Logic.t('en', 'error_fetch', { reason: 'cost $$ and $& ok' }), 'Fetch failed: cost $$ and $& ok');
});
