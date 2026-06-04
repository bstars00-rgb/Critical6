import { describe, it, expect } from 'vitest';
import { parseCsv, pickMetric, parseKpiCsv } from './csv';
import { CsvAdapter, ManualAdapter } from './adapters';
import { getAdapter } from './registry';

describe('parseCsv', () => {
  it('parses headers and rows, stripping quotes and CRLF', () => {
    const t = parseCsv('market,"value"\r\nSEA,640\r\nCN,120\r\n');
    expect(t.headers).toEqual(['market', 'value']);
    expect(t.rows).toEqual([{ market: 'SEA', value: '640' }, { market: 'CN', value: '120' }]);
  });
  it('returns empty for blank input', () => {
    expect(parseCsv('   ')).toEqual({ headers: [], rows: [] });
  });
});

describe('pickMetric', () => {
  const t = parseCsv('market,value\nSEA,640\nCN,120');
  it('selects by column with a row match', () => {
    expect(pickMetric(t, { column: 'value', match: { market: 'CN' } })).toBe(120);
  });
  it('takes the last row when no match given', () => {
    expect(pickMetric(t, { column: 'value' })).toBe(120);
  });
  it('throws when the match finds nothing', () => {
    expect(() => pickMetric(t, { column: 'value', match: { market: 'EU' } })).toThrow();
  });
  it('throws on non-numeric cells', () => {
    const bad = parseCsv('value\nN/A');
    expect(() => pickMetric(bad, { column: 'value' })).toThrow(/not numeric/);
  });
});

describe('parseKpiCsv', () => {
  it('maps external_id,value rows and drops invalid', () => {
    const rows = parseKpiCsv('external_id,value\nmrr_sea,4200\nbad,\n,99\nactive_channels,640');
    expect(rows).toEqual([
      { external_id: 'mrr_sea', value: 4200 },
      { external_id: 'active_channels', value: 640 },
    ]);
  });
});

describe('adapters + registry', () => {
  it('CsvAdapter resolves a reading from config text', async () => {
    const r = await new CsvAdapter().fetchMetric({
      externalId: 'x',
      config: { text: 'market,value\nSEA,640', column: 'value', match: { market: 'SEA' } },
    });
    expect(r.value).toBe(640);
  });
  it('ManualAdapter is push-only and refuses fetch', async () => {
    await expect(new ManualAdapter().fetchMetric()).rejects.toThrow(/push-only/);
  });
  it('registry returns the right adapter per type', () => {
    expect(getAdapter('manual').type).toBe('manual');
    expect(getAdapter('csv').type).toBe('csv');
    expect(getAdapter('api_monitoring_db').type).toBe('api_monitoring_db');
  });
});
