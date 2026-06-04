import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { teamsService } from '@/services/teams';
import { reviewService } from '@/services/review';
import { aiService, type AiResult } from '@/ai/aiService';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, ProgressBar, EmptyState } from '@/components/ui';
import { AiResultCard } from '@/components/AiResultCard';
import { useT } from '@/i18n';

export default function TeamReview() {
  const t = useT();
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => teamsService.list() });
  const [teamId, setTeamId] = useState('');
  const [ai, setAi] = useState<AiResult | null>(null);

  // Default to the first team once loaded.
  useEffect(() => {
    if (!teamId && teams.data?.length) setTeamId(teams.data[0].id);
  }, [teams.data, teamId]);

  const data = useQuery({
    queryKey: ['team', 'breakdown', teamId],
    queryFn: () => reviewService.teamBreakdown(teamId),
    enabled: !!teamId,
  });

  const brief = useMutation({
    mutationFn: async () => {
      const inputs = await reviewService.weeklyInputs(teamId);
      return aiService.teamBriefing({
        completed: inputs.completed, delayed: inputs.delayed,
        atRiskKr: inputs.atRiskKr, membersWithoutCfr: inputs.membersWithoutCfr,
      });
    },
    onSuccess: setAi,
  });

  return (
    <>
      <PageHeader title={t('팀 리뷰', 'Team Review')} subtitle={t('팀원별 진행률 · 작업 · CFR · 위험 KR', 'Per-member progress · tasks · CFR · at-risk KRs')}
        action={
          <div className="flex gap-2">
            <select className="input w-44" value={teamId} onChange={(e) => { setTeamId(e.target.value); setAi(null); }}>
              {(teams.data ?? []).map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
            </select>
            <button className="btn-primary" disabled={!teamId || brief.isPending} onClick={() => brief.mutate()}>
              {brief.isPending ? t('분석 중…', 'Analyzing…') : t('AI 팀장 브리핑', 'AI manager briefing')}
            </button>
          </div>
        } />

      {ai && <div className="mb-4"><AiResultCard result={ai} title={t('AI 팀장 브리핑', 'AI manager briefing')} /></div>}

      {data.isLoading || !data.data ? <Spinner /> : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 text-left text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">{t('팀원', 'Member')}</th><th className="px-2 py-2 w-40">{t('KR 진행률', 'KR progress')}</th>
                  <th className="px-2 py-2">{t('작업', 'Tasks')}</th><th className="px-2 py-2">{t('지연', 'Delayed')}</th><th className="px-2 py-2">{t('이번 주 CFR', 'CFR this week')}</th>
                </tr>
              </thead>
              <tbody>
                {data.data.members.map((m: any) => (
                  <tr key={m.user?.id} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-700 dark:text-slate-200">{m.user?.full_name ?? '—'}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">{m.role} · {m.user?.title ?? ''}</div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2"><ProgressBar value={m.krProgress} /><span className="w-9 text-right text-xs">{m.krProgress}%</span></div>
                    </td>
                    <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{m.taskCount}</td>
                    <td className="px-2 py-2"><span className={m.delayed ? 'font-medium text-red-600' : 'text-slate-400 dark:text-slate-500'}>{m.delayed}</span></td>
                    <td className="px-2 py-2">
                      {m.cfrSubmitted
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        : <XCircle className="h-4 w-4 text-red-400" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.data.members.length === 0 && <EmptyState>{t('팀원이 없습니다.', 'No team members.')}</EmptyState>}
          </Card>

          <Card className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('위험 KR', 'At-risk KRs')} ({data.data.atRiskKr.length})</h3>
            {data.data.atRiskKr.length === 0 ? <p className="text-sm text-slate-400 dark:text-slate-500">{t('없음', 'None')}</p> :
              data.data.atRiskKr.map((k: any) => (
                <div key={k.id} className="flex justify-between border-b border-slate-50 dark:border-slate-800 py-1 text-sm">
                  <span className="text-slate-700 dark:text-slate-200">{k.title}</span><span className="text-amber-600">{Math.round(k.progress)}%</span>
                </div>
              ))}
          </Card>
        </>
      )}
    </>
  );
}
