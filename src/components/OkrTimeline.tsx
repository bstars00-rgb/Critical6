import { Link } from 'react-router-dom';
import { Target, KeyRound, ListTodo } from 'lucide-react';
import type { ObjectiveNode } from '@/services/objectives';
import { useT, useLang } from '@/i18n';
import { statusLabel } from '@/lib/constants';

type Kind = 'obj' | 'kr' | 'ap';
interface Row {
  kind: Kind; id: string; title: string; depth: number;
  start: string | null; due: string | null; status: string; link?: string;
}

function flatten(nodes: ObjectiveNode[], depth: number, rows: Row[]) {
  for (const o of nodes) {
    rows.push({ kind: 'obj', id: o.id, title: o.title, depth, start: o.start_date, due: o.due_date, status: o.status, link: `/okr/${o.id}` });
    for (const kr of o.key_results as any[]) {
      rows.push({ kind: 'kr', id: kr.id, title: kr.title, depth: depth + 1, start: kr.start_date, due: kr.due_date, status: kr.status });
      for (const ap of (kr.action_plans ?? [])) rows.push({ kind: 'ap', id: ap.id, title: ap.title, depth: depth + 2, start: ap.start_date, due: ap.due_date, status: ap.status });
    }
    flatten(o.children, depth + 1, rows);
  }
  return rows;
}

const barColor = (kind: Kind, status: string) => {
  if (status === 'completed') return 'bg-emerald-500';
  if (status === 'delayed') return 'bg-red-500';
  if (status === 'at_risk') return 'bg-amber-500';
  return kind === 'obj' ? 'bg-brand-600' : kind === 'kr' ? 'bg-indigo-500' : 'bg-slate-400';
};

export function OkrTimeline({ nodes, year }: { nodes: ObjectiveNode[]; year: number }) {
  const t = useT();
  const lang = useLang();
  const rows = flatten(nodes, 0, []);
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year, 11, 31, 23, 59, 59);
  const span = yearEnd - yearStart;
  const months = lang === 'en'
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const todayPct = (() => {
    const now = Date.now();
    return now >= yearStart && now <= yearEnd ? ((now - yearStart) / span) * 100 : null;
  })();

  const pos = (s: string | null, d: string | null) => {
    if (!s && !d) return null;
    const a = Math.max(yearStart, Date.parse(s ?? d!));
    const b = Math.min(yearEnd, Date.parse(d ?? s!));
    if (isNaN(a) || isNaN(b) || b < yearStart || a > yearEnd) return null;
    const left = ((a - yearStart) / span) * 100;
    const width = Math.max(1.2, ((b - a) / span) * 100);
    return { left, width };
  };

  const Icon = ({ k }: { k: Kind }) => k === 'obj'
    ? <Target className="h-3.5 w-3.5 text-brand-600 shrink-0" />
    : k === 'kr' ? <KeyRound className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
      : <ListTodo className="h-3.5 w-3.5 text-slate-400 shrink-0" />;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[920px]">
        {/* header */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <div className="w-72 shrink-0 px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{year}</div>
          <div className="relative flex-1 grid grid-cols-12">
            {months.map((m) => <div key={m} className="border-l border-slate-100 px-1 py-2 text-center text-[11px] text-slate-400 dark:border-slate-800">{m}</div>)}
          </div>
        </div>

        {/* rows */}
        {rows.map((r) => {
          const p = pos(r.start, r.due);
          return (
            <div key={`${r.kind}-${r.id}`} className="flex items-center border-b border-slate-50 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40">
              <div className="flex w-72 shrink-0 items-center gap-1.5 py-1.5 pr-2 text-sm" style={{ paddingLeft: 8 + r.depth * 16 }}>
                <Icon k={r.kind} />
                {r.link
                  ? <Link to={r.link} className="truncate font-medium text-slate-700 hover:text-brand-700 dark:text-slate-200 dark:hover:text-brand-300">{r.title}</Link>
                  : <span className={`truncate ${r.kind === 'kr' ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>{r.title}</span>}
              </div>
              <div className="relative h-8 flex-1 border-l border-slate-100 dark:border-slate-800">
                <div className="absolute inset-0 grid grid-cols-12">
                  {months.map((m) => <div key={m} className="border-l border-slate-50 dark:border-slate-800/60" />)}
                </div>
                {todayPct !== null && <div className="absolute top-0 bottom-0 w-px bg-red-400/70" style={{ left: `${todayPct}%` }} />}
                {p && (
                  <div className={`absolute top-1.5 flex h-5 items-center overflow-hidden rounded px-1.5 text-[10px] font-medium text-white ${barColor(r.kind, r.status)}`}
                    style={{ left: `${p.left}%`, width: `${p.width}%` }}
                    title={`${r.title} · ${r.start ?? '?'} ~ ${r.due ?? '?'} · ${statusLabel(r.status as any, lang)}`}>
                    <span className="truncate">{r.title}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="p-8 text-center text-sm text-slate-400">{t('표시할 OKR이 없습니다.', 'No OKRs to show.')}</div>}
      </div>
    </div>
  );
}
