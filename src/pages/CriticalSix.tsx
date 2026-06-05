import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, CheckCircle2, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { criticalSixService } from '@/services/criticalSix';
import { keyResultsService } from '@/services/keyResults';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, StatusBadge, Modal, Field, EmptyState } from '@/components/ui';
import { TASK_STATUSES, PRIORITIES, statusLabel, priorityLabel } from '@/lib/constants';
import { useT, useLang } from '@/i18n';

const empty = { title: '', key_result_id: '', completion_criteria: '', due_date: '', status: 'not_started', priority: 'important', blocker: '' };

export default function CriticalSix() {
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const profile = useAuthStore((s) => s.profile);
  const uid = profile?.id;
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  const list = useQuery({ queryKey: ['c6', 'owner', uid], queryFn: () => criticalSixService.byOwner(uid!), enabled: !!uid });
  const krs = useQuery({ queryKey: ['kr', 'all'], queryFn: () => keyResultsService.list() });

  const items = list.data ?? [];
  const active = items.filter((c) => ['not_started', 'in_progress', 'at_risk', 'delayed'].includes(c.status));
  const overloaded = active.length > 6;
  const groups = {
    today: items.filter((c) => c.is_today_focus && c.status !== 'completed'),
    week: items.filter((c) => c.is_weekly_focus && !c.is_today_focus && c.status !== 'completed'),
    delayed: items.filter((c) => c.status === 'delayed'),
    completed: items.filter((c) => c.status === 'completed'),
  };

  const reset = () => { qc.invalidateQueries({ queryKey: ['c6'] }); setModal(false); setEditId(null); setForm(empty); };
  const save = useMutation({
    mutationFn: () => {
      const v = {
        title: form.title, key_result_id: form.key_result_id || null,
        completion_criteria: form.completion_criteria || null, due_date: form.due_date || null,
        status: form.status as any, priority: form.priority as any, blocker: form.blocker || null,
      };
      return editId ? criticalSixService.update(editId, v) : criticalSixService.create({ ...v, owner_id: uid!, is_weekly_focus: true });
    },
    onSuccess: reset,
  });
  const remove = useMutation({ mutationFn: (id: string) => criticalSixService.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['c6'] }) });
  const toggleToday = useMutation({ mutationFn: ({ id, on }: { id: string; on: boolean }) => criticalSixService.toggleToday(id, on), onSuccess: () => qc.invalidateQueries({ queryKey: ['c6'] }) });
  const complete = useMutation({ mutationFn: (id: string) => criticalSixService.complete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['c6'] }) });

  const openAdd = () => { setEditId(null); setForm(empty); setModal(true); };
  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({ title: c.title ?? '', key_result_id: c.key_result_id ?? '', completion_criteria: c.completion_criteria ?? '', due_date: c.due_date ?? '', status: c.status, priority: c.priority, blocker: c.blocker ?? '' });
    setModal(true);
  };
  const onDelete = (c: any) => { if (window.confirm(t('삭제할까요?', 'Delete this item?') + `\n"${c.title}"`)) remove.mutate(c.id); };

  function Row({ c }: { c: any }) {
    return (
      <div className="group flex items-center gap-2 rounded-lg border border-slate-100 dark:border-slate-700 p-2">
        <button title={t('오늘 집중', 'Today focus')} onClick={() => toggleToday.mutate({ id: c.id, on: !c.is_today_focus })}>
          <Star className={`h-4 w-4 ${c.is_today_focus ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
        </button>
        <button title={t('완료', 'Complete')} onClick={() => complete.mutate(c.id)}>
          <CheckCircle2 className={`h-5 w-5 ${c.status === 'completed' ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-slate-700 dark:text-slate-200">{c.title}</div>
          {c.completion_criteria && <div className="truncate text-[11px] text-slate-400 dark:text-slate-500">{t('완료기준', 'Criteria')}: {c.completion_criteria}</div>}
        </div>
        {c.due_date && <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{c.due_date}</span>}
        <StatusBadge status={c.status} />
        <button title={t('수정', 'Edit')} onClick={() => openEdit(c)} className="text-slate-300 hover:text-brand-600 dark:text-slate-600"><Pencil className="h-4 w-4" /></button>
        <button title={t('삭제', 'Delete')} onClick={() => onDelete(c)} className="text-slate-300 hover:text-red-500 dark:text-slate-600"><Trash2 className="h-4 w-4" /></button>
      </div>
    );
  }

  if (list.isLoading) return <Spinner />;

  return (
    <>
      <PageHeader title="Critical 6" subtitle={t('매일/매주 반드시 집중하는 핵심 실행 (≤6)', 'The few must-do executions, daily/weekly (≤6)')}
        action={<button className="btn-primary" onClick={openAdd}><Plus className="h-4 w-4" />{t('추가', 'Add')}</button>} />

      {overloaded && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/30 p-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          {t(`활성 Critical 6가 ${active.length}개입니다. 6개 이하로 집중하세요. (AI 경고)`, `You have ${active.length} active Critical 6 items. Focus on 6 or fewer. (AI warning)`)}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card><h3 className="mb-2 text-sm font-semibold">🔥 Today ({groups.today.length})</h3>
          <div className="space-y-2">{groups.today.length ? groups.today.map((c) => <Row key={c.id} c={c} />) : <EmptyState>{t('없음', 'None')}</EmptyState>}</div></Card>
        <Card><h3 className="mb-2 text-sm font-semibold">📅 This Week ({groups.week.length})</h3>
          <div className="space-y-2">{groups.week.length ? groups.week.map((c) => <Row key={c.id} c={c} />) : <EmptyState>{t('없음', 'None')}</EmptyState>}</div></Card>
        <Card><h3 className="mb-2 text-sm font-semibold">⏰ Delayed ({groups.delayed.length})</h3>
          <div className="space-y-2">{groups.delayed.length ? groups.delayed.map((c) => <Row key={c.id} c={c} />) : <EmptyState>{t('없음', 'None')}</EmptyState>}</div></Card>
        <Card><h3 className="mb-2 text-sm font-semibold">✅ Completed ({groups.completed.length})</h3>
          <div className="space-y-2">{groups.completed.length ? groups.completed.map((c) => <Row key={c.id} c={c} />) : <EmptyState>{t('없음', 'None')}</EmptyState>}</div></Card>
      </div>

      <Modal open={modal} onClose={reset} title={editId ? t('Critical 6 수정', 'Edit Critical 6') : t('Critical 6 추가', 'Add Critical 6')}>
        <div className="space-y-3">
          <Field label={t('제목', 'Title')}><input className="input" autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label={t('연결할 KR', 'Link to KR')}>
            <select className="input" value={form.key_result_id} onChange={(e) => setForm({ ...form, key_result_id: e.target.value })}>
              <option value="">{t('(KR 선택 — 연결 권장)', '(select a KR — linking recommended)')}</option>
              {(krs.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('상태', 'Status')}>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}
              </select>
            </Field>
            <Field label={t('우선순위', 'Priority')}>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p, lang)}</option>)}
              </select>
            </Field>
          </div>
          <Field label={t('완료 기준', 'Completion criteria')}><input className="input" value={form.completion_criteria} onChange={(e) => setForm({ ...form, completion_criteria: e.target.value })} /></Field>
          <Field label={t('막힌 점 (blocker)', 'Blocker')}><input className="input" value={form.blocker} onChange={(e) => setForm({ ...form, blocker: e.target.value })} /></Field>
          <Field label={t('마감일', 'Due date')}><input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
          {!editId && active.length >= 6 && <p className="text-xs text-amber-600">{t('⚠ 이미 활성 항목이 6개입니다.', '⚠ You already have 6 active items.')}</p>}
          <button className="btn-primary w-full" disabled={!form.title || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t('저장 중…', 'Saving…') : editId ? t('저장', 'Save') : t('추가', 'Add')}
          </button>
        </div>
      </Modal>
    </>
  );
}
