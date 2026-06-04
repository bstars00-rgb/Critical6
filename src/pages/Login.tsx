import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useT } from '@/i18n';

export default function Login() {
  const signIn = useAuthStore((s) => s.signIn);
  const t = useT();
  const [email, setEmail] = useState('admin@company.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await signIn(email, password); }
    catch (err: any) { setError(err.message ?? t('로그인 실패', 'Login failed')); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid h-full place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <div className="text-lg font-bold text-brand-700 dark:text-brand-300">AI Execution OS</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{t('실행관리 시스템에 로그인', 'Sign in to the execution OS')}</div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{t('이메일', 'Email')}</span>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{t('비밀번호', 'Password')}</span>
          <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
        </label>
        {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</div>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? t('로그인 중…', 'Signing in…') : t('로그인', 'Sign in')}</button>
        <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
          {t('데모: 아무 seed 이메일, 비밀번호 무시', 'Demo: any seed email, password ignored')}
        </p>
      </form>
    </div>
  );
}
