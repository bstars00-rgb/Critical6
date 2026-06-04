import { describe, it, expect } from 'vitest';
import { createMockClient } from './mockClient';

describe('mock client — query builder', () => {
  it('selects with eq filter and order', async () => {
    const c = createMockClient();
    const { data } = await c.from('key_results').select('*').eq('status', 'at_risk');
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r: any) => r.status === 'at_risk')).toBe(true);
  });

  it('seeded KR progress is derived from current/target', async () => {
    const c = createMockClient();
    const { data } = await c.from('key_results').select('*').eq('id', '40000001-0000-0000-0000-000000000001').single();
    expect(data.progress).toBe(64); // 640 / 1000
  });

  it('head+count returns count without rows', async () => {
    const c = createMockClient();
    const { data, count } = await c.from('critical_six')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', '33333333-3333-3333-3333-333333333333')
      .in('status', ['not_started', 'in_progress', 'at_risk', 'delayed']);
    expect(data).toBeNull();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it('resolves embedded select (team_members → users)', async () => {
    const c = createMockClient();
    const { data } = await c.from('team_members').select('user_id, team_role, users(*)').eq('team_id', 'a0000001-0000-0000-0000-000000000001');
    expect(data[0].users).toBeTruthy();
    expect(data[0].users.full_name).toBeDefined();
    expect(data[0].team_role).toBeDefined();
  });

  it('resolves aliased embed (crm_opportunities → account)', async () => {
    const c = createMockClient();
    const { data } = await c.from('crm_opportunities').select('*, account:crm_accounts(company_name, market)').order('expected_close_date');
    expect(data[0].account?.company_name).toBeDefined();
  });

  it('insert assigns id + derives, then is queryable', async () => {
    const c = createMockClient();
    const { data: created } = await c.from('key_results')
      .insert({ objective_id: '70000001-0000-0000-0000-000000000001', title: 'KR new', target_value: 200, current_value: 100, status: 'in_progress' })
      .select('*').single();
    expect(created.id).toBeTruthy();
    expect(created.progress).toBe(50);
    const { data } = await c.from('key_results').select('*').eq('id', created.id).maybeSingle();
    expect(data.title).toBe('KR new');
  });

  it('update mutates and re-derives progress', async () => {
    const c = createMockClient();
    const id = '40000005-0000-0000-0000-000000000005';
    const { data } = await c.from('key_results').update({ current_value: 100 }).eq('id', id).select('*').single();
    expect(data.progress).toBe(100);
    expect(data.status).toBe('completed');
  });

  it('upsert respects onConflict keys', async () => {
    const c = createMockClient();
    const conflict = { related_type: 'key_result', related_id: '40000001-0000-0000-0000-000000000001', user_id: '33333333-3333-3333-3333-333333333333', week_start_date: '2026-06-01' };
    await c.from('cfr_checkins').upsert({ ...conflict, progress_summary: 'updated' }, { onConflict: 'related_type,related_id,user_id,week_start_date' }).select('*').single();
    const { data } = await c.from('cfr_checkins').select('*').match(conflict);
    expect(data.length).toBe(1);              // no duplicate row
    expect(data[0].progress_summary).toBe('updated');
  });

  it('delete removes matching rows', async () => {
    const c = createMockClient();
    const { data: before } = await c.from('action_plans').select('*');
    const victim = before[0].id;
    await c.from('action_plans').delete().eq('id', victim);
    const { data: after } = await c.from('action_plans').select('*').eq('id', victim);
    expect(after.length).toBe(0);
  });
});

describe('mock client — auth', () => {
  it('signs in by email and exposes the user', async () => {
    const c = createMockClient();
    await c.auth.signInWithPassword({ email: 'leader@company.com', password: 'x' });
    const { data } = await c.auth.getUser();
    expect(data.user?.id).toBe('33333333-3333-3333-3333-333333333333');
  });
});
