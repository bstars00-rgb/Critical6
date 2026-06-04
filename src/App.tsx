import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import AppLayout from '@/layouts/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import MyDay from '@/pages/MyDay';
import OkrTree from '@/pages/okr/OkrTree';
import OkrDetail from '@/pages/okr/OkrDetail';
import CriticalSix from '@/pages/CriticalSix';
import ActionBoard from '@/pages/ActionBoard';
import Cfr from '@/pages/Cfr';
import Kpi from '@/pages/Kpi';
import AiInsight from '@/pages/AiInsight';
import Charts from '@/pages/Charts';
import WeeklyReview from '@/pages/WeeklyReview';
import TeamReview from '@/pages/TeamReview';
import CalendarView from '@/pages/CalendarView';
import Crm from '@/pages/Crm';
import { Executive, Settings } from '@/pages/Stubs';

export default function App() {
  const { loading, session, init } = useAuthStore();
  useEffect(() => { init(); }, [init]);

  if (loading) return <div className="grid h-full place-items-center text-slate-400 dark:text-slate-500">Loading…</div>;
  if (!session) return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="my-day" element={<MyDay />} />
        <Route path="okr" element={<OkrTree />} />
        <Route path="okr/:id" element={<OkrDetail />} />
        <Route path="critical-six" element={<CriticalSix />} />
        <Route path="board" element={<ActionBoard />} />
        <Route path="cfr" element={<Cfr />} />
        <Route path="weekly" element={<WeeklyReview />} />
        <Route path="kpi" element={<Kpi />} />
        <Route path="charts" element={<Charts />} />
        <Route path="calendar" element={<CalendarView />} />
        <Route path="ai" element={<AiInsight />} />
        <Route path="team" element={<TeamReview />} />
        <Route path="executive" element={<Executive />} />
        <Route path="crm" element={<Crm />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
