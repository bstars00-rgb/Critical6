import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { teamsService } from '@/services/teams';
import { reviewService } from '@/services/review';
import { aiService, type AiResult } from '@/ai/aiService';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, StatCard } from '@/components/ui';
import { AiResultCard } from '@/components/AiResultCard';
import { weekStart } from '@/lib/date';

export default function WeeklyReview() {
  const [teamId, setTeamId] = useState('');
  const [ai, setAi] = useState<AiResult | null>(null);
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => teamsService.list() });
  const inputs = useQuery({
    queryKey: ['review', 'weekly', teamId],
    queryFn: () => reviewService.weeklyInputs(teamId || undefined),
  });

  const run = useMutation({
    mutationFn: async () => {
      const i = inputs.data!;
      return aiService.weeklyReview({
        completed: i.completed, delayed: i.delayed, atRiskKr: i.atRiskKr, membersWithoutCfr: i.membersWithoutCfr,
      });
    },
    onSuccess: setAi,
  });

  const i = inputs.data;

  return (
    <>
      <PageHeader title="Weekly AI Review" subtitle={`${weekStart()} 주차 · 완료/지연/위험/지원 자동 정리`}
        action={
          <div className="flex gap-2">
            <select className="input w-44" value={teamId} onChange={(e) => { setTeamId(e.target.value); setAi(null); }}>
              <option value="">전사</option>
              {(teams.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="btn-primary" disabled={inputs.isLoading || run.isPending} onClick={() => run.mutate()}>
              {run.isPending ? '분석 중…' : 'AI Review 생성'}
            </button>
          </div>
        } />

      {inputs.isLoading || !i ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="완료" value={i.completed.length} tone="good" />
            <StatCard label="지연/위험" value={i.delayed.length} tone="warn" />
            <StatCard label="위험 KR" value={i.atRiskKr.length} tone={i.atRiskKr.length ? 'danger' : 'default'} />
            <StatCard label="CFR 미작성" value={i.membersWithoutCfr.length} hint={teamId ? '명' : '팀 선택 시 집계'} />
          </div>

          {ai && <div className="mt-4"><AiResultCard result={ai} title="Weekly AI Review" /></div>}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">위험 KR</h3>
              {i.atRiskKr.length === 0 ? <p className="text-sm text-slate-400">없음</p> :
                i.atRiskKr.map((k: any) => (
                  <div key={k.id} className="flex justify-between border-b border-slate-50 py-1 text-sm">
                    <span className="text-slate-700">{k.title}</span>
                    <span className="text-amber-600">{Math.round(k.progress)}%</span>
                  </div>
                ))}
            </Card>
            <Card>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">지연/위험 작업</h3>
              {i.delayed.length === 0 ? <p className="text-sm text-slate-400">없음</p> :
                i.delayed.slice(0, 10).map((t: any) => (
                  <div key={t.id} className="border-b border-slate-50 py-1 text-sm text-slate-700">{t.title}</div>
                ))}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
