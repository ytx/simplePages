import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogic } from './load-logic.mjs';

const Logic = loadLogic(fileURLToPath(new URL('../index.html', import.meta.url)));
const fx = (name) => new URL('./fixtures/' + name, import.meta.url);

test('normalizeUrl strips query, hash, .php tail and lowercases the scheme', () => {
  assert.equal(Logic.normalizeUrl('https://h/zabbix/zabbix.php?action=dashboard.view'), 'https://h/zabbix');
  assert.equal(Logic.normalizeUrl('HTTPS://H/zabbix/'), 'https://H/zabbix');
  assert.equal(Logic.normalizeUrl('https://h/zabbix#x'), 'https://h/zabbix');
});

test('normalizeUrl', () => {
  assert.equal(Logic.normalizeUrl('https://z.example.com/zabbix/'), 'https://z.example.com/zabbix');
  assert.equal(Logic.normalizeUrl('https://z.example.com/zabbix/api_jsonrpc.php'), 'https://z.example.com/zabbix');
  assert.equal(Logic.normalizeUrl(' http://10.0.0.1 '), 'http://10.0.0.1');
  assert.equal(Logic.normalizeUrl('z.example.com'), '');
  assert.equal(Logic.normalizeUrl(''), '');
});
test('parseList', () => { assert.deepEqual(Logic.parseList(' a, b ,,c '), ['a', 'b', 'c']); assert.deepEqual(Logic.parseList(''), []); });
test('apiRequest and apiResult', () => {
  assert.deepEqual(Logic.apiRequest('host.get', { output: ['hostid'] }, 'tok', 3), { jsonrpc: '2.0', id: 3, method: 'host.get', params: { output: ['hostid'] }, auth: 'tok' });
  assert.equal(Logic.apiRequest('apiinfo.version', {}, '', 1).auth, null);
  assert.deepEqual(Logic.apiResult({ jsonrpc: '2.0', id: 1, result: [1] }), { ok: true, result: [1] });
  assert.deepEqual(Logic.apiResult({ jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'Invalid params.', data: 'Not authorized.' } }), { ok: false, error: 'Not authorized.' });
  assert.deepEqual(Logic.apiResult({ jsonrpc: '2.0', id: 1, error: { message: 'Boom' } }), { ok: false, error: 'Boom' });
  assert.equal(Logic.apiResult(null).ok, false);
});
test('orderHosts filters and reorders by display or technical name', () => {
  const hosts = JSON.parse(readFileSync(fx('host.json'), 'utf8'));
  assert.deepEqual(Logic.orderHosts(hosts, ['delta', 'alpha (web)', 'nope', 'delta']).map((h) => h.host), ['delta', 'alpha']);
  assert.equal(Logic.orderHosts(hosts, []), hosts);
});
