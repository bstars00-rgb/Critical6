// Minimal in-memory stand-in for the Supabase JS client. Implements just the
// subset of the PostgREST + Auth API the app uses, so every service/page works
// unchanged against demo data (GitHub Pages prototype, no backend).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildDemoDb, type DemoDb } from './data';

// Foreign keys for embedded selects: `${table}.${embeddedTable}` -> fk column.
const RELATIONS: Record<string, string> = {
  'team_members.users': 'user_id',
  'objectives.teams': 'team_id',
  'crm_opportunities.crm_accounts': 'account_id',
};

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}`);
const nowIso = () => new Date().toISOString();

function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

interface Embed { key: string; table: string; cols: string[]; fk: string }

function parseSelect(table: string, select: string): { embeds: Embed[] } {
  const embeds: Embed[] = [];
  for (const tok of splitTopLevel(select)) {
    const m = tok.match(/^(?:(\w+):)?(\w+)\(([^)]*)\)$/);
    if (m) {
      const [, alias, tbl, inner] = m;
      embeds.push({
        key: alias ?? tbl, table: tbl,
        cols: inner.trim() === '*' ? ['*'] : inner.split(',').map((c) => c.trim()),
        fk: RELATIONS[`${table}.${tbl}`] ?? `${tbl}_id`,
      });
    }
  }
  return { embeds };
}

function applyDerived(table: string, row: any) {
  if (table === 'key_results') {
    const t = row.target_value, c = row.current_value ?? 0, b = row.baseline_value ?? 0;
    row.progress = t && t - b !== 0 ? Math.round(Math.max(0, Math.min(100, ((c - b) / (t - b)) * 100)) * 100) / 100 : (row.progress ?? 0);
    if (row.progress >= 100 && row.status !== 'cancelled') row.status = 'completed';
  }
  if (table === 'kpis') {
    const t = row.target_value, c = row.current_value;
    if (t) {
      row.achievement_rate = Math.round((c ?? 0) / t * 10000) / 100;
      row.status = c == null ? 'no_data' : row.achievement_rate >= 100 ? 'on_track' : row.achievement_rate >= 80 ? 'at_risk' : 'off_track';
    }
  }
  return row;
}

class QueryBuilder {
  private filters: ((r: any) => boolean)[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private selectStr = '*';
  private values: any = null;
  private onConflict: string | null = null;
  private _single = false; private _maybe = false; private _head = false;
  private _count: string | null = null; private _limit: number | null = null;

  constructor(private db: DemoDb, private table: string) {}

  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') this.selectStr = cols ?? '*';
    if (opts?.count) this._count = opts.count;
    if (opts?.head) this._head = true;
    return this;
  }
  insert(v: any) { this.op = 'insert'; this.values = v; return this; }
  update(v: any) { this.op = 'update'; this.values = v; return this; }
  upsert(v: any, opts?: { onConflict?: string }) { this.op = 'upsert'; this.values = v; this.onConflict = opts?.onConflict ?? null; return this; }
  delete() { this.op = 'delete'; return this; }

  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  is(c: string, v: any) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  in(c: string, arr: any[]) { this.filters.push((r) => arr.includes(r[c])); return this; }
  not(c: string, op: string, v: any) { if (op === 'is' && v === null) this.filters.push((r) => r[c] != null); return this; }
  lte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] <= v); return this; }
  gte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] >= v); return this; }
  match(obj: Record<string, any>) { for (const [k, v] of Object.entries(obj)) this.filters.push((r) => r[k] === v); return this; }
  order(c: string, opts?: { ascending?: boolean }) { this.orders.push({ col: c, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this._limit = n; return this; }
  maybeSingle() { this._maybe = true; return this; }
  single() { this._single = true; return this; }

  private table_(): any[] { return (this.db[this.table] ??= []); }
  private match_(): any[] { return this.table_().filter((r) => this.filters.every((f) => f(r))); }

  private project(rows: any[]): any[] {
    const { embeds } = parseSelect(this.table, this.selectStr);
    return rows.map((row) => {
      const out = { ...row };
      for (const e of embeds) {
        const target = (this.db[e.table] ?? []).find((t) => t.id === row[e.fk]);
        out[e.key] = target
          ? (e.cols[0] === '*' ? { ...target } : Object.fromEntries(e.cols.map((c) => [c, target[c]])))
          : null;
      }
      return out;
    });
  }

  private run(): { data: any; error: any; count: number | null } {
    try {
      if (this.op === 'insert' || this.op === 'upsert') {
        const rows = Array.isArray(this.values) ? this.values : [this.values];
        const saved = rows.map((v) => {
          if (this.op === 'upsert' && this.onConflict) {
            const keys = this.onConflict.split(',').map((k) => k.trim());
            const existing = this.table_().find((r) => keys.every((k) => r[k] === v[k]));
            if (existing) { Object.assign(existing, v, { updated_at: nowIso() }); return applyDerived(this.table, existing); }
          }
          const row = applyDerived(this.table, { id: v.id ?? uid(), created_at: nowIso(), updated_at: nowIso(), ...v });
          this.table_().push(row);
          return row;
        });
        const projected = this.project(saved);
        return { data: this._single || this._maybe ? projected[0] ?? null : projected, error: null, count: null };
      }
      if (this.op === 'update') {
        const updated = this.match_().map((r) => applyDerived(this.table, Object.assign(r, this.values, { updated_at: nowIso() })));
        const projected = this.project(updated);
        return { data: this._single || this._maybe ? projected[0] ?? null : projected, error: null, count: null };
      }
      if (this.op === 'delete') {
        const keep = this.table_().filter((r) => !this.filters.every((f) => f(r)));
        this.db[this.table] = keep;
        return { data: null, error: null, count: null };
      }
      // select
      let rows = this.match_();
      const count = this._count ? rows.length : null;
      for (const o of [...this.orders].reverse()) {
        rows = rows.sort((a, b) => (a[o.col] > b[o.col] ? 1 : a[o.col] < b[o.col] ? -1 : 0) * (o.asc ? 1 : -1));
      }
      if (this._limit != null) rows = rows.slice(0, this._limit);
      if (this._head) return { data: null, error: null, count };
      const projected = this.project(rows);
      if (this._single || this._maybe) return { data: projected[0] ?? null, error: null, count };
      return { data: projected, error: null, count };
    } catch (e: any) {
      return { data: null, error: { message: String(e?.message ?? e) }, count: null };
    }
  }

  // Thenable: lets `await supabase.from(...).select()...` resolve at any point.
  then<T1 = any, T2 = never>(
    onfulfilled?: ((value: any) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve().then(() => this.run()).then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

function createAuth(db: DemoDb) {
  let cb: ((event: string, session: any) => void) | null = null;
  const KEY = 'demo_uid';
  const hasLS = typeof localStorage !== 'undefined';
  const sessionFor = (id: string | null) => (id ? { user: { id } } : null);
  // In-memory session is the source of truth; localStorage is optional persistence.
  let currentId: string | null = hasLS ? localStorage.getItem(KEY) : null;

  return {
    async getSession() { return { data: { session: sessionFor(currentId) }, error: null }; },
    async getUser() { return { data: { user: currentId ? { id: currentId } : null }, error: null }; },
    async signInWithPassword({ email }: { email: string; password: string }) {
      const u = db.users.find((x) => x.email === email) ?? db.users[0];
      currentId = u.id;
      if (hasLS) localStorage.setItem(KEY, u.id);
      cb?.('SIGNED_IN', sessionFor(u.id));
      return { data: { user: { id: u.id } }, error: null };
    },
    // Demo signup: create an in-memory profile and sign in (no real backend).
    async signUp({ email, options }: { email: string; password: string; options?: { data?: any } }) {
      let u = db.users.find((x) => x.email === email);
      if (!u) {
        u = { id: uid(), email, full_name: options?.data?.full_name ?? email.split('@')[0], role: 'member', is_active: true, settings: {}, created_at: nowIso(), updated_at: nowIso(), created_by: null, updated_by: null };
        db.users.push(u);
      }
      currentId = u.id;
      if (hasLS) localStorage.setItem(KEY, u.id);
      cb?.('SIGNED_IN', sessionFor(u.id));
      return { data: { user: { id: u.id }, session: { user: { id: u.id } } }, error: null };
    },
    async signOut() {
      currentId = null;
      if (hasLS) localStorage.removeItem(KEY);
      cb?.('SIGNED_OUT', null);
      return { error: null };
    },
    onAuthStateChange(fn: (e: string, s: any) => void) {
      cb = fn;
      return { data: { subscription: { unsubscribe() { cb = null; } } } };
    },
  };
}

export function createMockClient() {
  const db = buildDemoDb();
  return {
    __demo: true,
    auth: createAuth(db),
    from(table: string) { return new QueryBuilder(db, table); },
  };
}
