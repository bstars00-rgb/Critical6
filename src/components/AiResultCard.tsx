import { Sparkles, AlertTriangle } from 'lucide-react';
import type { AiResult } from '@/ai/aiService';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n';

const RISK_TONE: Record<string, string> = {
  low: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
  medium: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
  high: 'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40',
  critical: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
};

export function AiResultCard({ result, title }: { result: AiResult; title?: string }) {
  const t = useT();
  return (
    <div className={cn('rounded-xl border p-4', RISK_TONE[result.risk_level])}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <Sparkles className="h-4 w-4 text-brand-600" />
        {title ?? t('AI 분석', 'AI analysis')}
        {result.manager_attention_required && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3 w-3" /> {t('팀장 확인 필요', 'Needs manager attention')}
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-slate-800 dark:text-slate-100">{result.summary}</p>

      {result.scores && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Object.entries(result.scores).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-white/70 dark:bg-slate-700/60 p-2 text-center">
              <div className="text-base font-bold text-slate-800 dark:text-slate-100">{v}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">{k.replace('_score', '')}</div>
            </div>
          ))}
        </div>
      )}

      {result.key_findings.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
          {result.key_findings.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}

      {result.recommended_actions.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('추천 액션', 'Recommended actions')}</div>
          <ol className="mt-1 space-y-1">
            {result.recommended_actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg bg-white/70 dark:bg-slate-700/60 p-2 text-sm">
                <span className="font-bold text-brand-600">{i + 1}</span>
                <span>
                  {a.action}
                  {(a.owner || a.due_date) && (
                    <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
                      {a.owner && `· ${a.owner}`}{a.due_date && ` · ~${a.due_date}`}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-3 flex gap-4 text-[11px] text-slate-400 dark:text-slate-500">
        <span>confidence {result.confidence_score}</span>
        <span>execution {result.execution_score}</span>
      </div>
    </div>
  );
}
