import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus } from 'lucide-react';
import { objectivesService, type ObjectiveNode } from '@/services/objectives';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, StatusBadge, ProgressBar, Modal, Field } from '@/components/ui';
import { useT } from '@/i18n';
import type { ObjectiveLevel } from '@/types';

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
          {node.key_results.map((kr) => (
            <div key={kr.id} className="flex items-center gap-2 py-1 text-sm text-slate-600 dark:text-slate-300"
              style={{ paddingLeft: (depth + 1) * 18 + 30 }}>
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              <span className="flex-1 truncate">{kr.title}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {kr.current_value ?? 0}/{kr.target_value ?? '—'} {kr.unit ?? ''}
              </span>
              <div className="w-24"><ProgressBar value={kr.progress} /></div>
            </div>
          ))}
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
        action={<button className="btn-primary" onClick={() => setModal(true)}><Plus className="h-4 w-4" />Objective</button>} />

      {tree.isLoading ? <Spinner /> : (
        <Card className="p-2">
          {tree.data!.length === 0 && <div className="p-6 text-center text-sm text-slate-400 dark:text-slate-500">{t('Objective가 없습니다. 우측 상단에서 추가하세요.', 'No objectives yet. Add one from the top right.')}</div>}
          {tree.data!.map((n) => <Node key={n.id} node={n} depth={0} />)}
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
