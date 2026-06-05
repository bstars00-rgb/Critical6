import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const files = process.argv.slice(2);
for (const f of files) {
  console.log('\n\n=========================================================');
  console.log('FILE:', f);
  console.log('=========================================================');
  const wb = XLSX.readFile(f);
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
    console.log(`\n--- SHEET: "${name}"  (${rows.length} rows) ---`);
    rows.slice(0, 50).forEach((r, i) => {
      const cells = r.map((c) => String(c).replace(/\s+/g, ' ').trim());
      if (cells.some(Boolean)) console.log(`[${i}] ${cells.join(' | ')}`);
    });
    if (rows.length > 50) console.log(`... (+${rows.length - 50} more rows)`);
  }
}
