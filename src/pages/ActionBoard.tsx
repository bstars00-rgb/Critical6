import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Link2, Unlink, CheckSquare, Users } from 'lucide-react';
import { actionPlansService } from '@/services/actionPlans';
import { keyResultsService } from '@/services/keyResults';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, PriorityBadge, Modal, Field } from '@/components/ui';
import { BOARD_COLUMNS, statusLabel, STATUS_COLOR } from '@/lib/constants';
import { useLang, useT } from '@/i18n';
import type { TaskStatus } from '@/types';
import { cn } from '@/lib/cn';

export default function ActionBoard() {
  const qc = useQueryClient();
  const lang = useLang();
  const t = useT();
  const profile = useAuthStore((s) => s.profile);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: '', key_result_id: '', due_date: '', priority: 'medium' });

  const list = useQuery({ queryKey: ['ap', 'board'], queryFn: () => actionPlansService.board() });
  const krs = useQuery({ queryKey: ['kr', 'all'], queryFn: () => keyResultsService.list() });
  const items = list.data ?? [];

  const create = useMutation({
    mutationFn: () => actionPlansService.create({
      title: form.title, key_result_id: form.key_result_id || null, owner_id: profile?.id ?? null,
      due_date: form.due_date || null, priority: form.priority as any, status: 'not_started',
      labels: [], checklist: [],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ap'] }); setModal(false); setForm({ title: '', key_result_id: '', due_date: '', priority: 'medium' }); },
  });
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => actionPlansService.move(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ap'] }),
  });

  if (list.isLoading) return <Spinner />;

  return (
    <>
      <PageHeader title={t('액션 보드', 'Action Board')} subtitle={t('모든 Action은 가능하면 OKR/KR/Critical 6에 연결', 'Link every action to an OKR/KR/Critical 6 where possible')}
        action={<button className="btn-primary" onClick={() => setModal(true)}><Plus className="h-4 w-4" />{t('작업', 'Task')}</button>} />

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
                    <div key={a.id} className="card space-y-1.5 p-2.5">
                      <div className="text-sm font-medium leading-snug text-slate-700 dark:text-slate-200">{a.title}</div>
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

      <Modal open={modal} onClose={() => setModal(false)} title={t('Action Plan 추가', 'Add action plan')}>
        <div className="space-y-3">
          <Field label={t('제목', 'Title')}><input className="input" autoFocus value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label={t('연결할 KR (정렬 권장)', 'Link to KR (alignment recommended)')}>
            <select className="input" value={form.key_result_id}
              onChange={(e) => setForm({ ...form, key_result_id: e.target.value })}>
              <option value="">{t('(미연결)', '(unlinked)')}</option>
              {(krs.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('마감일', 'Due date')}><input className="input" type="date" value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
            <Field label={t('우선순위', 'Priority')}>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['low', 'medium', 'important', 'urgent', 'critical'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <button className="btn-primary w-full" disabled={!form.title || create.isPending}
            onClick={() => create.mutate()}>{create.isPending ? t('추가 중…', 'Adding…') : t('추가', 'Add')}</button>
        </div>
      </Modal>
    </>
  );
}
