// OKR Health Indicators — Viva Goals style. Flags an objective as "attention"
// (주의) or "risk" (위험) when it deviates from OKR best practice / is in trouble.
import type { Lang } from '@/stores/ui';

const DAY = 86_400_000;

export interface HealthReason { ko: string; en: string }
export interface Health { level: 'none' | 'attention' | 'risk'; reasons: HealthReason[] }

function predicted(start: string | null, due: string | null): number | null {
  if (!start || !due) return null;
  const s = Date.parse(start), d = Date.parse(due), now = Date.now();
  if (isNaN(s) || isNaN(d) || d <= s) return null;
  if (now <= s) return 0;
  if (now >= d) return 100;
  return Math.round(((now - s) / (d - s)) * 100);
}

export function okrHealth(o: any, krs: any[] = []): Health {
  const now = Date.now();
  const risk: HealthReason[] = [];
  const attn: HealthReason[] = [];

  // 위험 (At risk)
  if (!o.owner_id) risk.push({ ko: '소유자가 없습니다', en: 'No owner' });
  if (o.due_date && Date.parse(o.due_date) < now && o.status !== 'completed')
    risk.push({ ko: '기한이 지났습니다', en: 'Past due date' });
  const pred = predicted(o.start_date, o.due_date);
  if (pred != null && Math.round(o.progress ?? 0) < pred - 25)
    risk.push({ ko: `예상 진행률보다 25%+ 뒤처짐 (예상 ${pred}%)`, en: `>25% behind predicted (${pred}%)` });

  // 주의 (Attention needed)
  if (o.status === 'not_started' && o.start_date && Date.parse(o.start_date) + 7 * DAY < now)
    attn.push({ ko: '시작일 7일 경과·미시작', en: 'Not started 7+ days after start' });
  if (krs.length > 5) attn.push({ ko: `KR이 ${krs.length}개입니다 (3~5개 권장)`, en: `${krs.length} KRs (3–5 recommended)` });
  if (krs.length === 0 && o.level !== 'company') attn.push({ ko: 'KR이 없습니다', en: 'No key results' });
  if ((o.progress ?? 0) >= 80 && o.status !== 'completed')
    attn.push({ ko: '점수가 높습니다 — 다음엔 더 높게 설정', en: 'Score high — aim higher next time' });

  if (risk.length) return { level: 'risk', reasons: [...risk, ...attn] };
  if (attn.length) return { level: 'attention', reasons: attn };
  return { level: 'none', reasons: [] };
}

export const healthText = (h: Health, lang: Lang) =>
  h.reasons.map((r) => (lang === 'en' ? r.en : r.ko)).join(' · ');
