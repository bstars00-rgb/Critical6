import type { OkrStatus, TaskStatus, Priority, RiskLevel } from '@/types';
import type { Lang } from '@/stores/ui';

type Status = OkrStatus | TaskStatus;

const STATUS_KO: Record<Status, string> = {
  not_started: '시작 전', in_progress: '진행 중', at_risk: '위험', delayed: '지연',
  completed: '완료', on_hold: '보류', cancelled: '취소',
};
const STATUS_EN: Record<Status, string> = {
  not_started: 'Not started', in_progress: 'In progress', at_risk: 'At risk', delayed: 'Delayed',
  completed: 'Completed', on_hold: 'On hold', cancelled: 'Cancelled',
};
const PRIORITY_KO: Record<Priority, string> = {
  low: '낮음', medium: '보통', important: '중요', urgent: '긴급', critical: '핵심',
};
const PRIORITY_EN: Record<Priority, string> = {
  low: 'Low', medium: 'Medium', important: 'Important', urgent: 'Urgent', critical: 'Critical',
};
const RISK_KO: Record<RiskLevel, string> = {
  none: '없음', low: '낮음', medium: '보통', high: '높음', critical: '심각',
};
const RISK_EN: Record<RiskLevel, string> = {
  none: 'None', low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
};

// Language-aware label lookups.
export const statusLabel = (s: Status, lang: Lang) => (lang === 'en' ? STATUS_EN : STATUS_KO)[s];
export const priorityLabel = (p: Priority, lang: Lang) => (lang === 'en' ? PRIORITY_EN : PRIORITY_KO)[p];
export const riskLabel = (r: RiskLevel, lang: Lang) => (lang === 'en' ? RISK_EN : RISK_KO)[r];

export const STATUS_COLOR: Record<Status, string> = {
  not_started: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  at_risk: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  delayed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  on_hold: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  cancelled: 'bg-slate-100 text-slate-400 line-through dark:bg-slate-700 dark:text-slate-500',
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  medium: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  important: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  urgent: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const RISK_COLOR: Record<RiskLevel, string> = {
  none: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const OKR_STATUSES: OkrStatus[] = [
  'not_started', 'in_progress', 'at_risk', 'delayed', 'completed', 'on_hold', 'cancelled',
];
export const TASK_STATUSES: TaskStatus[] = [
  'not_started', 'in_progress', 'at_risk', 'delayed', 'completed', 'cancelled',
];
export const PRIORITIES: Priority[] = ['low', 'medium', 'important', 'urgent', 'critical'];

// Kanban board columns for Action Plan / Critical 6.
export const BOARD_COLUMNS: TaskStatus[] = [
  'not_started', 'in_progress', 'at_risk', 'delayed', 'completed',
];
