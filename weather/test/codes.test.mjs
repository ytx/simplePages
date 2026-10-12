import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Logic } from './logic.test.mjs';

test('jmaCodeToIcon: major codes', () => {
  assert.equal(Logic.jmaCodeToIcon('100'), 'sunny');
  assert.equal(Logic.jmaCodeToIcon('101'), 'sunny-cloudy');
  assert.equal(Logic.jmaCodeToIcon('111'), 'sunny-cloudy');
  assert.equal(Logic.jmaCodeToIcon('102'), 'rain-light');
  assert.equal(Logic.jmaCodeToIcon('112'), 'rain-light');
  assert.equal(Logic.jmaCodeToIcon('104'), 'snow');
  assert.equal(Logic.jmaCodeToIcon('200'), 'cloudy');
  assert.equal(Logic.jmaCodeToIcon('201'), 'cloudy-sunny');
  assert.equal(Logic.jmaCodeToIcon('211'), 'cloudy-sunny');
  assert.equal(Logic.jmaCodeToIcon('202'), 'rain-light');
  assert.equal(Logic.jmaCodeToIcon('300'), 'rain');
  assert.equal(Logic.jmaCodeToIcon('301'), 'rain');
  assert.equal(Logic.jmaCodeToIcon('303'), 'sleet');
  assert.equal(Logic.jmaCodeToIcon('308'), 'rain-heavy');
  assert.equal(Logic.jmaCodeToIcon('400'), 'snow');
  assert.equal(Logic.jmaCodeToIcon('403'), 'sleet');
  assert.equal(Logic.jmaCodeToIcon('140'), 'thunder');
  assert.equal(Logic.jmaCodeToIcon('350'), 'thunder');
  assert.equal(Logic.jmaCodeToIcon(''), 'unknown');
  assert.equal(Logic.jmaCodeToIcon(null), 'unknown');
  assert.equal(Logic.jmaCodeToIcon('999'), 'unknown');
});

test('wmoCodeToIcon', () => {
  assert.equal(Logic.wmoCodeToIcon(0), 'sunny');
  assert.equal(Logic.wmoCodeToIcon(1), 'sunny-cloudy');
  assert.equal(Logic.wmoCodeToIcon(2), 'cloudy-sunny');
  assert.equal(Logic.wmoCodeToIcon(3), 'cloudy');
  assert.equal(Logic.wmoCodeToIcon(45), 'fog');
  assert.equal(Logic.wmoCodeToIcon(51), 'rain-light');
  assert.equal(Logic.wmoCodeToIcon(61), 'rain-light');
  assert.equal(Logic.wmoCodeToIcon(63), 'rain');
  assert.equal(Logic.wmoCodeToIcon(65), 'rain-heavy');
  assert.equal(Logic.wmoCodeToIcon(66), 'sleet');
  assert.equal(Logic.wmoCodeToIcon(71), 'snow');
  assert.equal(Logic.wmoCodeToIcon(80), 'rain-light');
  assert.equal(Logic.wmoCodeToIcon(82), 'rain-heavy');
  assert.equal(Logic.wmoCodeToIcon(85), 'snow');
  assert.equal(Logic.wmoCodeToIcon(95), 'thunder');
  assert.equal(Logic.wmoCodeToIcon(42), 'unknown');
  assert.equal(Logic.wmoCodeToIcon(null), 'unknown');
});

test('wmoCodeToText', () => {
  assert.equal(Logic.wmoCodeToText('ja', 0), '快晴');
  assert.equal(Logic.wmoCodeToText('en', 2), 'Partly cloudy');
  assert.equal(Logic.wmoCodeToText('en', 999), '');
});

test('worstIcon picks most severe', () => {
  assert.equal(Logic.worstIcon(['sunny', 'cloudy', 'rain-light']), 'rain-light');
  assert.equal(Logic.worstIcon(['snow', 'thunder', 'rain']), 'thunder');
  assert.equal(Logic.worstIcon(['unknown', 'sunny']), 'sunny');
  assert.equal(Logic.worstIcon([]), 'unknown');
});
