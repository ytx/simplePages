// 気象庁 area.json の offices から JMA_OFFICES 配列を生成する。
// 使い方: node weather/tools/gen-jma-offices.mjs > offices.txt
// 出力を weather/index.html の `const JMA_OFFICES = [...]` に貼り付ける。
const PREF = [null, '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県',
  '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県',
  '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'];

const res = await fetch('https://www.jma.go.jp/bosai/common/const/area.json');
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const area = await res.json();
const rows = Object.entries(area.offices)
  .map(([code, o]) => ({ code, name: o.name, enName: o.enName, pref: PREF[Number.parseInt(code.slice(0, 2), 10)] }))
  .sort((a, b) => a.code.localeCompare(b.code));
for (const r of rows) if (!r.pref) throw new Error(`no prefecture for ${r.code}`);
process.stdout.write(rows.map((r) => '    ' + JSON.stringify(r)).join(',\n') + '\n');
