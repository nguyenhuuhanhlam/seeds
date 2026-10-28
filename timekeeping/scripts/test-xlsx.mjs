import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
await build({
  entryPoints: ['/home/hatch/workspace/seeds/timekeeping/src/lib/export-xlsx.js'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile: '/tmp/tk-xlsx.cjs',
  logLevel: 'silent',
});
const { buildXlsxBlob } = createRequire(import.meta.url)('/tmp/tk-xlsx.cjs');
const data = JSON.parse(readFileSync('/tmp/sample-ts2.json', 'utf-8'));
const info = {
  101: { name: 'Nguyễn Minh An', dept: 'Kiến trúc' },
  102: { name: 'Trần Thu Hà', dept: 'Kết cấu' },
  103: { name: 'Lê Quốc Bảo', dept: 'Kiến trúc' },
};
const blob = await buildXlsxBlob(data, info);
writeFileSync('/tmp/sample-ts.xlsx', Buffer.from(await blob.arrayBuffer()));
console.log('xlsx bytes:', blob.size);
