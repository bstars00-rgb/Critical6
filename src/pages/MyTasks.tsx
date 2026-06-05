import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KanbanSquare, Flame } from 'lucide-react';
import { actionPlansService } from '@/services/actionPlans';
import { criticalSixService } from '@/services/criticalSix';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, StatusBadge, PriorityBadge, EmptyState } from '@/components/ui';
import { TASK_STATUSES, statusLabel } from '@/lib/constants';
import { useLang, useT } from '@/i18n';
import type { TaskStatus } from '@/types';

export default function MyTasks() {
  const t = useT();
  const lang = useLang();
  const uid = useAuthStore((s) => s.profile?.id);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');

  const aps = useQuery({ queryKey: ['ap', 'owner', uid], queryFn: () => actionPlansService.byOwner(uid!), enabled: !!uid });
  const c6 = useQuery({ queryKey: ['c6', 'owner', uid], queryFn: () => criticalSixService.byOwner(uid!), enabled: !!uid });

  if (aps.isLoading || c6.isLoading) return <Spinner />;

  const all = [
    ...(aps.data ?? []).map((a) => ({ ...a, kind: 'action' as const })),
    ...(c6.data ?? []).map((c) => ({ ...c, kind: 'critical6' as const })),
  ].filter((x) => filter === 'all' || x.status === filter)
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));

  const counts = TASK_STATUSES.reduce<Record<string, number>>((m, s) => {
    m[s] = [...(aps.data ?? []), ...(c6.data ?? [])].filter((x) => x.status === s).length; return m;
  }, {});

  return (
    <>
      <PageHeader title="My Tasks" subtitle={t('내가 담당한 모든 작업 (Action + Critical 6)', 'Everything assigned to me (Action + Critical 6)')} />

      <div className="mb-3 flex flex-wrap gap-1.5">
        <button onClick={() => setFilter('all')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${filter === 'all' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
          {t('전체', 'All')} {all.length === 0 ? '' : ''}
        </button>
        {TASK_STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
            {statusLabel(s, lang)} {counts[s] ? `(${counts[s]})` : ''}
          </button>
        ))}
      </div>

      <Card className="p-0">
        {all.length === 0 ? <EmptyState>{t('해당하는 작업이 없습니다.', 'No matching tasks.')}</EmptyState> : (
          <div>
            {all.map((x) => (
              <div key={`${x.kind}-${x.id}`} className="flex items-center gap-3 border-b border-slate-50 px-3 py-2.5 last:border-0 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40">
                {x.kind === 'critical6'
                  ? <Flame className="h-4 w-4 shrink-0 text-amber-500" />
                  : <KanbanSquare className="h-4 w-4 shrink-0 text-brand-500" />}
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{x.title}</span>
                <PriorityBadge priority={x.priority} />
                {x.due_date && <span className="shrink-0 text-xs text-slate-400">{x.due_date}</span>}
                <StatusBadge status={x.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
