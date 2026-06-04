import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Plus, Bell, Link2 } from 'lucide-react';
import { crmService, PIPELINE_STAGES, STAGE_LABEL, type CrmOpportunity } from '@/services/crm';
import { keyResultsService } from '@/services/keyResults';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, Badge, Modal, Field, EmptyState } from '@/components/ui';
import type { CrmStage } from '@/types';

type Tab = 'pipeline' | 'accounts' | 'analysis';

export default function Crm() {
  const qc = useQueryClient();
  const profile = useAuthStore((s) => s.profile);
  const [tab, setTab] = useState<Tab>('pipeline');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ opportunity_name: '', account_id: '', stage: 'lead', expected_revenue: '', probability: '', related_key_result_id: '' });

  const accounts = useQuery({ queryKey: ['crm', 'accounts'], queryFn: () => crmService.accounts() });
  const opps = useQuery({ queryKey: ['crm', 'opps'], queryFn: () => crmService.opportunities() });
  const followUps = useQuery({ queryKey: ['crm', 'followups'], queryFn: () => crmService.followUpsDue() });
  const revenue = useQuery({ queryKey: ['crm', 'revenue'], queryFn: () => crmService.pipelineVsRevenue() });
  const krs = useQuery({ queryKey: ['kr', 'all'], queryFn: () => keyResultsService.list() });

  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: CrmStage }) => crmService.moveStage(id, stage),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm'] }),
  });
  const create = useMutation({
    mutationFn: () => crmService.createOpportunity({
      opportunity_name: form.opportunity_name, account_id: form.account_id, owner_id: profile?.id ?? null,
      stage: form.stage as CrmStage,
      expected_revenue: form.expected_revenue ? +form.expected_revenue : null,
      probability: form.probability ? +form.probability : null,
      related_key_result_id: form.related_key_result_id || null,
    } as Partial<CrmOpportunity>),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm'] }); setModal(false); setForm({ opportunity_name: '', account_id: '', stage: 'lead', expected_revenue: '', probability: '', related_key_result_id: '' }); },
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="CRM Extension" subtitle="고객사 · 영업기회 · OKR 연결"
        action={<button className="btn-primary" onClick={() => setModal(true)}><Plus className="h-4 w-4" />Opportunity</button>} />

      {(followUps.data ?? []).length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-amber-800"><Bell className="h-4 w-4" />Follow-up 알림</div>
          <div className="flex flex-wrap gap-2">
            {(followUps.data ?? []).map((a) => (
              <span key={a.id} className={`rounded-full px-2 py-0.5 text-xs ${a.next_followup_date! < today ? 'bg-red-100 text-red-700' : 'bg-white text-amber-700'}`}>
                {a.company_name} · {a.next_followup_date}{a.next_followup_date! < today ? ' (지남)' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {(['pipeline', 'accounts', 'analysis'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-500'}`}>
            {t === 'pipeline' ? 'Pipeline' : t === 'accounts' ? 'Accounts' : 'Pipeline vs Revenue'}
          </button>
        ))}
      </div>

      {tab === 'pipeline' && (opps.isLoading ? <Spinner /> : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage) => {
            const items = (opps.data ?? []).filter((o) => o.stage === stage);
            const sum = items.reduce((s, o) => s + (o.expected_revenue ?? 0), 0);
            return (
              <div key={stage} className="w-56 shrink-0 rounded-xl bg-slate-100/60 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-slate-600">{STAGE_LABEL[stage]}</span>
                  <span className="text-[10px] text-slate-400">{items.length} · {sum}k</span>
                </div>
                <div className="space-y-2">
                  {items.map((o) => (
                    <div key={o.id} className="card p-2">
                      <div className="text-sm font-medium text-slate-700">{o.opportunity_name}</div>
                      <div className="text-[11px] text-slate-400">{(o as any).account?.company_name}</div>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                        <span>{o.expected_revenue}k</span><span>·</span><span>{o.probability}%</span>
                        {o.related_key_result_id && <Link2 className="h-3 w-3 text-emerald-500" />}
                      </div>
                      <select className="mt-1.5 w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        value={o.stage} onChange={(e) => move.mutate({ id: o.id, stage: e.target.value as CrmStage })}>
                        {Object.keys(STAGE_LABEL).map((s) => <option key={s} value={s}>{STAGE_LABEL[s as CrmStage]}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {tab === 'accounts' && (accounts.isLoading ? <Spinner /> : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-slate-500">
              <tr><th className="px-4 py-2">고객사</th><th className="px-2 py-2">시장</th><th className="px-2 py-2">등급</th>
                <th className="px-2 py-2">예상/실매출</th><th className="px-2 py-2">연결 KR</th><th className="px-2 py-2">상태</th></tr>
            </thead>
            <tbody>
              {(accounts.data ?? []).map((a) => (
                <tr key={a.id} className="border-b border-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-700">{a.company_name}</td>
                  <td className="px-2 py-2 text-slate-500">{a.market ?? a.country}</td>
                  <td className="px-2 py-2 uppercase text-slate-500">{a.account_grade ?? '—'}</td>
                  <td className="px-2 py-2 text-slate-500">{a.expected_revenue ?? '—'} / {a.actual_revenue ?? '—'}k</td>
                  <td className="px-2 py-2">{a.related_key_result_id ? <Link2 className="h-3.5 w-3.5 text-emerald-500" /> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-2 py-2"><Badge className="bg-slate-100 text-slate-600">{a.account_status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {(accounts.data ?? []).length === 0 && <EmptyState>고객사 데이터가 없습니다.</EmptyState>}
        </Card>
      ))}

      {tab === 'analysis' && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">시장별 Pipeline(가중) vs 실매출</h3>
          {revenue.isLoading ? <Spinner /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenue.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="market" /><YAxis /><Tooltip /><Legend />
                <Bar dataKey="pipeline" name="가중 파이프라인(k)" fill="#3b6fff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="실매출(k)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="mt-2 text-xs text-slate-400">가중 파이프라인 = Σ(예상매출 × 확률). 실매출과의 간극이 큰 시장이 매출 위험 구간.</p>
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Opportunity 추가">
        <div className="space-y-3">
          <Field label="기회명"><input className="input" autoFocus value={form.opportunity_name}
            onChange={(e) => setForm({ ...form, opportunity_name: e.target.value })} /></Field>
          <Field label="고객사">
            <select className="input" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
              <option value="">선택</option>
              {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.company_name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="단계">
              <select className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {Object.keys(STAGE_LABEL).map((s) => <option key={s} value={s}>{STAGE_LABEL[s as CrmStage]}</option>)}
              </select>
            </Field>
            <Field label="예상매출(k)"><input className="input" type="number" value={form.expected_revenue}
              onChange={(e) => setForm({ ...form, expected_revenue: e.target.value })} /></Field>
            <Field label="확률(%)"><input className="input" type="number" value={form.probability}
              onChange={(e) => setForm({ ...form, probability: e.target.value })} /></Field>
          </div>
          <Field label="연결 KR (매출 목표)">
            <select className="input" value={form.related_key_result_id} onChange={(e) => setForm({ ...form, related_key_result_id: e.target.value })}>
              <option value="">(미연결)</option>
              {(krs.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}
            </select>
          </Field>
          <button className="btn-primary w-full" disabled={!form.opportunity_name || !form.account_id || create.isPending}
            onClick={() => create.mutate()}>{create.isPending ? '추가 중…' : '추가'}</button>
        </div>
      </Modal>
    </>
  );
}
