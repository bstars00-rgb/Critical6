import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Link2, Unlink, CheckSquare, Users, Pencil, Trash2, Flame } from 'lucide-react';
import { actionPlansService } from '@/services/actionPlans';
import { criticalSixService } from '@/services/criticalSix';
import { keyResultsService } from '@/services/keyResults';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, PriorityBadge, Modal, Field } from '@/components/ui';
import { BOARD_COLUMNS, PRIORITIES, TASK_STATUSES, statusLabel, priorityLabel } from '@/lib/constants';
import { STATUS_COLOR } from '@/lib/constants';
import { useLang, useT } from '@/i18n';
import type { TaskStatus } from '@/types';
import { cn } from '@/lib/cn';

const emptyForm = { title: '', description: '', key_result_id: '', due_date: '', priority: 'medium', status: 'not_started' };

export default function ActionBoard() {
  const qc = useQueryClient();
  const lang = useLang();
  const t = useT();
  const profile = useAuthStore((s) => s.profile);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const list = useQuery({ queryKey: ['ap', 'board'], queryFn: () => actionPlansService.board() });
  const krs = useQuery({ queryKey: ['kr', 'all'], queryFn: () => keyResultsService.list() });
  const items = list.data ?? [];

  const reset = () => { qc.invalidateQueries({ queryKey: ['ap'] }); setModal(false); setEditId(null); setForm(emptyForm); };
  const save = useMutation({
    mutationFn: () => {
      const v = {
        title: form.title, description: form.description || null, key_result_id: form.key_result_id || null,
        due_date: form.due_date || null, priority: form.priority as any, status: form.status as any,
      };
      return editId ? actionPlansService.update(editId, v) : actionPlansService.create({ ...v, owner_id: profile?.id ?? null, labels: [], checklist: [] });
    },
    onSuccess: reset,
  });
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => actionPlansService.move(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ap'] }),
  });
  const remove = useMutation({ mutationFn: (id: string) => actionPlansService.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['ap'] }) });
  // Write today's Critical 6 from an Action Plan (daily execution of the action).
  const toCritical6 = useMutation({
    mutationFn: (a: any) => criticalSixService.create({
      title: a.title, key_result_id: a.key_result_id || null, objective_id: a.objective_id || null,
      owner_id: profile?.id as string, completion_criteria: a.description || null, priority: a.priority,
      status: 'not_started', is_today_focus: true, is_weekly_focus: true,
      focus_date: new Date().toISOString().slice(0, 10),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['c6'] }),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setModal(true); };
  const openEdit = (a: any) => {
    setEditId(a.id);
    setForm({ title: a.title ?? '', description: a.description ?? '', key_result_id: a.key_result_id ?? '', due_date: a.due_date ?? '', priority: a.priority, status: a.status });
    setModal(true);
  };
  const onDelete = (a: any) => { if (window.confirm(t('삭제할까요?', 'Delete this item?') + `\n"${a.title}"`)) remove.mutate(a.id); };

  if (list.isLoading) return <Spinner />;

  return (
    <>
      <PageHeader title={t('액션 보드', 'Action Board')} subtitle={t('모든 Action은 가능하면 OKR/KR/Critical 6에 연결', 'Link every action to an OKR/KR/Critical 6 where possible')}
        action={<button className="btn-primary" onClick={openAdd}><Plus className="h-4 w-4" />{t('작업', 'Task')}</button>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {BOARD_COLUMNS.map((col) => {
          const colItems = items.filter((i) => i.status === col);
          return (
            <div key={col} className="rounded-xl bg-slate-100/60 dark:bg-slate-800/60 p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLOR[col])}>{statusLabel(col, lang)}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{colItems.length}</span>
              </div>
              <div className="space-y-2">
                {colItems.map((a) => {
                  const linked = a.objective_id || a.key_result_id || a.kpi_id || a.critical_six_id;
                  const checklist = Array.isArray(a.checklist) ? a.checklist : [];
                  const done = checklist.filter((c: any) => c?.done).length;
                  const assignees: string[] = (a as any).external_assignees ?? [];
                  return (
                    <div key={a.id} className="card group space-y-1.5 p-2.5">
                      <div className="flex items-start gap-1">
                        <div className="flex-1 text-sm font-medium leading-snug text-slate-700 dark:text-slate-200">{a.title}</div>
                        <button title={t('오늘 Critical 6로', "Make today's Critical 6")}
                          onClick={() => { toCritical6.mutate(a); }} className="shrink-0 text-slate-300 hover:text-amber-500 dark:text-slate-600"><Flame className="h-3.5 w-3.5" /></button>
                        <button title={t('수정', 'Edit')} onClick={() => openEdit(a)} className="shrink-0 text-slate-300 hover:text-brand-600 dark:text-slate-600"><Pencil className="h-3.5 w-3.5" /></button>
                        <button title={t('삭제', 'Delete')} onClick={() => onDelete(a)} className="shrink-0 text-slate-300 hover:text-red-500 dark:text-slate-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      {a.description && (
                        <p className="line-clamp-2 text-[11px] leading-snug text-slate-400 dark:text-slate-500">{a.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PriorityBadge priority={a.priority} />
                        {checklist.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                            <CheckSquare className="h-3 w-3" />{done}/{checklist.length}
                          </span>
                        )}
                        {linked
                          ? <Link2 className="h-3 w-3 text-emerald-500" />
                          : <span title={t('OKR 미연결', 'No OKR link')} className="inline-flex items-center gap-0.5 text-[10px] text-amber-600"><Unlink className="h-3 w-3" />{t('미연결', 'Unlinked')}</span>}
                        {a.due_date && <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">{a.due_date}</span>}
                      </div>
                      {assignees.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <Users className="h-3 w-3 shrink-0" />
                          <span className="truncate">{assignees.map((n) => n.replace(/\(.*\)/, '').trim()).join(', ')}</span>
                        </div>
                      )}
                      <select className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        value={a.status} onChange={(e) => move.mutate({ id: a.id, status: e.target.value as TaskStatus })}>
                        {BOARD_COLUMNS.concat('cancelled').map((s) => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={modal} onClose={reset} title={editId ? t('Action Plan 수정', 'Edit action plan') : t('Action Plan 추가', 'Add action plan')}>
        <div className="space-y-3">
          <Field label={t('제목', 'Title')}><input className="input" autoFocus value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label={t('설명', 'Description')}><textarea className="input min-h-[56px]" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label={t('연결할 KR (정렬 권장)', 'Link to KR (alignment recommended)')}>
            <select className="input" value={form.key_result_id}
              onChange={(e) => setForm({ ...form, key_result_id: e.target.value })}>
              <option value="">{t('(미연결)', '(unlinked)')}</option>
              {(krs.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-2">
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
            <Field label={t('마감일', 'Due')}><input className="input" type="date" value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
          </div>
          <button className="btn-primary w-full" disabled={!form.title || save.isPending}
            onClick={() => save.mutate()}>{save.isPending ? t('저장 중…', 'Saving…') : editId ? t('저장', 'Save') : t('추가', 'Add')}</button>
        </div>
      </Modal>
    </>
  );
}
