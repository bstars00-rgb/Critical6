import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Sparkles, ArrowLeft, Pencil, Trash2, CalendarRange } from 'lucide-react';
import { objectivesService } from '@/services/objectives';
import { keyResultsService } from '@/services/keyResults';
import { aiService, type AiResult } from '@/ai/aiService';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, StatusBadge, PriorityBadge, ProgressBar, Modal, Field } from '@/components/ui';
import { AiResultCard } from '@/components/AiResultCard';
import { KrQuarterEditor } from '@/components/KrQuarterEditor';
import { OKR_STATUSES, PRIORITIES, statusLabel, priorityLabel } from '@/lib/constants';
import { useLang, useT } from '@/i18n';

const emptyKr = { title: '', target_value: '', current_value: '', unit: '', status: 'not_started', priority: 'medium' };

export default function OkrDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const nav = useNavigate();
  const lang = useLang();
  const t = useT();
  const profile = useAuthStore((s) => s.profile);
  const [krModal, setKrModal] = useState(false);
  const [krEditId, setKrEditId] = useState<string | null>(null);
  const [krForm, setKrForm] = useState(emptyKr);
  const [objModal, setObjModal] = useState(false);
  const [objForm, setObjForm] = useState({ title: '', description: '', status: 'not_started', priority: 'medium', due_date: '', memo: '' });
  const [qOpen, setQOpen] = useState<Record<string, boolean>>({});
  const [ai, setAi] = useState<AiResult | null>(null);

  const data = useQuery({ queryKey: ['okr', id], queryFn: () => objectivesService.withRelations(id!) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['okr'] }); };

  const saveKr = useMutation({
    mutationFn: () => {
      const v = {
        title: krForm.title,
        target_value: krForm.target_value ? +krForm.target_value : null,
        current_value: krForm.current_value ? +krForm.current_value : 0,
        unit: krForm.unit || null, status: krForm.status as any, priority: krForm.priority as any,
      };
      return krEditId ? keyResultsService.update(krEditId, v) : keyResultsService.create({ ...v, objective_id: id!, owner_id: profile?.id ?? null });
    },
    onSuccess: () => { invalidate(); setKrModal(false); setKrEditId(null); setKrForm(emptyKr); },
  });
  const deleteKr = useMutation({ mutationFn: (krId: string) => keyResultsService.remove(krId), onSuccess: invalidate });
  const saveObj = useMutation({
    mutationFn: () => objectivesService.update(id!, {
      title: objForm.title, description: objForm.description || null, status: objForm.status as any,
      priority: objForm.priority as any, due_date: objForm.due_date || null, memo: objForm.memo || null,
    }),
    onSuccess: () => { invalidate(); setObjModal(false); },
  });
  const deleteObj = useMutation({ mutationFn: () => objectivesService.remove(id!), onSuccess: () => { invalidate(); nav('/okr'); } });

  const openKrAdd = () => { setKrEditId(null); setKrForm(emptyKr); setKrModal(true); };
  const openKrEdit = (kr: any) => {
    setKrEditId(kr.id);
    setKrForm({ title: kr.title ?? '', target_value: String(kr.target_value ?? ''), current_value: String(kr.current_value ?? ''), unit: kr.unit ?? '', status: kr.status, priority: kr.priority });
    setKrModal(true);
  };
  const onDeleteKr = (kr: any) => { if (window.confirm(t('이 KR을 삭제할까요?', 'Delete this KR?') + `\n"${kr.title}"`)) deleteKr.mutate(kr.id); };

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
  if (!d.objective) return <p className="text-slate-400 dark:text-slate-500">{t('목표를 찾을 수 없습니다.', 'Objective not found.')}</p>;
  const o = d.objective;

  return (
    <>
      <Link to="/okr" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> OKR Tree
      </Link>
      <PageHeader title={o.title}
        subtitle={`${o.level} · ${o.year ?? ''} Q${o.quarter ?? ''}`}
        action={
          <div className="flex gap-2">
            <button className="btn-outline" onClick={() => runAi.mutate()} disabled={runAi.isPending}>
              <Sparkles className="h-4 w-4" />{runAi.isPending ? t('분석 중…', 'Analyzing…') : t('OKR 품질 체크', 'OKR quality check')}</button>
            <button className="btn-ghost" title={t('수정', 'Edit')}
              onClick={() => { setObjForm({ title: o.title, description: o.description ?? '', status: o.status, priority: o.priority, due_date: o.due_date ?? '', memo: o.memo ?? '' }); setObjModal(true); }}>
              <Pencil className="h-4 w-4" /></button>
            <button className="btn-ghost text-red-500" title={t('삭제', 'Delete')}
              onClick={() => { if (window.confirm(t('이 Objective와 하위 KR을 모두 삭제할까요?', 'Delete this objective and all its KRs?'))) deleteObj.mutate(); }}>
              <Trash2 className="h-4 w-4" /></button>
          </div>
        } />

      <div className="grid grid-cols-3 gap-3">
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">{t('진행률', 'Progress')}</div>
          <div className="mt-1 text-2xl font-bold">{Math.round(o.progress)}%</div>
          <ProgressBar value={o.progress} className="mt-2" /></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">{t('상태', 'Status')}</div><div className="mt-2"><StatusBadge status={o.status} /></div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">{t('우선순위', 'Priority')}</div><div className="mt-2"><PriorityBadge priority={o.priority} /></div></Card>
      </div>

      {ai && <div className="mt-4"><AiResultCard result={ai} title="OKR Quality Check" /></div>}

      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Key Results ({d.keyResults.length})</h3>
          <button className="btn-ghost" onClick={openKrAdd}><Plus className="h-4 w-4" />{t('KR 추가', 'Add KR')}</button>
        </div>
        <div className="space-y-2">
          {d.keyResults.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">{t('KR이 없습니다.', 'No key results.')}</p>}
          {d.keyResults.map((kr: any) => (
            <div key={kr.id} className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{kr.title}</span>
                <select className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
                  value={kr.status}
                  onChange={(e) => keyResultsService.update(kr.id, { status: e.target.value as any }).then(invalidate)}>
                  {OKR_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}
                </select>
                <button title={t('분기별 입력', 'Quarterly')} onClick={() => setQOpen((q) => ({ ...q, [kr.id]: !q[kr.id] }))}
                  className={qOpen[kr.id] ? 'text-brand-600' : 'text-slate-300 hover:text-brand-600 dark:text-slate-600'}><CalendarRange className="h-4 w-4" /></button>
                <button title={t('수정', 'Edit')} onClick={() => openKrEdit(kr)} className="text-slate-300 hover:text-brand-600 dark:text-slate-600"><Pencil className="h-4 w-4" /></button>
                <button title={t('삭제', 'Delete')} onClick={() => onDeleteKr(kr)} className="text-slate-300 hover:text-red-500 dark:text-slate-600"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <input key={`c${kr.current_value}`} type="number" defaultValue={kr.current_value ?? 0} title={t('현재값', 'Current')}
                  className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  onBlur={(e) => keyResultsService.update(kr.id, { current_value: e.target.value === '' ? 0 : +e.target.value }).then(invalidate)} />
                <span className="text-sm text-slate-400 dark:text-slate-500">/</span>
                <input key={`t${kr.target_value}`} type="number" defaultValue={kr.target_value ?? ''} placeholder={t('목표', 'Target')} title={t('목표값', 'Target')}
                  className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  onBlur={(e) => keyResultsService.update(kr.id, { target_value: e.target.value === '' ? null : +e.target.value }).then(invalidate)} />
                <span className="text-xs text-slate-400 dark:text-slate-500">{kr.unit ?? ''}</span>
                <div className="ml-auto w-28 shrink-0"><ProgressBar value={kr.progress} /></div>
                <span className="w-10 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">{Math.round(kr.progress)}%</span>
              </div>
              {qOpen[kr.id] && <KrQuarterEditor krId={kr.id} year={o.year ?? new Date().getFullYear()} />}
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('연결된 KPI', 'Linked KPIs')} ({d.kpis.length})</h3>
          {d.kpis.map((k: any) => (
            <div key={k.id} className="flex justify-between py-1 text-sm">
              <span className="text-slate-600 dark:text-slate-300">{k.name}</span>
              <span className="text-slate-400 dark:text-slate-500">{k.current_value ?? '—'}/{k.target_value ?? '—'} {k.unit}</span>
            </div>
          ))}
          {d.kpis.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">{t('없음', 'None')}</p>}
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Critical 6 / Action ({d.criticalSix.length + d.actionPlans.length})</h3>
          {[...d.criticalSix, ...d.actionPlans].map((t: any) => (
            <div key={t.id} className="flex justify-between py-1 text-sm">
              <span className="text-slate-600 dark:text-slate-300">{t.title}</span><StatusBadge status={t.status} />
            </div>
          ))}
          {d.criticalSix.length + d.actionPlans.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">{t('없음', 'None')}</p>}
        </Card>
      </div>

      <Modal open={krModal} onClose={() => { setKrModal(false); setKrEditId(null); }} title={krEditId ? t('Key Result 수정', 'Edit key result') : t('Key Result 추가', 'Add key result')}>
        <div className="space-y-3">
          <Field label={t('제목', 'Title')}><input className="input" autoFocus value={krForm.title}
            onChange={(e) => setKrForm({ ...krForm, title: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t('현재값', 'Current')}><input className="input" type="number" value={krForm.current_value}
              onChange={(e) => setKrForm({ ...krForm, current_value: e.target.value })} /></Field>
            <Field label={t('목표값', 'Target')}><input className="input" type="number" value={krForm.target_value}
              onChange={(e) => setKrForm({ ...krForm, target_value: e.target.value })} /></Field>
            <Field label={t('단위', 'Unit')}><input className="input" value={krForm.unit}
              onChange={(e) => setKrForm({ ...krForm, unit: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('상태', 'Status')}>
              <select className="input" value={krForm.status} onChange={(e) => setKrForm({ ...krForm, status: e.target.value })}>
                {OKR_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}
              </select>
            </Field>
            <Field label={t('우선순위', 'Priority')}>
              <select className="input" value={krForm.priority} onChange={(e) => setKrForm({ ...krForm, priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p, lang)}</option>)}
              </select>
            </Field>
          </div>
          <button className="btn-primary w-full" disabled={!krForm.title || saveKr.isPending}
            onClick={() => saveKr.mutate()}>{saveKr.isPending ? t('저장 중…', 'Saving…') : krEditId ? t('저장', 'Save') : t('추가', 'Add')}</button>
        </div>
      </Modal>

      <Modal open={objModal} onClose={() => setObjModal(false)} title={t('Objective 수정', 'Edit objective')}>
        <div className="space-y-3">
          <Field label={t('제목', 'Title')}><input className="input" autoFocus value={objForm.title}
            onChange={(e) => setObjForm({ ...objForm, title: e.target.value })} /></Field>
          <Field label={t('설명', 'Description')}><textarea className="input min-h-[56px]" value={objForm.description}
            onChange={(e) => setObjForm({ ...objForm, description: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t('상태', 'Status')}>
              <select className="input" value={objForm.status} onChange={(e) => setObjForm({ ...objForm, status: e.target.value })}>
                {OKR_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}
              </select>
            </Field>
            <Field label={t('우선순위', 'Priority')}>
              <select className="input" value={objForm.priority} onChange={(e) => setObjForm({ ...objForm, priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p, lang)}</option>)}
              </select>
            </Field>
            <Field label={t('마감일', 'Due')}><input className="input" type="date" value={objForm.due_date}
              onChange={(e) => setObjForm({ ...objForm, due_date: e.target.value })} /></Field>
          </div>
          <Field label={t('메모', 'Memo')}><input className="input" value={objForm.memo}
            onChange={(e) => setObjForm({ ...objForm, memo: e.target.value })} /></Field>
          <button className="btn-primary w-full" disabled={!objForm.title || saveObj.isPending}
            onClick={() => saveObj.mutate()}>{saveObj.isPending ? t('저장 중…', 'Saving…') : t('저장', 'Save')}</button>
        </div>
      </Modal>
    </>
  );
}
