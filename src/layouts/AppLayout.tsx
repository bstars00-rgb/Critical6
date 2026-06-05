import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  LayoutDashboard, Target, Flame, KanbanSquare, MessageSquare, Gauge,
  Sparkles, Users, Building2, Contact, BarChart3, Calendar, Settings, Sun, LogOut,
  CalendarCheck, Moon, Languages,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useUi } from '@/stores/ui';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/my-day', label: 'My Day', icon: Sun },
  { to: '/okr', label: 'OKR Tree', icon: Target },
  { to: '/critical-six', label: 'Critical 6', icon: Flame },
  { to: '/board', label: 'Action Board', icon: KanbanSquare },
  { to: '/cfr', label: 'CFR', icon: MessageSquare },
  { to: '/weekly', label: 'Weekly Review', icon: CalendarCheck },
  { to: '/kpi', label: 'KPI', icon: Gauge },
  { to: '/charts', label: 'Charts', icon: BarChart3 },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/ai', label: 'AI Insight', icon: Sparkles },
  { to: '/team', label: 'Team Review', icon: Users },
  { to: '/executive', label: 'Executive', icon: Building2 },
  { to: '/crm', label: 'CRM', icon: Contact },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout() {
  const { profile, signOut } = useAuthStore();
  const { theme, toggleTheme, lang, setLang } = useUi();
  const t = useT();
  const location = useLocation();
  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="px-4 py-4">
          <div className="text-sm font-bold text-brand-700 dark:text-brand-300">AI Execution OS</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500">OKR · Critical 6 · CFR · KPI</div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) => cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium',
                isActive ? 'bg-brand-50 dark:bg-slate-700 text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700',
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 dark:border-slate-700 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <button className="btn-ghost flex-1 justify-center" onClick={toggleTheme}
              title={t('테마 전환', 'Toggle theme')}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="text-xs">{theme === 'dark' ? t('라이트', 'Light') : t('다크', 'Dark')}</span>
            </button>
            <button className="btn-ghost flex-1 justify-center" onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}
              title={t('언어 전환', 'Switch language')}>
              <Languages className="h-4 w-4" />
              <span className="text-xs">{lang === 'en' ? '한국어' : 'EN'}</span>
            </button>
          </div>
          <div className="mb-2 px-1">
            <div className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{profile?.full_name ?? '—'}</div>
            <div className="truncate text-[11px] text-slate-400 dark:text-slate-500">{profile?.title ?? profile?.role}</div>
          </div>
          <button className="btn-ghost w-full justify-start" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" /> {t('로그아웃', 'Log out')}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1760px] px-8 py-8 2xl:px-12">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
