import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { krQuartersService, currentQuarter, currentYear } from '@/services/krQuarters';
import { useT } from '@/i18n';

// Per-KR quarterly target/actual grid. Saves each cell on blur; the current
// calendar quarter is highlighted and mirrored onto the KR headline.
export function KrQuarterEditor({ krId, year = currentYear() }: { krId: string; year?: number }) {
  const t = useT();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['krq', krId, year], queryFn: () => krQuartersService.byKr(krId) });
  const save = useMutation({
    mutationFn: (v: { quarter: number; patch: any }) => krQuartersService.setCell(krId, year, v.quarter, v.patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['krq', krId] }); qc.invalidateQueries({ queryKey: ['okr'] }); },
  });
  const cellOf = (quarter: number) => (q.data ?? []).find((r) => r.quarter === quarter);
  const cur = currentQuarter();

  return (
    <div className="mt-2 grid grid-cols-4 gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
      {[1, 2, 3, 4].map((quarter) => {
        const c = cellOf(quarter);
        const isNow = year === currentYear() && quarter === cur;
        const pct = c?.target_value ? Math.round(Math.min(100, ((c.current_value ?? 0) / c.target_value) * 100)) : null;
        return (
          <div key={quarter} className={`rounded-md border p-2 ${isNow ? 'border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-slate-700' : 'border-slate-200 dark:border-slate-700'}`}>
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span>Q{quarter}{isNow ? ` · ${t('이번 분기', 'now')}` : ''}</span>
              {pct !== null && <span className="text-slate-400">{pct}%</span>}
            </div>
            <input type="number" key={`t${c?.target_value}`} defaultValue={c?.target_value ?? ''} placeholder={t('목표', 'Target')}
              className="mb-1 w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              onBlur={(e) => save.mutate({ quarter, patch: { target_value: e.target.value === '' ? null : +e.target.value } })} />
            <input type="number" key={`c${c?.current_value}`} defaultValue={c?.current_value ?? ''} placeholder={t('실적', 'Actual')}
              className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              onBlur={(e) => save.mutate({ quarter, patch: { current_value: e.target.value === '' ? null : +e.target.value } })} />
          </div>
        );
      })}
    </div>
  );
}
