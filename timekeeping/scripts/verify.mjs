// Kiểm chứng src/lib/timekeeping.ts bằng node (không cần trình duyệt).
//   node scripts/verify.mjs <log-file> <YYYY-MM> [out-json]
// In bảng tóm tắt từng user ra stdout; nếu có out-json thì ghi full JSON
// (cùng cấu trúc với bản Python) để diff với kết quả Python.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [logPath, monthStr, outJson] = process.argv.slice(2);
if (!logPath || !monthStr) {
  console.error('Dùng: node scripts/verify.mjs <log-file> <YYYY-MM> [out-json]');
  process.exit(2);
}
const outDir = join(tmpdir(), 'tk-verify');
mkdirSync(outDir, { recursive: true });
const bundlePath = join(outDir, 'timekeeping.mjs');
await build({
  entryPoints: [new URL('../src/lib/timekeeping.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'silent',
});
const tk = await import(pathToFileURL(bundlePath).href);
const text = readFileSync(logPath, 'utf-8');
const month = tk.parseMonthArg(monthStr);
const data = tk.buildJson(tk.parseRawLines(text, month), month);
for (const [uid, u] of Object.entries(data).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  const s = u.summary;
  console.log(
    `uid=${uid} cong_lam=${s['Công làm']} lan_tre=${s['Số lần trễ']} ` +
      `tong_tre=${s['Tổng Trễ (phút)']} tong_cong_tre=${s['Tổng Công Trễ']} ` +
      `tong_tg=${s['Tổng TG (hours)']} tong_congtg=${s['Tổng CôngTG']} ` +
      `tong_lt=${s['Tổng LT (phút)']} tong_cong_lt=${s['Tổng Công LT']}`,
  );
}
if (outJson) writeFileSync(outJson, JSON.stringify(data, null, 2), 'utf-8');
