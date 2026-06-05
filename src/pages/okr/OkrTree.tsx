import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus, ListTree, GanttChartSquare, Zap, AlertTriangle } from 'lucide-react';
import { objectivesService, type ObjectiveNode } from '@/services/objectives';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, StatusBadge, ProgressBar, Modal, Field } from '@/components/ui';
import { OkrTimeline } from '@/components/OkrTimeline';
import { okrHealth, healthText } from '@/lib/okrHealth';
import { useT, useLang } from '@/i18n';
import { cn } from '@/lib/cn';
import type { ObjectiveLevel } from '@/types';

type CodeOf = (id: string) => string;

function TypeBadge({ kind, level }: { kind: 'obj' | 'kr' | 'ap'; level?: string }) {
  if (kind === 'obj') {
    const c = level === 'company' ? 'bg-indigo-600' : level === 'team' ? 'bg-brand-600' : 'bg-slate-500';
    return <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${c} text-[11px] font-bold uppercase text-white`}>{(level ?? 'O')[0]}</span>;
  }
  if (kind === 'kr') return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-orange-500 text-[9px] font-bold text-white">KR</span>;
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-violet-500 text-white"><Zap className="h-3.5 w-3.5" /></span>;
}

function Grade({ value }: { value: number }) {
  const v = Math.round(value);
  const c = v >= 70 ? 'text-emerald-600' : v >= 40 ? 'text-amber-600' : v > 0 ? 'text-red-500' : 'text-slate-400 dark:text-slate-500';
  return <span className={`w-12 shrink-0 text-right text-sm font-semibold ${c}`}>{v}%</span>;
}

const apGrade = (a: any) => {
  const cl = Array.isArray(a.checklist) ? a.checklist : [];
  if (a.status === 'completed') return 100;
  if (cl.length) return Math.round((cl.filter((c: any) => c?.done).length / cl.length) * 100);
  return a.status === 'not_started' ? 0 : 30;
};

const rowCls = 'flex items-center gap-2 border-b border-slate-50 py-2 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40';

function KrRow({ kr, depth, codeOf }: { kr: any; depth: number; codeOf: CodeOf }) {
  const [open, setOpen] = useState(false);
  const aps = kr.action_plans ?? [];
  return (
    <div>
      <div className={rowCls} style={{ paddingLeft: depth * 22 + 30 }}>
        <button onClick={() => setOpen(!open)} className={aps.length ? '' : 'invisible'}>
          <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition ${open ? 'rotate-90' : ''}`} />
        </button>
        <TypeBadge kind="kr" />
        <span className="shrink-0 text-xs font-bold text-orange-500">{codeOf(kr.id)}</span>
        <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{kr.title}</span>
        <span className="hidden shrink-0 text-[10px] text-slate-400 dark:text-slate-500 sm:inline">{kr.current_value ?? 0}/{kr.target_value ?? '—'} {kr.unit ?? ''}</span>
        <Grade value={kr.progress} />
        <div className="flex w-28 shrink-0 justify-center"><StatusBadge status={kr.status} /></div>
      </div>
      {open && aps.map((a: any) => (
        <div key={a.id} className={rowCls} style={{ paddingLeft: (depth + 1) * 22 + 30 }}>
          <span className="w-3.5 shrink-0" />
          <TypeBadge kind="ap" />
          <span className="shrink-0 text-xs font-bold text-violet-500">{codeOf(a.id)}</span>
          <span className="flex-1 truncate text-sm text-slate-500 dark:text-slate-400">{a.title}</span>
          <Grade value={apGrade(a)} />
          <div className="flex w-28 shrink-0 justify-center"><StatusBadge status={a.status} /></div>
        </div>
      ))}
    </div>
  );
}

function Node({ node, depth, codeOf }: { node: ObjectiveNode; depth: number; codeOf: CodeOf }) {
  const lang = useLang();
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0 || node.key_results.length > 0;
  const health = okrHealth(node, node.key_results);
  return (
    <div>
      <div className={rowCls} style={{ paddingLeft: depth * 22 + 8 }}>
        <button onClick={() => setOpen(!open)} className={hasChildren ? '' : 'invisible'}>
          <ChevronRight className={`h-4 w-4 text-slate-400 dark:text-slate-500 transition ${open ? 'rotate-90' : ''}`} />
        </button>
        <TypeBadge kind="obj" level={node.level} />
        <span className="shrink-0 text-xs font-bold text-brand-600 dark:text-brand-300">{codeOf(node.id)}</span>
        <Link to={`/okr/${node.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100 hover:text-brand-700 dark:hover:text-brand-300">
          {node.title}
        </Link>
        {health.level !== 'none' && (
          <span title={healthText(health, lang)}
            className={`shrink-0 ${health.level === 'risk' ? 'text-red-500' : 'text-amber-500'}`}>
            <AlertTriangle className="h-4 w-4" />
          </span>
        )}
        <Grade value={node.progress} />
        <div className="flex w-28 shrink-0 justify-center"><StatusBadge status={node.status} /></div>
      </div>
      {open && (
        <div>
          {node.key_results.map((kr) => <KrRow key={kr.id} kr={kr} depth={depth + 1} codeOf={codeOf} />)}
          {node.children.map((c) => <Node key={c.id} node={c} depth={depth + 1} codeOf={codeOf} />)}
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

  // Stable display codes (O-1, KR-1, A-1) in render order.
  const codeMap = useMemo(() => {
    const m = new Map<string, string>(); const c = { o: 0, kr: 0, ap: 0 };
    const walk = (nodes: ObjectiveNode[]) => {
      for (const o of nodes) {
        m.set(o.id, `O-${++c.o}`);
        for (const kr of o.key_results as any[]) {
          m.set(kr.id, `KR-${++c.kr}`);
          for (const ap of (kr.action_plans ?? [])) m.set(ap.id, `A-${++c.ap}`);
        }
        walk(o.children);
      }
    };
    walk(tree.data ?? []);
    return m;
  }, [tree.data]);
  const codeOf: CodeOf = (id) => codeMap.get(id) ?? '';

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
        <Card className="p-0">
          <div className="flex items-center gap-2 border-b border-slate-200 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700">
            <span className="flex-1 pl-8">{t('목표 및 핵심 결과', 'Objectives & Key Results')}</span>
            <span className="w-12 text-right">{t('진행률', 'Grade')}</span>
            <span className="w-28 text-center">{t('상태', 'Status')}</span>
          </div>
          {(tree.data ?? []).length === 0 && <div className="p-6 text-center text-sm text-slate-400 dark:text-slate-500">{t('Objective가 없습니다. 우측 상단에서 추가하세요.', 'No objectives yet. Add one from the top right.')}</div>}
          {(tree.data ?? []).map((n) => <Node key={n.id} node={n} depth={0} codeOf={codeOf} />)}
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
