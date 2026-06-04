import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardService } from '@/services/dashboard';
import { PageHeader } from '@/layouts/AppLayout';
import { StatCard, Card, ProgressBar, Spinner, StatusBadge, RiskBadge } from '@/components/ui';

export default function Dashboard() {
  const summary = useQuery({ queryKey: ['dash', 'summary'], queryFn: () => dashboardService.summary() });
  const kpis = useQuery({ queryKey: ['dash', 'kpi'], queryFn: () => dashboardService.kpiAchievement() });
  const insights = useQuery({ queryKey: ['dash', 'ai'], queryFn: () => dashboardService.aiInsights(5) });

  if (summary.isLoading) return <Spinner />;
  const s = summary.data!;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="회사는 지금 목표를 향해 제대로 가고 있는가?" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="전체 OKR 진행률" value={`${s.overallProgress}%`} />
        <StatCard label="Critical 6 완료율" value={`${s.c6Completion}%`} tone="good" />
        <StatCard label="위험 KR" value={s.atRiskKr} tone={s.atRiskKr ? 'danger' : 'default'} />
        <StatCard label="지연 작업" value={s.delayed} tone={s.delayed ? 'warn' : 'default'} />
        <StatCard label="이번 주 CFR 제출" value={s.cfrSubmitted} hint="명" />
        <StatCard label="오늘 집중 항목" value={s.todayFocus} />
        <StatCard label="미연결 Action" value={s.orphanActions} tone={s.orphanActions ? 'warn' : 'default'}
          hint="OKR 미연결" />
        <StatCard label="Objective 수" value={s.objectiveCount} hint={`KR ${s.krCount}`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">회사 Objective 진행 현황</h3>
          <div className="space-y-3">
            {s.companyObjectives.length === 0 && <p className="text-sm text-slate-400">데이터 없음</p>}
            {s.companyObjectives.map((o: any) => (
              <Link key={o.id} to={`/okr/${o.id}`} className="block">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">목표 #{o.id.slice(0, 4)}</span>
                  <span className="text-slate-500">{Math.round(o.progress)}%</span>
                </div>
                <ProgressBar value={o.progress} />
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">KPI 달성률</h3>
          <div className="space-y-2">
            {(kpis.data ?? []).slice(0, 6).map((k: any) => (
              <div key={k.name} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate text-slate-600">{k.name}</span>
                <ProgressBar value={k.achievement_rate ?? 0} />
                <span className="w-12 text-right text-slate-500">{Math.round(k.achievement_rate ?? 0)}%</span>
              </div>
            ))}
            {(kpis.data ?? []).length === 0 && <p className="text-sm text-slate-400">KPI 없음</p>}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">AI 위험 알림</h3>
        <div className="space-y-2">
          {(insights.data ?? []).map((i: any) => (
            <div key={i.id} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2 text-sm">
              {i.risk_level && <RiskBadge level={i.risk_level} />}
              <div>
                <div className="font-medium text-slate-700">{i.title}</div>
                <div className="text-slate-500">{i.summary}</div>
              </div>
            </div>
          ))}
          {(insights.data ?? []).length === 0 && <p className="text-sm text-slate-400">활성 알림 없음</p>}
        </div>
      </Card>
    </>
  );
}
