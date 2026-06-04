import { supabase } from '@/lib/supabase';
import { makeCrud } from './crud';
import type { CrmStage } from '@/types';

export interface CrmAccount {
  id: string; company_name: string; country: string | null; market: string | null;
  account_owner_id: string | null; account_status: string; account_grade: string | null;
  expected_revenue: number | null; actual_revenue: number | null;
  last_contact_date: string | null; next_followup_date: string | null;
  related_key_result_id: string | null; memo: string | null;
}
export interface CrmOpportunity {
  id: string; opportunity_name: string; account_id: string; owner_id: string | null;
  stage: CrmStage; expected_revenue: number | null; probability: number | null;
  expected_close_date: string | null; related_key_result_id: string | null;
  next_action: string | null; risk_level: string; memo: string | null;
}

const accountCrud = makeCrud<CrmAccount>('crm_accounts');
const oppCrud = makeCrud<CrmOpportunity>('crm_opportunities');

export const PIPELINE_STAGES: CrmStage[] = [
  'lead', 'contacted', 'meeting', 'proposal', 'negotiation', 'contract', 'integration', 'active',
];
export const STAGE_LABEL: Record<CrmStage, string> = {
  lead: 'Lead', contacted: 'Contacted', meeting: 'Meeting', proposal: 'Proposal',
  negotiation: 'Negotiation', contract: 'Contract', integration: 'Integration',
  active: 'Active', lost: 'Lost', on_hold: 'On Hold',
};

export const crmService = {
  accounts: () => accountCrud.list({ order: { column: 'company_name' } }),
  createAccount: accountCrud.create,
  updateAccount: accountCrud.update,

  async opportunities(): Promise<(CrmOpportunity & { account?: { company_name: string; market: string | null; actual_revenue: number | null } })[]> {
    const { data, error } = await supabase
      .from('crm_opportunities')
      .select('*, account:crm_accounts(company_name, market, actual_revenue)')
      .order('expected_close_date');
    if (error) throw error;
    return (data ?? []) as any;
  },
  createOpportunity: oppCrud.create,
  moveStage: (id: string, stage: CrmStage) => oppCrud.update(id, { stage }),

  // Follow-ups due within 7 days or overdue.
  async followUpsDue(): Promise<CrmAccount[]> {
    const horizon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const { data } = await supabase
      .from('crm_accounts').select('*')
      .not('next_followup_date', 'is', null)
      .lte('next_followup_date', horizon)
      .order('next_followup_date');
    return (data ?? []) as CrmAccount[];
  },

  // Weighted pipeline (expected*prob) vs actual revenue, grouped by market.
  async pipelineVsRevenue() {
    const [opps, accs] = await Promise.all([this.opportunities(), this.accounts()]);
    const byMarket = new Map<string, { market: string; pipeline: number; actual: number }>();
    const bump = (market: string, field: 'pipeline' | 'actual', v: number) => {
      const key = market || '기타';
      const e = byMarket.get(key) ?? { market: key, pipeline: 0, actual: 0 };
      e[field] += v; byMarket.set(key, e);
    };
    for (const o of opps) {
      if (o.stage === 'lost' || o.stage === 'on_hold') continue;
      bump(o.account?.market ?? '기타', 'pipeline', (o.expected_revenue ?? 0) * (o.probability ?? 0) / 100);
    }
    for (const a of accs) bump(a.market ?? '기타', 'actual', a.actual_revenue ?? 0);
    return [...byMarket.values()].map((e) => ({
      market: e.market, pipeline: Math.round(e.pipeline), actual: Math.round(e.actual),
    }));
  },
};
