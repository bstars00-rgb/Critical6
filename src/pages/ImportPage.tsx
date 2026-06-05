import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { previewPlanner, applyPlanner, type ImportPreview } from '@/services/plannerImport';
import { useAuthStore } from '@/stores/auth';
import { useT } from '@/i18n';
import { PageHeader } from '@/layouts/AppLayout';
import { Card } from '@/components/ui';

const KIND_LABEL: Record<string, string> = {
  hq: 'HQ / 회사 OKR', gst_okr: 'GST OKR', actionplan: 'Action Plan', critical6: 'Critical 6', unknown: '미인식',
};

export default function ImportPage() {
  const t = useT();
  const qc = useQueryClient();
  const profile = useAuthStore((s) => s.profile);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError(null); setResult(null); setPreview(null);
    try { setPreview(await previewPlanner(files)); }
    catch (err: any) { setError(err?.message ?? '파일을 읽지 못했습니다'); }
  }

  async function run() {
    if (!preview) return;
    setBusy(true); setResult(null); setError(null);
    try {
      const data = await preview.build();
      const res = await applyPlanner(data, setStep);
      setResult(res);
      if (res.ok) qc.invalidateQueries();
    } catch (err: any) {
      setResult({ ok: false, message: err?.message ?? String(err) });
    } finally { setBusy(false); setStep(''); }
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader title={t('데이터 가져오기', 'Import')} />
        <Card><p className="text-sm text-slate-500 dark:text-slate-400">{t('관리자만 가져올 수 있습니다.', 'Only admins can import.')}</p></Card>
      </>
    );
  }

  const c = preview?.counts;
  return (
    <>
      <PageHeader title={t('데이터 가져오기', 'Import')} subtitle={t('Microsoft Teams Planner 엑셀(.xlsx)을 올리면 AEO로 들어갑니다', 'Upload Teams Planner .xlsx exports into AEO')} />

      <Card className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700/40">
          <Upload className="h-7 w-7 text-slate-400" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('Planner 엑셀 파일 선택 (여러 개 가능)', 'Choose Planner .xlsx files (multiple)')}</span>
          <span className="text-xs text-slate-400">HQ OKR · GST OKR · Action Plan · Critical 6</span>
          <input type="file" accept=".xlsx" multiple className="hidden" onChange={onFiles} />
        </label>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">
            <AlertTriangle className="h-4 w-4" />{error}
          </div>
        )}

        {preview && (
          <>
            <div className="space-y-1">
              {preview.files.map((f) => (
                <div key={f.name} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">{KIND_LABEL[f.kind] ?? f.kind}</span>
                  <span className="text-[11px] text-slate-400">{f.tasks} {t('작업', 'tasks')}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {[['Objective', c!.objectives], ['KR', c!.keyResults], ['Action', c!.actionPlans], ['Critical 6', c!.criticalSix], [t('팀원', 'People'), c!.people]].map(([label, n]) => (
                <div key={String(label)} className="rounded-lg bg-slate-50 p-2 text-center dark:bg-slate-700/40">
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{n as number}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {t('가져오면 기존 Planner 임포트 데이터를 교체합니다(직접 만든 OKR은 영향 없음).', 'Importing replaces previously imported Planner data (your manually-created OKRs are untouched).')}
            </div>

            <button className="btn-primary w-full" disabled={busy} onClick={run}>
              {busy ? (step || t('가져오는 중…', 'Importing…')) : t('가져오기', 'Import')}
            </button>
          </>
        )}

        {result && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${result.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300'}`}>
            {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {result.ok ? `✅ ${result.message}` : result.message}
          </div>
        )}
        {result?.ok && <p className="text-xs text-slate-400">{t('OKR Tree / Action Board / Critical 6 메뉴에서 확인하세요.', 'Check the OKR Tree / Action Board / Critical 6 pages.')}</p>}
      </Card>
    </>
  );
}
