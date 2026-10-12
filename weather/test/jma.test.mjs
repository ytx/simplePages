import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Logic, fx } from './logic.test.mjs';

const mini = [
  {
    publishingOffice: '銚子地方気象台',
    reportDatetime: '2026-10-12T17:00:00+09:00',
    timeSeries: [
      {
        timeDefines: ['2026-10-12T17:00:00+09:00', '2026-10-13T00:00:00+09:00', '2026-10-14T00:00:00+09:00'],
        areas: [
          { area: { name: '北西部', code: '120010' }, weatherCodes: ['111', '201', '201'], weathers: ['晴れ　夜　くもり', 'くもり　時々　晴れ', 'くもり'], winds: ['北東の風', '北の風', '南の風'], waves: ['０．５メートル', '０．５メートル', '１メートル'] },
          { area: { name: '南部', code: '120030' }, weatherCodes: ['100', '100', '100'], weathers: ['晴れ', '晴れ', '晴れ'], winds: ['北の風', '北の風', '北の風'], waves: ['１メートル', '１メートル', '１メートル'] },
        ],
      },
      {
        timeDefines: ['2026-10-12T18:00:00+09:00', '2026-10-13T00:00:00+09:00', '2026-10-13T06:00:00+09:00'],
        areas: [
          { area: { name: '北西部', code: '120010' }, pops: ['0', '10', ''] },
          { area: { name: '南部', code: '120030' }, pops: ['20', '20', '20'] },
        ],
      },
      { timeDefines: ['2026-10-13T00:00:00+09:00'], areas: [{ area: { name: '千葉', code: '45212' }, temps: ['15'] }] },
    ],
  },
  {
    publishingOffice: '銚子地方気象台',
    reportDatetime: '2026-10-12T17:00:00+09:00',
    timeSeries: [
      {
        timeDefines: ['2026-10-13T00:00:00+09:00', '2026-10-14T00:00:00+09:00'],
        areas: [{ area: { name: '千葉県', code: '120000' }, weatherCodes: ['201', '202'], pops: ['', '40'], reliabilities: ['', 'A'] }],
      },
      {
        timeDefines: ['2026-10-13T00:00:00+09:00', '2026-10-14T00:00:00+09:00'],
        areas: [{ area: { name: '銚子', code: '45148' }, tempsMin: ['', '14'], tempsMax: ['', '22'] }],
      },
    ],
  },
];

test('normalizeJma: days for selected area, spaces normalized', () => {
  const j = Logic.normalizeJma(mini, '120010');
  assert.equal(j.reportTime, '2026-10-12T17:00:00+09:00');
  assert.equal(j.areaName, '北西部');
  assert.equal(j.days.length, 3);
  assert.deepEqual(j.days[0], { date: '2026-10-12', code: '111', icon: 'sunny-cloudy', weather: '晴れ 夜 くもり', wind: '北東の風', wave: '０．５メートル' });
});

test('normalizeJma: pops with empty string -> null', () => {
  const j = Logic.normalizeJma(mini, '120010');
  assert.deepEqual(j.pops, [
    { time: '2026-10-12T18:00', pop: 0 },
    { time: '2026-10-13T00:00', pop: 10 },
    { time: '2026-10-13T06:00', pop: null },
  ]);
});

test('normalizeJma: weekly merges codes, pops and temps; blanks -> null', () => {
  const j = Logic.normalizeJma(mini, '120010');
  assert.deepEqual(j.weekly, [
    { date: '2026-10-13', code: '201', icon: 'cloudy-sunny', pop: null, tMin: null, tMax: null },
    { date: '2026-10-14', code: '202', icon: 'rain-light', pop: 40, tMin: 14, tMax: 22 },
  ]);
});

test('normalizeJma: unknown area falls back to first; missing weekly -> []', () => {
  const j = Logic.normalizeJma([mini[0]], '999999');
  assert.equal(j.areaName, '北西部');
  assert.deepEqual(j.weekly, []);
});

test('normalizeJma: real fixture has 7 weekly days and 3h pops', () => {
  const j = Logic.normalizeJma(fx.jma, '120010');
  assert.ok(j.days.length >= 2);
  assert.equal(j.weekly.length, 7);
  assert.ok(j.pops.length >= 4);
  for (const d of j.weekly) assert.match(d.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('normalizeJma: selects non-first area by code for days and pops', () => {
  const j = Logic.normalizeJma(mini, '120030');
  assert.equal(j.areaName, '南部');
  assert.equal(j.days[0].weather, '晴れ');
  assert.deepEqual(j.pops.map((p) => p.pop), [20, 20, 20]);
});

test('normalizeJma: weekly area matched by code, temps taken at same index', () => {
  const multi = JSON.parse(JSON.stringify(mini));
  multi[1].timeSeries[0].areas.push({ area: { name: '伊豆', code: '120030' }, weatherCodes: ['300', '400'], pops: ['70', '80'], reliabilities: ['', ''] });
  multi[1].timeSeries[1].areas.push({ area: { name: '伊豆点', code: '99999' }, tempsMin: ['10', '11'], tempsMax: ['18', '19'] });
  const j = Logic.normalizeJma(multi, '120030');
  assert.deepEqual(j.weekly[1], { date: '2026-10-14', code: '400', icon: 'snow', pop: 80, tMin: 11, tMax: 19 });
  const first = Logic.normalizeJma(multi, '120010');
  assert.equal(first.weekly[1].code, '202');
  assert.equal(first.weekly[1].tMax, 22);
});
