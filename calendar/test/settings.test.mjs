// calendar/test/settings.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const htmlPath = fileURLToPath(new URL('../index.html', import.meta.url));
const Logic = loadLogic(htmlPath);
const html = readFileSync(htmlPath, 'utf8');

test('i18n has calendar keys in both languages', () => {
  const keys = ['tab_connection', 'gas_url', 'token', 'conn_list', 'conn_ok', 'conn_failed', 'invalid_url', 'calendars_label', 'no_calendars',
    'gas_steps_title', 'gas_step1', 'gas_step2', 'gas_step3', 'gas_step4', 'gas_step5', 'gas_code_label', 'storage_note',
    'set_connection_hint', 'prev', 'today', 'next', 'view_day', 'view_week', 'view_month', 'all_day', 'more', 'untitled',
    'default_view', 'week_start', 'week_start_sun', 'week_start_mon', 'day_start', 'day_end', 'return_minutes',
    'partial_errors', 'invalid_response', 'err_unauthorized', 'calendar_label', 'location_label'];
  for (const k of keys) {
    assert.equal(typeof Logic.I18N.ja[k], 'string', `ja.${k}`);
    assert.equal(typeof Logic.I18N.en[k], 'string', `en.${k}`);
  }
  assert.equal(Logic.I18N.ja.placeholder_content, undefined);
});

test('app-ui schema declares the calendar settings and display-only keys', () => {
  const ui = html.match(/<script id="app-ui">([\s\S]*?)<\/script>/)[1];
  for (const k of ['gasUrl', 'token', 'calendars', 'view', 'weekStart', 'dayStart', 'dayEnd', 'returnToTodayMinutes']) {
    assert.match(ui, new RegExp(`\\b${k}:\\s*\\{\\s*type:`), `SCHEMA.${k}`);
  }
  assert.match(ui, /DISPLAY_ONLY_KEYS = new Set\(\['theme', 'zoom', 'lang', 'view', 'weekStart', 'dayStart', 'dayEnd', 'returnToTodayMinutes'\]\)/);
});

test('settings schema coerces as the spec says', () => {
  const schema = {
    view: { type: 'enum', values: ['day', 'week', 'month'], default: 'week' },
    weekStart: { type: 'enum', values: [0, 1], default: 0 },
    dayStart: { type: 'int', min: 0, max: 23, default: 6 },
    dayEnd: { type: 'int', min: 1, max: 24, default: 23 },
    returnToTodayMinutes: { type: 'int', min: 0, max: 60, default: 5 },
    gasUrl: { type: 'string', default: '' },
    calendars: { type: 'object', default: [] },
  };
  const s = Logic.resolveSettings(schema, { calendars: [{ id: 'a' }] }, { view: 'month', weekStart: '1', dayStart: '8', dayEnd: '99', returnToTodayMinutes: '0' });
  assert.equal(s.view, 'month');
  assert.equal(s.weekStart, 1);
  assert.equal(s.dayStart, 8);
  assert.equal(s.dayEnd, 23);
  assert.equal(s.returnToTodayMinutes, 0);
  assert.deepEqual(s.calendars, [{ id: 'a' }]);
  assert.equal(Logic.resolveSettings(schema, {}, { view: 'year' }).view, 'week');
});
