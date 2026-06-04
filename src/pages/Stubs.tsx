// Lighter pages for phase 2-3 features. They read real data where trivial so
// they are functional, not dummy — full build-out happens in later MVP stages.
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard';
import { useAuthStore } from '@/stores/auth';
import { useUi } from '@/stores/ui';
import { useT } from '@/i18n';
import { aiService } from '@/ai/aiService';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner } from '@/components/ui';
import { useEffect, useState } from 'react';
import type { AiResult } from '@/ai/aiService';

export function Executive() {
  const t = useT();
  const summary = useQuery({ queryKey: ['dash', 'summary'], queryFn: () => dashboardService.summary() });
  const [ai, setAi] = useState<AiResult | null>(null);
  useEffect(() => {
    if (summary.data) aiService.executiveSummary({ ...summary.data, atRiskKr: [], delayed: [], completed: [], membersWithoutCfr: [] }).then(setAi);
  }, [summary.data]);
  if (summary.isLoading) return <Spinner />;
  const s = summary.data!;
  return (
    <>
      <PageHeader title={t('경영진 뷰', 'Executive View')} subtitle={t('회사 전체 달성률 · 핵심 KPI · 위험 목표', 'Company-wide achievement · key KPIs · at-risk goals')} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">{t('전체 진행률', 'Overall progress')}</div><div className="text-2xl font-bold">{s.overallProgress}%</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">{t('위험 KR', 'At-risk KRs')}</div><div className="text-2xl font-bold text-red-600">{s.atRiskKr}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">{t('지연 작업', 'Delayed tasks')}</div><div className="text-2xl font-bold text-amber-600">{s.delayed}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">{t('미연결 Action', 'Unlinked actions')}</div><div className="text-2xl font-bold">{s.orphanActions}</div></Card>
      </div>
      {ai && <div className="mt-4 max-w-2xl">{/* reuse card */}<pre className="hidden">{JSON.stringify(ai)}</pre>
        <Card><h3 className="mb-2 text-sm font-semibold">AI Executive Summary</h3>
          <p className="text-sm text-slate-700 dark:text-slate-200">{ai.summary}</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">{ai.key_findings.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </Card></div>}
    </>
  );
}

export function Settings() {
  const profile = useAuthStore((s) => s.profile);
  const { theme, setTheme, lang, setLang } = useUi();
  const t = useT();
  const seg = 'rounded-lg px-3 py-1.5 text-sm font-medium';
  const on = 'bg-brand-600 text-white';
  const off = 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700';
  return (
    <>
      <PageHeader title={t('설정', 'Settings')} subtitle={t('테마 · 언어 · 프로필 · AI', 'Theme · Language · Profile · AI')} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('화면', 'Appearance')}</h3>
          <div className="mb-3">
            <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">{t('테마', 'Theme')}</div>
            <div className="inline-flex gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
              <button className={`${seg} ${theme === 'light' ? on : off}`} onClick={() => setTheme('light')}>{t('라이트', 'Light')}</button>
              <button className={`${seg} ${theme === 'dark' ? on : off}`} onClick={() => setTheme('dark')}>{t('다크', 'Dark')}</button>
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">{t('언어', 'Language')}</div>
            <div className="inline-flex gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
              <button className={`${seg} ${lang === 'ko' ? on : off}`} onClick={() => setLang('ko')}>한국어</button>
              <button className={`${seg} ${lang === 'en' ? on : off}`} onClick={() => setLang('en')}>English</button>
            </div>
          </div>
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('내 프로필', 'My profile')}</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">{t('이름', 'Name')}</dt><dd>{profile?.full_name}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">{t('이메일', 'Email')}</dt><dd>{profile?.email}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">{t('역할', 'Role')}</dt><dd>{profile?.role}</dd></div>
          </dl>
          <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">AI Provider</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t('현재', 'Current')}: <b>{aiService.providerName}</b></p>
        </Card>
      </div>
    </>
  );
}
