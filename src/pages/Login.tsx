import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { isDemo } from '@/lib/supabase';
import { useT } from '@/i18n';

export default function Login() {
  const { signIn, signUp } = useAuthStore();
  const t = useT();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(isDemo ? 'admin@company.com' : '');
  const [password, setPassword] = useState(isDemo ? 'password123' : '');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === 'signup') {
        const { needsConfirm } = await signUp(email, password, fullName);
        if (needsConfirm) {
          setInfo(t('확인 메일을 보냈습니다. 메일의 링크를 클릭한 뒤 로그인하세요.',
                    'Confirmation email sent. Click the link, then sign in.'));
          setMode('signin');
        }
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err.message ?? t('실패했습니다', 'Something went wrong'));
    } finally { setBusy(false); }
  }

  const isSignup = mode === 'signup';
  return (
    <div className="grid h-full place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <div className="text-lg font-bold text-brand-700 dark:text-brand-300">AI Execution OS</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isSignup ? t('새 계정 만들기', 'Create your account') : t('실행관리 시스템에 로그인', 'Sign in to the execution OS')}
          </div>
        </div>

        {isSignup && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{t('이름', 'Full name')}</span>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{t('이메일', 'Email')}</span>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{t('비밀번호', 'Password')}</span>
          <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} />
        </label>

        {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</div>}
        {info && <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{info}</div>}

        <button className="btn-primary w-full" disabled={busy}>
          {busy ? '…' : isSignup ? t('가입하기', 'Sign up') : t('로그인', 'Sign in')}
        </button>

        <button type="button" className="w-full text-center text-xs text-slate-500 dark:text-slate-400 hover:underline"
          onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(null); setInfo(null); }}>
          {isSignup ? t('이미 계정이 있으신가요? 로그인', 'Already have an account? Sign in')
                    : t('계정이 없으신가요? 가입하기', "No account? Sign up")}
        </button>

        {isDemo && (
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
            {t('데모 모드: 아무 이메일/비밀번호로 로그인', 'Demo mode: sign in with any email/password')}
          </p>
        )}
      </form>
    </div>
  );
}
