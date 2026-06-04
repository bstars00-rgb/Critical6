import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Sparkles, ArrowLeft } from 'lucide-react';
import { objectivesService } from '@/services/objectives';
import { keyResultsService } from '@/services/keyResults';
import { aiService, type AiResult } from '@/ai/aiService';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, StatusBadge, PriorityBadge, ProgressBar, Modal, Field } from '@/components/ui';
import { AiResultCard } from '@/components/AiResultCard';
import { OKR_STATUSES, statusLabel } from '@/lib/constants';
import { useLang } from '@/i18n';

export default function OkrDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const lang = useLang();
  const profile = useAuthStore((s) => s.profile);
  const [krModal, setKrModal] = useState(false);
  const [ai, setAi] = useState<AiResult | null>(null);
  const [krForm, setKrForm] = useState({ title: '', target_value: '', current_value: '', unit: '' });

  const data = useQuery({ queryKey: ['okr', id], queryFn: () => objectivesService.withRelations(id!) });

  const addKr = useMutation({
    mutationFn: () => keyResultsService.create({
      objective_id: id!, title: krForm.title,
      target_value: krForm.target_value ? +krForm.target_value : null,
      current_value: krForm.current_value ? +krForm.current_value : 0,
      unit: krForm.unit || null, owner_id: profile?.id ?? null,
      status: 'not_started', priority: 'medium',
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['okr', id] }); setKrModal(false); setKrForm({ title: '', target_value: '', current_value: '', unit: '' }); },
  });

  const updateKrValue = useMutation({
    mutationFn: ({ krId, value }: { krId: string; value: number }) =>
      keyResultsService.update(krId, { current_value: value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['okr', id] }),
  });

  const runAi = useMutation({
    mutationFn: async () => {
      const d = data.data!;
      return aiService.okrQualityCheck({
        objective: d.objective, keyResults: d.keyResults, kpis: d.kpis, actionPlans: d.actionPlans,
      });
    },
    onSuccess: (r) => setAi(r),
  });

  if (data.isLoading) return <Spinner />;
  const d = data.data!;
  if (!d.objective) return <p className="text-slate-400 dark:text-slate-500">목표를 찾을 수 없습니다.</p>;
  const o = d.objective;

  return (
    <>
      <Link to="/okr" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> OKR Tree
      </Link>
      <PageHeader title={o.title}
        subtitle={`${o.level} · ${o.year ?? ''} Q${o.quarter ?? ''}`}
        action={<button className="btn-outline" onClick={() => runAi.mutate()} disabled={runAi.isPending}>
          <Sparkles className="h-4 w-4" />{runAi.isPending ? '분석 중…' : 'OKR 품질 체크'}</button>} />

      <div className="grid grid-cols-3 gap-3">
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">진행률</div>
          <div className="mt-1 text-2xl font-bold">{Math.round(o.progress)}%</div>
          <ProgressBar value={o.progress} className="mt-2" /></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">상태</div><div className="mt-2"><StatusBadge status={o.status} /></div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">우선순위</div><div className="mt-2"><PriorityBadge priority={o.priority} /></div></Card>
      </div>

      {ai && <div className="mt-4"><AiResultCard result={ai} title="OKR Quality Check" /></div>}

      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Key Results ({d.keyResults.length})</h3>
          <button className="btn-ghost" onClick={() => setKrModal(true)}><Plus className="h-4 w-4" />KR 추가</button>
        </div>
        <div className="space-y-2">
          {d.keyResults.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">KR이 없습니다.</p>}
          {d.keyResults.map((kr: any) => (
            <div key={kr.id} className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{kr.title}</span>
                <select className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
                  value={kr.status}
                  onChange={(e) => keyResultsService.update(kr.id, { status: e.target.value as any })
                    .then(() => qc.invalidateQueries({ queryKey: ['okr', id] }))}>
                  {OKR_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}
                </select>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input type="number" defaultValue={kr.current_value ?? 0}
                  className="w-24 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-sm"
                  onBlur={(e) => updateKrValue.mutate({ krId: kr.id, value: +e.target.value })} />
                <span className="text-xs text-slate-400 dark:text-slate-500">/ {kr.target_value ?? '—'} {kr.unit ?? ''}</span>
                <div className="ml-auto w-32"><ProgressBar value={kr.progress} /></div>
                <span className="w-10 text-right text-xs text-slate-500 dark:text-slate-400">{Math.round(kr.progress)}%</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">연결된 KPI ({d.kpis.length})</h3>
          {d.kpis.map((k: any) => (
            <div key={k.id} className="flex justify-between py-1 text-sm">
              <span className="text-slate-600 dark:text-slate-300">{k.name}</span>
              <span className="text-slate-400 dark:text-slate-500">{k.current_value ?? '—'}/{k.target_value ?? '—'} {k.unit}</span>
            </div>
          ))}
          {d.kpis.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">없음</p>}
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Critical 6 / Action ({d.criticalSix.length + d.actionPlans.length})</h3>
          {[...d.criticalSix, ...d.actionPlans].map((t: any) => (
            <div key={t.id} className="flex justify-between py-1 text-sm">
              <span className="text-slate-600 dark:text-slate-300">{t.title}</span><StatusBadge status={t.status} />
            </div>
          ))}
          {d.criticalSix.length + d.actionPlans.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">없음</p>}
        </Card>
      </div>

      <Modal open={krModal} onClose={() => setKrModal(false)} title="Key Result 추가">
        <div className="space-y-3">
          <Field label="제목"><input className="input" autoFocus value={krForm.title}
            onChange={(e) => setKrForm({ ...krForm, title: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="현재값"><input className="input" type="number" value={krForm.current_value}
              onChange={(e) => setKrForm({ ...krForm, current_value: e.target.value })} /></Field>
            <Field label="목표값"><input className="input" type="number" value={krForm.target_value}
              onChange={(e) => setKrForm({ ...krForm, target_value: e.target.value })} /></Field>
            <Field label="단위"><input className="input" value={krForm.unit}
              onChange={(e) => setKrForm({ ...krForm, unit: e.target.value })} /></Field>
          </div>
          <button className="btn-primary w-full" disabled={!krForm.title || addKr.isPending}
            onClick={() => addKr.mutate()}>{addKr.isPending ? '추가 중…' : '추가'}</button>
        </div>
      </Modal>
    </>
  );
}
