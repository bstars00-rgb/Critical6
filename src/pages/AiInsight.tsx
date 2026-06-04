import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { keyResultsService } from '@/services/keyResults';
import { criticalSixService } from '@/services/criticalSix';
import { actionPlansService } from '@/services/actionPlans';
import { dashboardService } from '@/services/dashboard';
import { aiService, type AiResult } from '@/ai/aiService';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner } from '@/components/ui';
import { AiResultCard } from '@/components/AiResultCard';
import { useT } from '@/i18n';

export default function AiInsight() {
  const t = useT();
  const profile = useAuthStore((s) => s.profile);
  const [results, setResults] = useState<Record<string, AiResult>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const krs = useQuery({ queryKey: ['kr', 'all'], queryFn: () => keyResultsService.list() });
  const stored = useQuery({ queryKey: ['ai', 'stored'], queryFn: () => dashboardService.aiInsights(20) });

  async function run(key: string, fn: () => Promise<AiResult>) {
    setBusy(key);
    try {
      const res = await fn();
      setResults((r) => ({ ...r, [key]: res }));
    } finally { setBusy(null); }
  }

  const cards = [
    { key: 'risk', label: 'Risk Detection', run: () => aiService.riskDetection({ items: krs.data ?? [] }) },
    { key: 'next', label: 'Next Action', run: () => aiService.nextAction({ items: krs.data ?? [] }) },
    {
      key: 'exec', label: 'Executive Summary', run: async () => {
        const s = await dashboardService.summary();
        const atRiskKr = (krs.data ?? []).filter((k) => ['at_risk', 'delayed'].includes(k.status));
        return aiService.executiveSummary({ completed: [], delayed: [], atRiskKr, membersWithoutCfr: [], summary: s });
      },
    },
    {
      key: 'coach', label: 'Performance Coach', run: async () => {
        const [c6, ap] = await Promise.all([
          criticalSixService.byOwner(profile!.id), actionPlansService.byOwner(profile!.id),
        ]);
        return aiService.performanceCoach({ items: [...c6, ...ap] });
      },
    },
  ];

  return (
    <>
      <PageHeader title="AI Insight" subtitle={`${t('실행관리 코치', 'Execution coach')} · provider: ${aiService.providerName}`} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <button key={c.key} className="btn-outline justify-start" disabled={busy === c.key || krs.isLoading}
            onClick={() => run(c.key, c.run)}>
            {busy === c.key ? t('분석 중…', 'Analyzing…') : c.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {Object.entries(results).map(([k, r]) => <AiResultCard key={k} result={r} title={cards.find((c) => c.key === k)?.label} />)}
      </div>

      <Card className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('저장된 인사이트 (rule-engine / DB)', 'Saved insights (rule-engine / DB)')}</h3>
        {stored.isLoading ? <Spinner /> : (
          <div className="space-y-2">
            {(stored.data ?? []).map((i: any) => (
              <div key={i.id} className="rounded-lg border border-slate-100 dark:border-slate-700 p-2 text-sm">
                <span className="text-xs text-slate-400 dark:text-slate-500">{i.insight_type}</span>
                <div className="font-medium text-slate-700 dark:text-slate-200">{i.title}</div>
                <div className="text-slate-500 dark:text-slate-400">{i.summary}</div>
              </div>
            ))}
            {(stored.data ?? []).length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">{t('저장된 인사이트 없음', 'No saved insights')}</p>}
          </div>
        )}
      </Card>
    </>
  );
}
