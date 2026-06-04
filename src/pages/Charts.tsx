import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { actionPlansService } from '@/services/actionPlans';
import { dashboardService } from '@/services/dashboard';
import { kpisService } from '@/services/kpis';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner } from '@/components/ui';
import { statusLabel, priorityLabel } from '@/lib/constants';
import { useLang, useT } from '@/i18n';
import type { OkrStatus, Priority } from '@/types';

const COLORS = ['#94a3b8', '#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#64748b'];

export default function Charts() {
  const lang = useLang();
  const t = useT();
  const actions = useQuery({ queryKey: ['ap', 'board'], queryFn: () => actionPlansService.board() });
  const team = useQuery({ queryKey: ['dash', 'team'], queryFn: () => dashboardService.teamProgress() });
  const kpis = useQuery({ queryKey: ['kpi', 'list'], queryFn: () => kpisService.list() });

  if (actions.isLoading || team.isLoading) return <Spinner />;
  const items = actions.data ?? [];

  const byStatus = Object.entries(
    items.reduce<Record<string, number>>((m, i) => ((m[i.status] = (m[i.status] ?? 0) + 1), m), {}),
  ).map(([k, v]) => ({ name: statusLabel(k as OkrStatus, lang), value: v }));

  const byPriority = Object.entries(
    items.reduce<Record<string, number>>((m, i) => ((m[i.priority] = (m[i.priority] ?? 0) + 1), m), {}),
  ).map(([k, v]) => ({ name: priorityLabel(k as Priority, lang), value: v }));

  const byOwner = Object.entries(
    items.reduce<Record<string, number>>((m, i) => {
      const key = i.owner_id?.slice(0, 6) ?? t('미지정', 'Unassigned');
      m[key] = (m[key] ?? 0) + 1; return m;
    }, {}),
  ).map(([k, v]) => ({ name: k, value: v }));

  const kpiData = (kpis.data ?? []).map((k) => ({ name: k.name.slice(0, 12), value: Math.round(k.achievement_rate ?? 0) }));

  return (
    <>
      <PageHeader title={t('차트 & 분석', 'Charts & Analysis')} subtitle={t('의사결정용 분석 — 병목·과부하·미달 지점', 'Decision analytics — bottlenecks, overload, shortfalls')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('상태별 작업 수', 'Tasks by status')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={80} label>
                {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('우선순위별 작업 수', 'Tasks by priority')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byPriority}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip />
              <Bar dataKey="value" fill="#3b6fff" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('팀별 OKR 진행률', 'OKR progress by team')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={team.data ?? []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="team" /><YAxis domain={[0, 100]} /><Tooltip />
              <Bar dataKey="progress" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('담당자별 업무량', 'Workload by owner')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byOwner}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip />
              <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('KR별 KPI 달성률', 'KPI achievement by KR')}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={kpiData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[0, 120]} /><Tooltip />
              <Bar dataKey="value" fill="#3b6fff" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </>
  );
}
