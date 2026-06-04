// Pure CSV helpers — no IO, unit-tested in csv.test.ts.

export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

/** Minimal CSV parser: comma-delimited, first line = headers, quotes stripped. */
export function parseCsv(text: string): CsvTable {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n').filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const split = (line: string) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const headers = split(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = split(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });
  return { headers, rows };
}

/**
 * Resolve a single numeric reading from a parsed CSV given a column and an
 * optional row match. Used by CsvAdapter to map a file → one KPI value.
 */
export function pickMetric(
  table: CsvTable,
  opts: { column: string; match?: Record<string, string> },
): number {
  const candidates = table.rows.filter((r) =>
    !opts.match || Object.entries(opts.match).every(([k, v]) => r[k] === v),
  );
  if (candidates.length === 0) throw new Error(`no row matches ${JSON.stringify(opts.match ?? {})}`);
  const raw = candidates[candidates.length - 1][opts.column];
  const value = Number(raw);
  if (Number.isNaN(value)) throw new Error(`column "${opts.column}" is not numeric: "${raw}"`);
  return value;
}

/**
 * external_id,value rows → simple list (used by the KPI bulk CSV import).
 * Empty value cells are DROPPED, not coerced — `Number('')` is 0 in JS, which
 * would silently zero out a KPI.
 */
export function parseKpiCsv(text: string): { external_id: string; value: number }[] {
  return parseCsv(text).rows
    .filter((r) => r.external_id && r.value != null && r.value.trim() !== '' && !Number.isNaN(Number(r.value)))
    .map((r) => ({ external_id: r.external_id, value: Number(r.value) }));
}
