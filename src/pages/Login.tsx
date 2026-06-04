import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';

export default function Login() {
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState('admin@company.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await signIn(email, password); }
    catch (err: any) { setError(err.message ?? '로그인 실패'); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid h-full place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <div className="text-lg font-bold text-brand-700">AI Execution OS</div>
          <div className="text-sm text-slate-500">실행관리 시스템에 로그인</div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">이메일</span>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">비밀번호</span>
          <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
        </label>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
        <p className="text-center text-[11px] text-slate-400">
          seed 계정: admin@company.com / password123
        </p>
      </form>
    </div>
  );
}
