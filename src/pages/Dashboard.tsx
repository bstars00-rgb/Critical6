import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardService } from '@/services/dashboard';
import { PageHeader } from '@/layouts/AppLayout';
import { StatCard, Card, ProgressBar, Spinner, StatusBadge, RiskBadge } from '@/components/ui';
import { useT } from '@/i18n';

export default function Dashboard() {
  const t = useT();
  const summary = useQuery({ queryKey: ['dash', 'summary'], queryFn: () => dashboardService.summary() });
  const kpis = useQuery({ queryKey: ['dash', 'kpi'], queryFn: () => dashboardService.kpiAchievement() });
  const insights = useQuery({ queryKey: ['dash', 'ai'], queryFn: () => dashboardService.aiInsights(5) });

  if (summary.isLoading) return <Spinner />;
  const s = summary.data!;

  return (
    <>
      <PageHeader title={t('대시보드', 'Dashboard')} subtitle={t('회사는 지금 목표를 향해 제대로 가고 있는가?', 'Is the company on track toward its goals?')} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        <StatCard label={t('전체 OKR 진행률', 'Overall OKR progress')} value={`${s.overallProgress}%`} />
        <StatCard label={t('Critical 6 완료율', 'Critical 6 completion')} value={`${s.c6Completion}%`} tone="good" />
        <StatCard label={t('위험 KR', 'At-risk KRs')} value={s.atRiskKr} tone={s.atRiskKr ? 'danger' : 'default'} />
        <StatCard label={t('지연 작업', 'Delayed tasks')} value={s.delayed} tone={s.delayed ? 'warn' : 'default'} />
        <StatCard label={t('이번 주 CFR 제출', 'CFR submitted this week')} value={s.cfrSubmitted} hint={t('명', 'people')} />
        <StatCard label={t('오늘 집중 항목', "Today's focus")} value={s.todayFocus} />
        <StatCard label={t('미연결 Action', 'Unlinked actions')} value={s.orphanActions} tone={s.orphanActions ? 'warn' : 'default'}
          hint={t('OKR 미연결', 'no OKR link')} />
        <StatCard label={t('Objective 수', 'Objectives')} value={s.objectiveCount} hint={`KR ${s.krCount}`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('회사 Objective 진행 현황', 'Company objective progress')}</h3>
          <div className="space-y-3">
            {s.companyObjectives.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">{t('데이터 없음', 'No data')}</p>}
            {s.companyObjectives.map((o: any) => (
              <Link key={o.id} to={`/okr/${o.id}`} className="block">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{t('목표', 'Objective')} #{o.id.slice(0, 4)}</span>
                  <span className="text-slate-500 dark:text-slate-400">{Math.round(o.progress)}%</span>
                </div>
                <ProgressBar value={o.progress} />
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('KPI 달성률', 'KPI achievement')}</h3>
          <div className="space-y-2">
            {(kpis.data ?? []).slice(0, 6).map((k: any) => (
              <div key={k.name} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate text-slate-600 dark:text-slate-300">{k.name}</span>
                <ProgressBar value={k.achievement_rate ?? 0} />
                <span className="w-12 text-right text-slate-500 dark:text-slate-400">{Math.round(k.achievement_rate ?? 0)}%</span>
              </div>
            ))}
            {(kpis.data ?? []).length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">{t('KPI 없음', 'No KPIs')}</p>}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('AI 위험 알림', 'AI risk alerts')}</h3>
        <div className="space-y-2">
          {(insights.data ?? []).map((i: any) => (
            <div key={i.id} className="flex items-start gap-2 rounded-lg border border-slate-100 dark:border-slate-700 p-2 text-sm">
              {i.risk_level && <RiskBadge level={i.risk_level} />}
              <div>
                <div className="font-medium text-slate-700 dark:text-slate-200">{i.title}</div>
                <div className="text-slate-500 dark:text-slate-400">{i.summary}</div>
              </div>
            </div>
          ))}
          {(insights.data ?? []).length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">{t('활성 알림 없음', 'No active alerts')}</p>}
        </div>
      </Card>
    </>
  );
}
