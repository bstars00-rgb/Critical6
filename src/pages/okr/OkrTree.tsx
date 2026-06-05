import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus, ListTree, GanttChartSquare } from 'lucide-react';
import { objectivesService, type ObjectiveNode } from '@/services/objectives';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, StatusBadge, ProgressBar, Modal, Field } from '@/components/ui';
import { OkrTimeline } from '@/components/OkrTimeline';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import type { ObjectiveLevel } from '@/types';

function KrRow({ kr, depth }: { kr: any; depth: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const aps = kr.action_plans ?? [];
  const doneAp = aps.filter((a: any) => a.status === 'completed').length;
  return (
    <div>
      <div className="flex items-center gap-2 py-1 text-sm text-slate-600 dark:text-slate-300" style={{ paddingLeft: (depth + 1) * 18 + 22 }}>
        <button onClick={() => setOpen(!open)} className={aps.length ? '' : 'invisible'}>
          <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition ${open ? 'rotate-90' : ''}`} />
        </button>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
        <span className="flex-1 truncate">{kr.title}</span>
        {aps.length > 0 && (
          <span className="shrink-0 rounded bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            {t('실행', 'Exec')} {doneAp}/{aps.length}
          </span>
        )}
        <span className="w-24 shrink-0 truncate text-right text-xs text-slate-400 dark:text-slate-500">{kr.current_value ?? 0}/{kr.target_value ?? '—'} {kr.unit ?? ''}</span>
        <div className="w-24 shrink-0"><ProgressBar value={kr.progress} /></div>
        <span className="w-9 shrink-0 text-right text-xs text-slate-400 dark:text-slate-500">{Math.round(kr.progress)}%</span>
      </div>
      {open && aps.map((a: any) => (
        <div key={a.id} className="flex items-center gap-2 py-0.5 text-xs text-slate-500 dark:text-slate-400" style={{ paddingLeft: (depth + 1) * 18 + 48 }}>
          <span className="text-slate-300 dark:text-slate-600">↳</span>
          <span className="flex-1 truncate">{a.title}</span>
          {a.due_date && <span className="text-[10px] text-slate-400">{a.due_date}</span>}
          <StatusBadge status={a.status} />
        </div>
      ))}
    </div>
  );
}

function Node({ node, depth }: { node: ObjectiveNode; depth: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0 || node.key_results.length > 0;
  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
        style={{ paddingLeft: depth * 18 + 8 }}>
        <button onClick={() => setOpen(!open)} className={hasChildren ? '' : 'invisible'}>
          <ChevronRight className={`h-4 w-4 text-slate-400 dark:text-slate-500 transition ${open ? 'rotate-90' : ''}`} />
        </button>
        <span className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
          {node.level}
        </span>
        <Link to={`/okr/${node.id}`} className="flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-brand-700 dark:hover:text-brand-300">
          {node.title}
        </Link>
        <StatusBadge status={node.status} />
        <div className="w-28"><ProgressBar value={node.progress} /></div>
        <span className="w-10 text-right text-xs text-slate-500 dark:text-slate-400">{Math.round(node.progress)}%</span>
      </div>
      {open && (
        <div>
          {node.key_results.map((kr) => <KrRow key={kr.id} kr={kr} depth={depth} />)}
          {node.children.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

export default function OkrTree() {
  const qc = useQueryClient();
  const t = useT();
  const profile = useAuthStore((s) => s.profile);
  const [modal, setModal] = useState(false);
  const [view, setView] = useState<'tree' | 'timeline'>('tree');
  const [year, setYear] = useState(new Date().getFullYear());
  const tree = useQuery({ queryKey: ['okr', 'tree'], queryFn: () => objectivesService.tree() });
  const flat = useQuery({ queryKey: ['okr', 'flat'], queryFn: () => objectivesService.list() });

  const [form, setForm] = useState({
    title: '', level: 'team' as ObjectiveLevel, parent_objective_id: '', year: 2026, quarter: 2,
  });

  const create = useMutation({
    mutationFn: () => objectivesService.create({
      title: form.title,
      level: form.level,
      parent_objective_id: form.parent_objective_id || null,
      owner_id: profile?.id ?? null,
      team_id: profile && (profile as any).team_id ? (profile as any).team_id : null,
      year: form.year, quarter: form.quarter, status: 'not_started', priority: 'medium',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['okr'] });
      setModal(false); setForm({ ...form, title: '' });
    },
  });

  return (
    <>
      <PageHeader title={t('OKR 트리', 'OKR Tree')} subtitle={t('Company → Team → Personal 정렬', 'Company → Team → Personal alignment')}
        action={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
              <button onClick={() => setView('tree')} title={t('트리', 'Tree')}
                className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-xs', view === 'tree' ? 'bg-brand-600 text-white' : 'text-slate-500')}>
                <ListTree className="h-4 w-4" />{t('트리', 'Tree')}</button>
              <button onClick={() => setView('timeline')} title={t('타임라인', 'Timeline')}
                className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-xs', view === 'timeline' ? 'bg-brand-600 text-white' : 'text-slate-500')}>
                <GanttChartSquare className="h-4 w-4" />{t('타임라인', 'Timeline')}</button>
            </div>
            <button className="btn-primary" onClick={() => setModal(true)}><Plus className="h-4 w-4" />Objective</button>
          </div>
        } />

      {view === 'timeline' && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <button className="btn-ghost px-2 py-1" onClick={() => setYear((y) => y - 1)}>◀</button>
          <span className="font-semibold">{year}</span>
          <button className="btn-ghost px-2 py-1" onClick={() => setYear((y) => y + 1)}>▶</button>
          <span className="ml-2 text-xs text-slate-400">{t('막대 = 시작일~기한 · 빨간선 = 오늘', 'Bars = start→due · red line = today')}</span>
        </div>
      )}

      {tree.isLoading ? <Spinner /> : tree.isError ? (
        <Card className="p-6 text-center text-sm text-red-500">
          {t('불러오지 못했습니다', 'Failed to load')}: {String((tree.error as any)?.message ?? '')}
        </Card>
      ) : view === 'timeline' ? (
        <Card className="p-2"><OkrTimeline nodes={tree.data ?? []} year={year} /></Card>
      ) : (
        <Card className="p-2">
          {(tree.data ?? []).length === 0 && <div className="p-6 text-center text-sm text-slate-400 dark:text-slate-500">{t('Objective가 없습니다. 우측 상단에서 추가하세요.', 'No objectives yet. Add one from the top right.')}</div>}
          {(tree.data ?? []).map((n) => <Node key={n.id} node={n} depth={0} />)}
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={t('Objective 추가', 'Add objective')}>
        <div className="space-y-3">
          <Field label={t('제목', 'Title')}><input className="input" value={form.title} autoFocus
            onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('레벨', 'Level')}>
              <select className="input" value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value as ObjectiveLevel })}>
                <option value="company">company</option>
                <option value="team">team</option>
                <option value="personal">personal</option>
              </select>
            </Field>
            <Field label={t('상위 Objective', 'Parent objective')}>
              <select className="input" value={form.parent_objective_id}
                onChange={(e) => setForm({ ...form, parent_objective_id: e.target.value })}>
                <option value="">{t('(없음)', '(none)')}</option>
                {(flat.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
            </Field>
            <Field label={t('연도', 'Year')}><input className="input" type="number" value={form.year}
              onChange={(e) => setForm({ ...form, year: +e.target.value })} /></Field>
            <Field label={t('분기', 'Quarter')}><input className="input" type="number" min={1} max={4} value={form.quarter}
              onChange={(e) => setForm({ ...form, quarter: +e.target.value })} /></Field>
          </div>
          <button className="btn-primary w-full" disabled={!form.title || create.isPending}
            onClick={() => create.mutate()}>{create.isPending ? t('생성 중…', 'Creating…') : t('생성', 'Create')}</button>
        </div>
      </Modal>
    </>
  );
}
