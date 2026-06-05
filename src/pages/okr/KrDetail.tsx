import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { keyResultsService } from '@/services/keyResults';
import { checkInsService } from '@/services/checkIns';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, StatusBadge, PriorityBadge, ProgressBar, Modal, Field, EmptyState } from '@/components/ui';
import { KrQuarterEditor } from '@/components/KrQuarterEditor';
import { OKR_STATUSES, statusLabel } from '@/lib/constants';
import { useLang, useT } from '@/i18n';

export default function KrDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const [ci, setCi] = useState(false);
  const [form, setForm] = useState({ value: '', status: 'in_progress', confidence: 7, note: '' });

  const data = useQuery({ queryKey: ['kr-detail', id], queryFn: () => keyResultsService.withRelations(id!) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['kr-detail', id] }); qc.invalidateQueries({ queryKey: ['okr'] }); };

  const checkIn = useMutation({
    mutationFn: () => checkInsService.create({
      key_result_id: id!, value: form.value === '' ? null : +form.value,
      status: form.status, confidence: form.confidence, note: form.note || null,
    }),
    onSuccess: () => { invalidate(); setCi(false); setForm({ ...form, note: '' }); },
  });

  if (data.isLoading) return <Spinner />;
  const d = data.data!;
  if (!d.kr) return <p className="text-slate-400">{t('KR을 찾을 수 없습니다.', 'Key result not found.')}</p>;
  const kr = d.kr as any;

  const openCi = () => { setForm({ value: String(kr.current_value ?? ''), status: kr.status, confidence: kr.confidence_score ?? 7, note: '' }); setCi(true); };

  return (
    <>
      {d.objective && (
        <Link to={`/okr/${d.objective.id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400">
          <ArrowLeft className="h-4 w-4" /> {d.objective.title}
        </Link>
      )}
      <PageHeader title={kr.title} subtitle={t('Key Result', 'Key Result')}
        action={<button className="btn-primary" onClick={openCi}><TrendingUp className="h-4 w-4" />{t('체크인', 'Check-in')}</button>} />

      <div className="card flex items-center gap-5 p-5">
        <div className="text-5xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">{Math.round(kr.progress)}<span className="text-2xl">%</span></div>
        <div className="flex-1">
          <ProgressBar value={kr.progress} className="h-2.5" />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={kr.status} /><PriorityBadge priority={kr.priority} />
            <span className="text-slate-500 dark:text-slate-400">{kr.current_value ?? 0} / {kr.target_value ?? '—'} {kr.unit ?? ''}</span>
            {kr.confidence_score != null && <span className="text-slate-400">· {t('신뢰도', 'Confidence')} {kr.confidence_score}/10</span>}
          </div>
        </div>
      </div>

      <Card className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('분기별 목표/실적', 'Quarterly target/actual')}</h3>
        <KrQuarterEditor krId={kr.id} year={new Date().getFullYear()} />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('체크인 이력', 'Check-in history')} ({d.checkIns.length})</h3>
          {d.checkIns.length === 0 ? <EmptyState>{t('아직 체크인이 없습니다.', 'No check-ins yet.')}</EmptyState> : (
            <div className="space-y-2">
              {d.checkIns.map((c: any) => (
                <div key={c.id} className="rounded-lg border border-slate-100 p-2 text-sm dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{c.value ?? '—'} {kr.unit ?? ''}</span>
                    <span className="text-[11px] text-slate-400">{String(c.created_at).slice(0, 10)} · {c.users?.full_name ?? ''}</span>
                  </div>
                  {c.note && <div className="mt-0.5 text-slate-500 dark:text-slate-400">{c.note}</div>}
                  {c.status && <span className="mt-1 inline-block"><StatusBadge status={c.status} /></span>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('연결된 KPI', 'Linked KPIs')} ({d.kpis.length})</h3>
            {d.kpis.map((k: any) => <div key={k.id} className="flex justify-between py-1 text-sm"><span className="text-slate-600 dark:text-slate-300">{k.name}</span><span className="text-slate-400">{k.current_value ?? '—'}/{k.target_value ?? '—'} {k.unit}</span></div>)}
            {d.kpis.length === 0 && <p className="text-sm text-slate-400">{t('없음', 'None')}</p>}
          </Card>
          <Card>
            <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Critical 6 / Action ({d.criticalSix.length + d.actionPlans.length})</h3>
            {[...d.criticalSix, ...d.actionPlans].slice(0, 12).map((x: any) => <div key={x.id} className="flex justify-between py-1 text-sm"><span className="truncate text-slate-600 dark:text-slate-300">{x.title}</span><StatusBadge status={x.status} /></div>)}
            {d.criticalSix.length + d.actionPlans.length === 0 && <p className="text-sm text-slate-400">{t('없음', 'None')}</p>}
          </Card>
        </div>
      </div>

      <Modal open={ci} onClose={() => setCi(false)} title={`${t('체크인', 'Check-in')} · ${kr.title}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label={`${t('현재값', 'Current')}${kr.target_value != null ? ` / ${kr.target_value}${kr.unit ?? ''}` : ''}`}>
              <input className="input" type="number" autoFocus value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
            <Field label={t('상태', 'Status')}>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {OKR_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}
              </select>
            </Field>
          </div>
          <Field label={`${t('신뢰도', 'Confidence')}: ${form.confidence}/10`}>
            <input type="range" min={0} max={10} value={form.confidence} className="w-full" onChange={(e) => setForm({ ...form, confidence: +e.target.value })} /></Field>
          <Field label={t('메모 (진행/막힌 점/다음)', 'Note (progress / blockers / next)')}>
            <textarea className="input min-h-[64px]" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <button className="btn-primary w-full" disabled={checkIn.isPending} onClick={() => checkIn.mutate()}>
            {checkIn.isPending ? t('기록 중…', 'Saving…') : t('체크인 기록', 'Record check-in')}</button>
        </div>
      </Modal>
    </>
  );
}
