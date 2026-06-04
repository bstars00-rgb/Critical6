// One-shot: add `dark:` variants next to known light-theme utility tokens across
// src/**/*.tsx. Standalone-token matching (lookbehind/ahead) so it never edits a
// substring of a longer class (e.g. won't touch bg-slate-100 inside .../60, and
// won't break hover:bg-slate-100). Run once on the committed (no-dark) source.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAP = [
  // opacity / hover variants first (explicit — base regex skips ':' and '/')
  ['bg-slate-100/60', 'dark:bg-slate-800/60'],
  ['bg-slate-100/40', 'dark:bg-slate-800/40'],
  ['bg-white/70', 'dark:bg-slate-700/60'],
  ['hover:bg-slate-100', 'dark:hover:bg-slate-700'],
  ['hover:bg-slate-50', 'dark:hover:bg-slate-800'],
  ['hover:text-brand-700', 'dark:hover:text-brand-300'],
  ['hover:text-slate-700', 'dark:hover:text-slate-200'],
  // text
  ['text-slate-900', 'dark:text-slate-100'],
  ['text-slate-800', 'dark:text-slate-100'],
  ['text-slate-700', 'dark:text-slate-200'],
  ['text-slate-600', 'dark:text-slate-300'],
  ['text-slate-500', 'dark:text-slate-400'],
  ['text-slate-400', 'dark:text-slate-500'],
  ['text-slate-300', 'dark:text-slate-600'],
  ['text-brand-700', 'dark:text-brand-300'],
  // backgrounds
  ['bg-white', 'dark:bg-slate-800'],
  ['bg-slate-50', 'dark:bg-slate-800'],
  ['bg-slate-100', 'dark:bg-slate-700'],
  ['bg-brand-50', 'dark:bg-slate-700'],
  // borders
  ['border-slate-300', 'dark:border-slate-600'],
  ['border-slate-200', 'dark:border-slate-700'],
  ['border-slate-100', 'dark:border-slate-700'],
  ['border-slate-50', 'dark:border-slate-800'],
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

let totalFiles = 0, totalEdits = 0;
for (const file of walk('src')) {
  let src = readFileSync(file, 'utf8');
  let edits = 0;
  for (const [light, dark] of MAP) {
    // standalone token: not preceded/followed by class-char, ':' or '/'
    const re = new RegExp(`(?<![\\w:/-])${esc(light)}(?![\\w:/-])`, 'g');
    src = src.replace(re, (m) => { edits++; return `${m} ${dark}`; });
  }
  if (edits) { writeFileSync(file, src); totalFiles++; totalEdits += edits; }
}
console.log(`dark variants added: ${totalEdits} tokens across ${totalFiles} files`);
