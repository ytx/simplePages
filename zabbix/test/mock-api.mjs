// 開発用ヘルパー(テストではない)。Zabbix 6.0 の api_jsonrpc.php を fixtures から真似て返し、
// リポジトリルートを静的配信する。
//   node zabbix/test/mock-api.mjs 8790 [--hosts N] [--fail]
//   http://localhost:8790/zabbix/?zabbixUrl=http://localhost:8790/zabbix&token=t&hostGroups=Linux%20servers
// 実行中の切替: GET /__mock?fail=1|0&hosts=N
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const FIX = { group: fx('hostgroup'), host: fx('host'), problem: fx('problem'), trigger: fx('trigger') };

const args = process.argv.slice(2);
const port = Number(args.find((a) => /^\d+$/.test(a))) || 8790;
const state = { hosts: 0, fail: args.includes('--fail') };
const hi = args.indexOf('--hosts');
if (hi >= 0) state.hosts = Number(args[hi + 1]) || 0;

function hostList() {
  if (!state.hosts) return FIX.host;
  const nn = (i) => String(i + 1).padStart(2, '0');
  return Array.from({ length: state.hosts }, (_, i) => ({
    hostid: String(20000 + i), host: `host${nn(i)}`, name: `host${nn(i)} (role${nn(i)})`, status: i === 2 ? '1' : '0',
  }));
}

// 合成ホストのときも fixture の障害を先頭のホストに載せる(10084+k -> 20000+k)。
function triggerList() {
  if (!state.hosts) return FIX.trigger;
  const hosts = hostList();
  return FIX.trigger.map((t) => ({
    ...t,
    hosts: t.hosts.map((h) => {
      const k = Number(h.hostid) - 10084;
      return k >= 0 && k < 4 && hosts[k] ? { hostid: hosts[k].hostid, name: hosts[k].name } : h;
    }),
  }));
}

function handle(method, params) {
  switch (method) {
    case 'apiinfo.version': return { result: '6.0.34' };
    case 'hostgroup.get': {
      const names = params && params.filter && params.filter.name;
      return { result: FIX.group.filter((g) => !names || names.length === 0 || names.includes(g.name)) };
    }
    case 'host.get': return { result: hostList().slice().sort((a, b) => a.name.localeCompare(b.name)) };
    case 'problem.get': {
      const sev = params && params.severities;
      return { result: FIX.problem.filter((p) => !sev || sev.includes(Number(p.severity))).sort((a, b) => Number(b.eventid) - Number(a.eventid)) };
    }
    case 'trigger.get': {
      const ids = params && params.triggerids;
      return { result: triggerList().filter((t) => !ids || ids.includes(t.triggerid)) };
    }
    default: return { error: { code: -32601, message: 'Method not found.', data: `Incorrect API "${method}".` } };
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Max-Age': '1000',
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.md': 'text/plain; charset=utf-8' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/zabbix/api_jsonrpc.php') {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let q = {};
      try { q = JSON.parse(body); } catch { /* 空の要求として扱う */ }
      const out = state.fail
        ? { error: { code: -32602, message: 'Invalid params.', data: 'Not authorized.' } }
        : handle(q.method, q.params);
      res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: q.id, ...out }));
    });
    return;
  }
  if (url.pathname === '/__mock') {
    if (url.searchParams.has('fail')) state.fail = url.searchParams.get('fail') === '1';
    if (url.searchParams.has('hosts')) state.hosts = Number(url.searchParams.get('hosts')) || 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state));
    return;
  }
  let p;
  try { p = path.normalize(path.join(root, decodeURIComponent(url.pathname))); } catch { res.writeHead(400); res.end(); return; }
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (existsSync(p) && statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(p));
});
server.listen(port, '127.0.0.1', () => console.log(`mock zabbix on http://127.0.0.1:${port}/zabbix/  hosts=${state.hosts || 'fixture'} fail=${state.fail}`));
