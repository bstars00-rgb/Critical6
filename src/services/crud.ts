import { supabase } from '@/lib/supabase';

// Thin generic CRUD over a Supabase table. Entity services build on this and add
// joins/filters. created_by/updated_by are stamped from the current auth user.
export function makeCrud<Row extends { id: string }>(table: string) {
  return {
    async list(options?: {
      filter?: Record<string, unknown>;
      order?: { column: string; ascending?: boolean };
      select?: string;
    }): Promise<Row[]> {
      let q = supabase.from(table).select(options?.select ?? '*');
      if (options?.filter) {
        for (const [k, v] of Object.entries(options.filter)) {
          q = v === null ? q.is(k, null) : q.eq(k, v as never);
        }
      }
      if (options?.order) q = q.order(options.order.column, { ascending: options.order.ascending ?? true });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },

    async get(id: string, select = '*'): Promise<Row | null> {
      const { data, error } = await supabase.from(table).select(select).eq('id', id).maybeSingle();
      if (error) throw error;
      return (data as unknown as Row) ?? null;
    },

    async create(values: Partial<Row>): Promise<Row> {
      const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
      const { data, error } = await supabase
        .from(table)
        .insert({ ...values, created_by: uid, updated_by: uid })
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as Row;
    },

    async update(id: string, values: Partial<Row>): Promise<Row> {
      const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
      const { data, error } = await supabase
        .from(table)
        .update({ ...values, updated_by: uid })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as Row;
    },

    async remove(id: string): Promise<void> {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
  };
}
