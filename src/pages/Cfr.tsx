import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cfrService, weekStart } from '@/services/cfr';
import { keyResultsService } from '@/services/keyResults';
import { aiService, type AiResult } from '@/ai/aiService';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, Field, RiskBadge } from '@/components/ui';
import { AiResultCard } from '@/components/AiResultCard';
import { useT } from '@/i18n';
import type { RiskLevel } from '@/types';

const RISKS: RiskLevel[] = ['none', 'low', 'medium', 'high', 'critical'];
const empty = {
  progress_summary: '', completed_work: '', blockers: '', next_week_actions: '',
  support_needed: '', risk_level: 'none' as RiskLevel, confidence_score: 7,
};

export default function Cfr() {
  const qc = useQueryClient();
  const t = useT();
  const profile = useAuthStore((s) => s.profile);
  const uid = profile?.id;
  const [krId, setKrId] = useState('');
  const [form, setForm] = useState(empty);
  const [ai, setAi] = useState<AiResult | null>(null);

  const krs = useQuery({ queryKey: ['kr', 'all'], queryFn: () => keyResultsService.list() });
  const history = useQuery({ queryKey: ['cfr', 'user', uid], queryFn: () => cfrService.byUser(uid!), enabled: !!uid });

  // Load existing check-in for the selected KR / current week.
  useEffect(() => {
    if (!uid || !krId) { setForm(empty); return; }
    cfrService.forWeek(uid, 'key_result', krId).then((c) => {
      setForm(c ? {
        progress_summary: c.progress_summary ?? '', completed_work: c.completed_work ?? '',
        blockers: c.blockers ?? '', next_week_actions: c.next_week_actions ?? '',
        support_needed: c.support_needed ?? '', risk_level: c.risk_level, confidence_score: c.confidence_score ?? 7,
      } : empty);
    });
  }, [uid, krId]);

  const submit = useMutation({
    mutationFn: async () => {
      const aiRes = await aiService.performanceCoach({ items: [{ title: 'CFR', ...form, progress: 0 }] });
      setAi(aiRes);
      return cfrService.submit({
        related_type: 'key_result', related_id: krId, user_id: uid!,
        week_start_date: weekStart(), ...form,
        ai_summary: aiRes.summary, ai_next_action: aiRes.recommended_actions[0]?.action ?? null,
        ai_risk_analysis: aiRes.key_findings.join(' / '),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cfr'] }),
  });

  return (
    <>
      <PageHeader title={t('CFR 주간 체크인', 'CFR Weekly Check-in')} subtitle={`${weekStart()} · Conversation·Feedback·Recognition`} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Field label="대상 Key Result">
            <select className="input" value={krId} onChange={(e) => setKrId(e.target.value)}>
              <option value="">KR을 선택하세요</option>
              {(krs.data ?? []).map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}
            </select>
          </Field>
          {krId && (
            <div className="mt-3 space-y-3">
              {([
                ['progress_summary', '이번 주 진행 내용'], ['completed_work', '완료한 것'],
                ['blockers', '막힌 것 (blocker)'], ['next_week_actions', '다음 주 액션'],
                ['support_needed', '필요한 지원'],
              ] as const).map(([k, label]) => (
                <Field key={k} label={label}>
                  <textarea className="input min-h-[56px]" value={(form as any)[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </Field>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <Field label="리스크">
                  <select className="input" value={form.risk_level}
                    onChange={(e) => setForm({ ...form, risk_level: e.target.value as RiskLevel })}>
                    {RISKS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label={`자신감 점수: ${form.confidence_score}`}>
                  <input type="range" min={0} max={10} value={form.confidence_score}
                    onChange={(e) => setForm({ ...form, confidence_score: +e.target.value })} className="w-full" />
                </Field>
              </div>
              <button className="btn-primary w-full" disabled={submit.isPending} onClick={() => submit.mutate()}>
                {submit.isPending ? '제출 중…' : 'CFR 제출 + AI 분석'}
              </button>
            </div>
          )}
          {ai && <div className="mt-4"><AiResultCard result={ai} title="CFR AI 분석" /></div>}
        </Card>

        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">내 CFR 히스토리</h3>
          {history.isLoading ? <Spinner /> : (
            <div className="space-y-2">
              {(history.data ?? []).map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-100 dark:border-slate-700 p-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{c.week_start_date}</span>
                    <RiskBadge level={c.risk_level} />
                  </div>
                  <div className="mt-1 truncate text-slate-600 dark:text-slate-300">{c.progress_summary || c.ai_summary || '—'}</div>
                </div>
              ))}
              {(history.data ?? []).length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">아직 작성한 CFR이 없습니다.</p>}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
