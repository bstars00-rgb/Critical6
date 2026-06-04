import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, LineChart as LineChartIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { kpisService } from '@/services/kpis';
import { parseKpiCsv } from '@/integrations/dataSources';
import { PageHeader } from '@/layouts/AppLayout';
import { Card, Spinner, Badge, ProgressBar, Modal } from '@/components/ui';
import type { Kpi } from '@/types';

function KpiTrendModal({ kpi, onClose }: { kpi: Kpi; onClose: () => void }) {
  const history = useQuery({ queryKey: ['kpi', 'history', kpi.id], queryFn: () => kpisService.history(kpi.id) });
  const data = (history.data ?? []).map((h: any) => ({
    date: String(h.recorded_at).slice(5, 10), value: Number(h.value),
  }));
  return (
    <Modal open onClose={onClose} title={`${kpi.name} — 추이`}>
      {history.isLoading ? <Spinner /> : data.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">기록이 없습니다. 값을 업데이트하면 추이가 쌓입니다.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            {kpi.target_value != null && (
              <ReferenceLine y={kpi.target_value} stroke="#10b981" strokeDasharray="4 4"
                label={{ value: `목표 ${kpi.target_value}`, fontSize: 10, fill: '#10b981' }} />
            )}
            <Line type="monotone" dataKey="value" stroke="#3b6fff" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Modal>
  );
}

const KPI_STATUS_COLOR: Record<string, string> = {
  on_track: 'bg-emerald-100 text-emerald-700', at_risk: 'bg-amber-100 text-amber-700',
  off_track: 'bg-red-100 text-red-700', no_data: 'bg-slate-100 text-slate-500',
};

export default function KpiPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['kpi', 'list'], queryFn: () => kpisService.list() });
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [trend, setTrend] = useState<Kpi | null>(null);

  const update = useMutation({
    mutationFn: ({ kpi, value }: { kpi: Kpi; value: number }) => kpisService.updateValue(kpi, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kpi'] }),
  });

  async function onCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    // expects header: external_id,value
    const res = await kpisService.importCsv(parseKpiCsv(text));
    qc.invalidateQueries({ queryKey: ['kpi'] });
    alert(`CSV 반영: ${res.matched}/${res.total} 매칭`);
    e.target.value = '';
  }

  if (list.isLoading) return <Spinner />;

  return (
    <>
      <PageHeader title="KPI Dashboard" subtitle="OKR 실행 성과를 숫자로 추적 (수동 · CSV)"
        action={
          <label className="btn-outline cursor-pointer">
            <Upload className="h-4 w-4" /> CSV 업로드
            <input type="file" accept=".csv" className="hidden" onChange={onCsv} />
          </label>
        } />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2">KPI</th><th className="px-2 py-2">현재/목표</th>
              <th className="px-2 py-2 w-40">달성률</th><th className="px-2 py-2">상태</th>
              <th className="px-2 py-2">업데이트</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((k) => (
              <tr key={k.id} className="border-b border-slate-50">
                <td className="px-4 py-2">
                  <button className="flex items-center gap-1 text-left font-medium text-slate-700 hover:text-brand-700"
                    onClick={() => setTrend(k)}>
                    <LineChartIcon className="h-3.5 w-3.5 text-slate-400" />{k.name}
                  </button>
                  <div className="text-[11px] text-slate-400">{k.metric_type} · {k.update_method}</div>
                </td>
                <td className="px-2 py-2 text-slate-500">{k.current_value ?? '—'} / {k.target_value ?? '—'} {k.unit}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={k.achievement_rate ?? 0} />
                    <span className="w-10 text-right text-xs">{Math.round(k.achievement_rate ?? 0)}%</span>
                  </div>
                </td>
                <td className="px-2 py-2"><Badge className={KPI_STATUS_COLOR[k.status]}>{k.status}</Badge></td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    <input className="w-20 rounded border border-slate-200 px-2 py-1 text-xs"
                      type="number" placeholder="값"
                      value={edit[k.id] ?? ''} onChange={(e) => setEdit({ ...edit, [k.id]: e.target.value })} />
                    <button className="btn-ghost px-2 py-1 text-xs" disabled={!edit[k.id]}
                      onClick={() => { update.mutate({ kpi: k, value: +edit[k.id] }); setEdit({ ...edit, [k.id]: '' }); }}>
                      저장
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(list.data ?? []).length === 0 && <div className="p-6 text-center text-sm text-slate-400">KPI가 없습니다.</div>}
      </Card>

      {trend && <KpiTrendModal kpi={trend} onClose={() => setTrend(null)} />}
    </>
  );
}
