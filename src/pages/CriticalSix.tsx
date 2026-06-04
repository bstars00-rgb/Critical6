import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, CheckCircle2, AlertTriangle } from 'lucide-react';
import { criticalSixService } from '@/services/criticalSix';
import { keyResultsService } from '@/services/keyResults';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, StatusBadge, Modal, Field, EmptyState } from '@/components/ui';

export default function CriticalSix() {
  const qc = useQueryClient();
  const profile = useAuthStore((s) => s.profile);
  const uid = profile?.id;
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: '', key_result_id: '', completion_criteria: '', due_date: '' });

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

  const create = useMutation({
    mutationFn: () => criticalSixService.create({
      title: form.title, owner_id: uid!, key_result_id: form.key_result_id || null,
      completion_criteria: form.completion_criteria || null, due_date: form.due_date || null,
      status: 'not_started', priority: 'important', is_weekly_focus: true,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['c6'] }); setModal(false); setForm({ title: '', key_result_id: '', completion_criteria: '', due_date: '' }); },
  });
  const toggleToday = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => criticalSixService.toggleToday(id, on),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['c6'] }),
  });
  const complete = useMutation({
    mutationFn: (id: string) => criticalSixService.complete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['c6'] }),
  });

  function Row({ c }: { c: any }) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-100 p-2">
        <button title="오늘 집중" onClick={() => toggleToday.mutate({ id: c.id, on: !c.is_today_focus })}>
          <Star className={`h-4 w-4 ${c.is_today_focus ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
        </button>
        <button onClick={() => complete.mutate(c.id)}>
          <CheckCircle2 className={`h-5 w-5 ${c.status === 'completed' ? 'text-emerald-500' : 'text-slate-300'}`} />
        </button>
        <div className="flex-1">
          <div className="text-sm text-slate-700">{c.title}</div>
          {c.completion_criteria && <div className="text-[11px] text-slate-400">완료기준: {c.completion_criteria}</div>}
        </div>
        {c.due_date && <span className="text-xs text-slate-400">{c.due_date}</span>}
        <StatusBadge status={c.status} />
      </div>
    );
  }

  if (list.isLoading) return <Spinner />;

  return (
    <>
      <PageHeader title="Critical 6" subtitle="매일/매주 반드시 집중하는 핵심 실행 (≤6)"
        action={<button className="btn-primary" onClick={() => setModal(true)}><Plus className="h-4 w-4" />추가</button>} />

      {overloaded && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          활성 Critical 6가 {active.length}개입니다. 6개 이하로 집중하세요. (AI 경고)
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card><h3 className="mb-2 text-sm font-semibold">🔥 Today ({groups.today.length})</h3>
          <div className="space-y-2">{groups.today.length ? groups.today.map((c) => <Row key={c.id} c={c} />) : <EmptyState>없음</EmptyState>}</div></Card>
        <Card><h3 className="mb-2 text-sm font-semibold">📅 This Week ({groups.week.length})</h3>
          <div className="space-y-2">{groups.week.length ? groups.week.map((c) => <Row key={c.id} c={c} />) : <EmptyState>없음</EmptyState>}</div></Card>
        <Card><h3 className="mb-2 text-sm font-semibold">⏰ Delayed ({groups.delayed.length})</h3>
          <div className="space-y-2">{groups.delayed.length ? groups.delayed.map((c) => <Row key={c.id} c={c} />) : <EmptyState>없음</EmptyState>}</div></Card>
        <Card><h3 className="mb-2 text-sm font-semibold">✅ Completed ({groups.completed.length})</h3>
          <div className="space-y-2">{groups.completed.length ? groups.completed.map((c) => <Row key={c.id} c={c} />) : <EmptyState>없음</EmptyState>}</div></Card>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Critical 6 추가">
        <div className="space-y-3">
          <Field label="제목"><input className="input" autoFocus value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="연결할 KR">
            <select className="input" value={form.key_result_id}
              onChange={(e) => setForm({ ...form, key_result_id: e.target.value })}>
              <option value="">(KR 선택 — 연결 권장)</option>
              {(krs.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}
            </select>
          </Field>
          <Field label="완료 기준"><input className="input" value={form.completion_criteria}
            onChange={(e) => setForm({ ...form, completion_criteria: e.target.value })} /></Field>
          <Field label="마감일"><input className="input" type="date" value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
          {active.length >= 6 && <p className="text-xs text-amber-600">⚠ 이미 활성 항목이 6개입니다.</p>}
          <button className="btn-primary w-full" disabled={!form.title || create.isPending}
            onClick={() => create.mutate()}>{create.isPending ? '추가 중…' : '추가'}</button>
        </div>
      </Modal>
    </>
  );
}
