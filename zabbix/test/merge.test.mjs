import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));
const fx = (name) => new URL('./fixtures/' + name, import.meta.url);

const hosts = JSON.parse(readFileSync(fx('host.json'), 'utf8'));
const problems = JSON.parse(readFileSync(fx('problem.json'), 'utf8'));
const triggers = JSON.parse(readFileSync(fx('trigger.json'), 'utf8'));

test('mergeData keeps in-scope problems, worst severity per host, disabled, names, summary', () => {
  const m = Logic.mergeData(hosts, problems, triggers);
  assert.deepEqual(m.problems.map((p) => [p.eventid, p.hostName]), [['905', 'alpha (web)'], ['904', 'charlie'], ['903', 'bravo (db)']]); // 902 dropped (no in-scope host)
  assert.deepEqual(m.hosts.map((h) => [h.host, h.severity, h.disabled]), [['alpha', 3, false], ['bravo', 5, false], ['charlie', 4, true], ['delta', -1, false]]);
  assert.deepEqual(m.summary, { hostsTotal: 4, hostsOk: 1, hostsBad: 3, problems: 3, bySeverity: [0, 0, 0, 1, 1, 1] });
  assert.deepEqual(m.hosts.map(Logic.hostColorKey), ['sev3', 'sev5', 'disabled', 'ok']);
});
test('mergeData with no problems', () => { const m = Logic.mergeData(hosts, [], []); assert.equal(m.summary.hostsOk, 3); assert.equal(m.summary.hostsBad, 1); });
