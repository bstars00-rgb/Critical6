import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';
import {
  STATUS_COLOR, STATUS_LABEL, PRIORITY_COLOR, PRIORITY_LABEL, RISK_COLOR,
} from '@/lib/constants';
import type { OkrStatus, TaskStatus, Priority, RiskLevel } from '@/types';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card p-4', className)}>{children}</div>;
}

export function StatCard({ label, value, hint, tone }: {
  label: string; value: ReactNode; hint?: string; tone?: 'default' | 'danger' | 'warn' | 'good';
}) {
  const toneCls = {
    default: 'text-slate-900', danger: 'text-red-600', warn: 'text-amber-600', good: 'text-emerald-600',
  }[tone ?? 'default'];
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={cn('mt-1 text-2xl font-bold', toneCls)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', className)}>{children}</span>;
}

export const StatusBadge = ({ status }: { status: OkrStatus | TaskStatus }) =>
  <Badge className={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>;

export const PriorityBadge = ({ priority }: { priority: Priority }) =>
  <Badge className={PRIORITY_COLOR[priority]}>{PRIORITY_LABEL[priority]}</Badge>;

export const RiskBadge = ({ level }: { level: RiskLevel }) =>
  <Badge className={RISK_COLOR[level]}>{level}</Badge>;

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 70 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Spinner() {
  return <div className="flex justify-center p-8 text-sm text-slate-400">불러오는 중…</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="card p-8 text-center text-sm text-slate-400">{children}</div>;
}

export function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn-ghost px-2" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
