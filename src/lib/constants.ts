import type { OkrStatus, TaskStatus, Priority, RiskLevel } from '@/types';

export const STATUS_LABEL: Record<OkrStatus | TaskStatus, string> = {
  not_started: '시작 전',
  in_progress: '진행 중',
  at_risk: '위험',
  delayed: '지연',
  completed: '완료',
  on_hold: '보류',
  cancelled: '취소',
};

export const STATUS_COLOR: Record<OkrStatus | TaskStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  at_risk: 'bg-amber-100 text-amber-700',
  delayed: 'bg-red-100 text-red-700',
  completed: 'bg-emerald-100 text-emerald-700',
  on_hold: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-slate-100 text-slate-400 line-through',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: '낮음', medium: '보통', important: '중요', urgent: '긴급', critical: '핵심',
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-sky-100 text-sky-700',
  important: 'bg-indigo-100 text-indigo-700',
  urgent: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export const RISK_COLOR: Record<RiskLevel, string> = {
  none: 'bg-slate-100 text-slate-500',
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
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
