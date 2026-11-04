# zabbix

Zabbix の API から取得したホストの状態と障害を横長 1 画面に常時表示するページ。

## テスト

```bash
node --test zabbix/test/*.test.mjs
```

手動確認用のモック API(テストではない): `node zabbix/test/mock-api.mjs 8790 [--hosts N] [--fail]`。リポジトリルートを静的配信し、`POST /zabbix/api_jsonrpc.php` を fixtures から返す。`http://localhost:8790/zabbix/?zabbixUrl=http://localhost:8790/zabbix&token=t&hostGroups=Linux%20servers` で開く。実行中は `GET /__mock?fail=1|0&hosts=N` で切り替えられる。
