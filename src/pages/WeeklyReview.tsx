import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { teamsService } from '@/services/teams';
import { reviewService } from '@/services/review';
import { aiService, type AiResult } from '@/ai/aiService';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, StatCard } from '@/components/ui';
import { AiResultCard } from '@/components/AiResultCard';
import { weekStart } from '@/lib/date';
import { useT } from '@/i18n';

export default function WeeklyReview() {
  const t = useT();
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
      <PageHeader title={t('주간 AI 리뷰', 'Weekly AI Review')} subtitle={`${weekStart()} · ${t('완료/지연/위험/지원 자동 정리', 'auto summary: done/delayed/at-risk/support')}`}
        action={
          <div className="flex gap-2">
            <select className="input w-44" value={teamId} onChange={(e) => { setTeamId(e.target.value); setAi(null); }}>
              <option value="">{t('전사', 'Company-wide')}</option>
              {(teams.data ?? []).map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
            </select>
            <button className="btn-primary" disabled={inputs.isLoading || run.isPending} onClick={() => run.mutate()}>
              {run.isPending ? t('분석 중…', 'Analyzing…') : t('AI Review 생성', 'Generate AI Review')}
            </button>
          </div>
        } />

      {inputs.isLoading || !i ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label={t('완료', 'Completed')} value={i.completed.length} tone="good" />
            <StatCard label={t('지연/위험', 'Delayed/at-risk')} value={i.delayed.length} tone="warn" />
            <StatCard label={t('위험 KR', 'At-risk KRs')} value={i.atRiskKr.length} tone={i.atRiskKr.length ? 'danger' : 'default'} />
            <StatCard label={t('CFR 미작성', 'CFR not submitted')} value={i.membersWithoutCfr.length} hint={teamId ? t('명', 'people') : t('팀 선택 시 집계', 'select a team')} />
          </div>

          {ai && <div className="mt-4"><AiResultCard result={ai} title={t('주간 AI 리뷰', 'Weekly AI Review')} /></div>}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('위험 KR', 'At-risk KRs')}</h3>
              {i.atRiskKr.length === 0 ? <p className="text-sm text-slate-400 dark:text-slate-500">{t('없음', 'None')}</p> :
                i.atRiskKr.map((k: any) => (
                  <div key={k.id} className="flex justify-between border-b border-slate-50 dark:border-slate-800 py-1 text-sm">
                    <span className="text-slate-700 dark:text-slate-200">{k.title}</span>
                    <span className="text-amber-600">{Math.round(k.progress)}%</span>
                  </div>
                ))}
            </Card>
            <Card>
              <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('지연/위험 작업', 'Delayed/at-risk tasks')}</h3>
              {i.delayed.length === 0 ? <p className="text-sm text-slate-400 dark:text-slate-500">{t('없음', 'None')}</p> :
                i.delayed.slice(0, 10).map((t: any) => (
                  <div key={t.id} className="border-b border-slate-50 dark:border-slate-800 py-1 text-sm text-slate-700 dark:text-slate-200">{t.title}</div>
                ))}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
