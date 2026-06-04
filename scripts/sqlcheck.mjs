// Static syntax check of all SQL files using the real libpg_query parser.
// Catches syntax errors without needing a running Postgres/Docker.
import { parse, loadModule } from 'pgsql-parser';
import { readFileSync, readdirSync } from 'node:fs';

await loadModule();

const files = [
  ...readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).map((f) => `supabase/migrations/${f}`),
  'supabase/seed.sql',
].sort();

let ok = 0, fail = 0;
for (const f of files) {
  const sql = readFileSync(f, 'utf8');
  try {
    const stmts = await parse(sql);
    console.log(`OK   ${f}  (${stmts.length ?? '?'} statements)`);
    ok++;
  } catch (e) {
    console.log(`FAIL ${f}\n     ${String(e.message || e).split('\n')[0]}`);
    fail++;
  }
}
console.log(`\n${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
