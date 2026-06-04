// Domain types — mirror the Supabase schema (supabase/migrations).
// Hand-written for MVP; regenerate with `supabase gen types` later if desired.

export type UUID = string;

export type UserRole = 'admin' | 'executive' | 'team_leader' | 'member';
export type TeamRole = 'leader' | 'member' | 'viewer';
export type ObjectiveLevel = 'company' | 'team' | 'personal';

export type OkrStatus =
  | 'not_started' | 'in_progress' | 'at_risk' | 'delayed'
  | 'completed' | 'on_hold' | 'cancelled';

export type TaskStatus =
  | 'not_started' | 'in_progress' | 'at_risk' | 'delayed' | 'completed' | 'cancelled';

export type Priority = 'low' | 'medium' | 'important' | 'urgent' | 'critical';
export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type CfrRelatedType = 'objective' | 'key_result' | 'critical_six' | 'action_plan';
export type KpiStatus = 'on_track' | 'at_risk' | 'off_track' | 'no_data';
export type CrmStage =
  | 'lead' | 'contacted' | 'meeting' | 'proposal' | 'negotiation'
  | 'contract' | 'integration' | 'active' | 'lost' | 'on_hold';

interface Audit {
  id: UUID;
  created_at: string;
  updated_at: string;
  created_by: UUID | null;
  updated_by: UUID | null;
}

export interface User extends Audit {
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  title: string | null;
  is_active: boolean;
}

export interface Team extends Audit {
  name: string;
  slug: string | null;
  description: string | null;
  parent_team_id: UUID | null;
  lead_user_id: UUID | null;
  is_active: boolean;
}

export interface Objective extends Audit {
  title: string;
  description: string | null;
  level: ObjectiveLevel;
  owner_id: UUID | null;
  team_id: UUID | null;
  parent_objective_id: UUID | null;
  start_date: string | null;
  due_date: string | null;
  status: OkrStatus;
  priority: Priority;
  progress: number;
  confidence_score: number | null;
  quarter: number | null;
  year: number | null;
  tags: string[];
  memo: string | null;
}

export interface KeyResult extends Audit {
  objective_id: UUID;
  title: string;
  description: string | null;
  metric_type: string | null;
  baseline_value: number | null;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  progress: number;
  confidence_score: number | null;
  owner_id: UUID | null;
  start_date: string | null;
  due_date: string | null;
  status: OkrStatus;
  priority: Priority;
}

export interface Kpi extends Audit {
  name: string;
  description: string | null;
  key_result_id: UUID | null;
  objective_id: UUID | null;
  team_id: UUID | null;
  owner_id: UUID | null;
  metric_type: string | null;
  unit: string | null;
  target_value: number | null;
  current_value: number | null;
  previous_value: number | null;
  achievement_rate: number | null;
  update_frequency: string | null;
  update_method: 'manual' | 'csv_upload' | 'google_sheet' | 'database' | 'api' | 'crm';
  data_source_id: UUID | null;
  external_id: string | null;
  last_updated_at: string | null;
  status: KpiStatus;
}

export interface CriticalSix extends Audit {
  title: string;
  description: string | null;
  objective_id: UUID | null;
  key_result_id: UUID | null;
  kpi_id: UUID | null;
  owner_id: UUID;
  team_id: UUID | null;
  start_date: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority: Priority;
  impact_score: number | null;
  confidence_score: number | null;
  blocker: string | null;
  completion_criteria: string | null;
  ai_next_action: string | null;
  is_today_focus: boolean;
  is_weekly_focus: boolean;
  focus_date: string | null;
  completed_at: string | null;
  delay_reason: string | null;
}

export interface ChecklistItem { id: string; text: string; done: boolean; }

export interface ActionPlan extends Audit {
  title: string;
  description: string | null;
  objective_id: UUID | null;
  key_result_id: UUID | null;
  kpi_id: UUID | null;
  critical_six_id: UUID | null;
  owner_id: UUID | null;
  team_id: UUID | null;
  start_date: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority: Priority;
  bucket: string | null;
  labels: string[];
  checklist: ChecklistItem[];
  progress: number;
  recurrence_rule: string | null;
  is_open_on_board: boolean;
  external_id: string | null;
  data_source: string | null;
}

export interface CfrCheckin extends Audit {
  related_type: CfrRelatedType;
  related_id: UUID;
  user_id: UUID;
  team_id: UUID | null;
  week_start_date: string;
  progress_summary: string | null;
  completed_work: string | null;
  blockers: string | null;
  next_week_actions: string | null;
  support_needed: string | null;
  risk_level: RiskLevel;
  confidence_score: number | null;
  manager_feedback: string | null;
  manager_user_id: UUID | null;
  recognition_comment: string | null;
  ai_summary: string | null;
  ai_risk_analysis: string | null;
  ai_next_action: string | null;
  ai_meta: Record<string, unknown>;
  submitted_at: string | null;
}

export interface AiInsight extends Audit {
  insight_type: string;
  related_type: string | null;
  related_id: UUID | null;
  team_id: UUID | null;
  user_id: UUID | null;
  title: string | null;
  summary: string | null;
  risk_level: RiskLevel | null;
  payload: Record<string, unknown>;
  model: string | null;
  is_dismissed: boolean;
  valid_until: string | null;
}

export interface Notification extends Audit {
  user_id: UUID;
  type: string;
  title: string;
  body: string | null;
  related_type: string | null;
  related_id: UUID | null;
  is_read: boolean;
  read_at: string | null;
}
