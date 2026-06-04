// Lighter pages for phase 2-3 features. They read real data where trivial so
// they are functional, not dummy — full build-out happens in later MVP stages.
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard';
import { useAuthStore } from '@/stores/auth';
import { aiService } from '@/ai/aiService';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner } from '@/components/ui';
import { useEffect, useState } from 'react';
import type { AiResult } from '@/ai/aiService';

export function Executive() {
  const summary = useQuery({ queryKey: ['dash', 'summary'], queryFn: () => dashboardService.summary() });
  const [ai, setAi] = useState<AiResult | null>(null);
  useEffect(() => {
    if (summary.data) aiService.executiveSummary({ ...summary.data, atRiskKr: [], delayed: [], completed: [], membersWithoutCfr: [] }).then(setAi);
  }, [summary.data]);
  if (summary.isLoading) return <Spinner />;
  const s = summary.data!;
  return (
    <>
      <PageHeader title="Executive View" subtitle="회사 전체 달성률 · 핵심 KPI · 위험 목표" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><div className="text-xs text-slate-500">전체 진행률</div><div className="text-2xl font-bold">{s.overallProgress}%</div></Card>
        <Card><div className="text-xs text-slate-500">위험 KR</div><div className="text-2xl font-bold text-red-600">{s.atRiskKr}</div></Card>
        <Card><div className="text-xs text-slate-500">지연 작업</div><div className="text-2xl font-bold text-amber-600">{s.delayed}</div></Card>
        <Card><div className="text-xs text-slate-500">미연결 Action</div><div className="text-2xl font-bold">{s.orphanActions}</div></Card>
      </div>
      {ai && <div className="mt-4 max-w-2xl">{/* reuse card */}<pre className="hidden">{JSON.stringify(ai)}</pre>
        <Card><h3 className="mb-2 text-sm font-semibold">AI Executive Summary</h3>
          <p className="text-sm text-slate-700">{ai.summary}</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">{ai.key_findings.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </Card></div>}
    </>
  );
}

export function Settings() {
  const profile = useAuthStore((s) => s.profile);
  return (
    <>
      <PageHeader title="Settings" subtitle="프로필 · AI · 데이터 소스" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">내 프로필</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">이름</dt><dd>{profile?.full_name}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">이메일</dt><dd>{profile?.email}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">역할</dt><dd>{profile?.role}</dd></div>
          </dl>
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">AI Provider</h3>
          <p className="text-sm text-slate-600">현재: <b>{aiService.providerName}</b></p>
          <p className="mt-1 text-xs text-slate-400">.env의 VITE_AI_PROVIDER로 mock → claude/openai 전환. 코드 변경 불필요.</p>
        </Card>
      </div>
    </>
  );
}
