import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle } from 'lucide-react';
import { criticalSixService } from '@/services/criticalSix';
import { actionPlansService } from '@/services/actionPlans';
import { aiService, type AiResult } from '@/ai/aiService';
import { useAuthStore } from '@/stores/auth';
import { useState, useEffect } from 'react';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, StatusBadge, EmptyState } from '@/components/ui';
import { AiResultCard } from '@/components/AiResultCard';

export default function MyDay() {
  const qc = useQueryClient();
  const profile = useAuthStore((s) => s.profile);
  const uid = profile?.id;
  const [ai, setAi] = useState<AiResult | null>(null);

  const c6 = useQuery({ queryKey: ['c6', 'owner', uid], queryFn: () => criticalSixService.byOwner(uid!), enabled: !!uid });
  const actions = useQuery({ queryKey: ['ap', 'owner', uid], queryFn: () => actionPlansService.byOwner(uid!), enabled: !!uid });

  const today = (c6.data ?? []).filter((c) => c.is_today_focus && c.status !== 'completed');
  const myDelayed = [...(c6.data ?? []), ...(actions.data ?? [])].filter((t: any) => t.status === 'delayed');

  useEffect(() => {
    if (c6.data) {
      aiService.nextAction({ items: [...(c6.data ?? []), ...(actions.data ?? [])] }).then(setAi);
    }
  }, [c6.data, actions.data]);

  const complete = useMutation({
    mutationFn: (cid: string) => criticalSixService.complete(cid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['c6'] }),
  });

  if (c6.isLoading) return <Spinner />;

  return (
    <>
      <PageHeader title="My Day" subtitle={`${profile?.full_name ?? ''} · 오늘 가장 중요한 실행`} />

      {ai && <div className="mb-4"><AiResultCard result={ai} title="AI 추천 우선순위" /></div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">🔥 오늘의 Critical 6 ({today.length})</h3>
          {today.length === 0 ? <EmptyState>오늘 집중 항목이 없습니다. Critical 6에서 지정하세요.</EmptyState> : (
            <div className="space-y-2">
              {today.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2">
                  <button onClick={() => complete.mutate(c.id)}>
                    {c.status === 'completed'
                      ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      : <Circle className="h-5 w-5 text-slate-300" />}
                  </button>
                  <span className="flex-1 text-sm text-slate-700">{c.title}</span>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">⏰ 지연된 내 작업 ({myDelayed.length})</h3>
          {myDelayed.length === 0 ? <EmptyState>지연 작업 없음 👍</EmptyState> : (
            <div className="space-y-2">
              {myDelayed.map((t: any) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50/40 p-2 text-sm">
                  <span className="flex-1 text-slate-700">{t.title}</span>
                  <span className="text-xs text-red-500">{t.due_date ?? ''}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
