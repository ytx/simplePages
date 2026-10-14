process.env.TZ = 'Asia/Tokyo';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadLogic(htmlPath) {
  const html = readFileSync(htmlPath, 'utf8');
  const m = html.match(/<script id="app-logic">([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`app-logic script not found in ${htmlPath}`);
  const factory = vm.runInThisContext(`(function () {${m[1]}\n;return Logic;})`, { filename: htmlPath });
  return factory();
}
