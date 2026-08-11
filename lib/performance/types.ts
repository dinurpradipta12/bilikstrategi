export type PerformanceItemType =
  | 'job_description'
  | 'daily_activity'
  | 'objective'
  | 'key_result'
  | 'initiative';

export type PerformanceCadence =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'per_activity';

export type PerformanceScopeType = 'team' | 'division' | 'role' | 'user';
export type PerformanceUpdateStatus = 'todo' | 'in_progress' | 'completed' | 'blocked';

export interface PerformanceViewer {
  email: string;
  name: string;
  avatar_url: string;
  app_role: 'owner' | 'admin' | 'member' | 'client';
  can_manage: boolean;
}

export interface PerformanceProfile {
  workspace_id: string;
  user_email: string;
  display_name: string;
  avatar_url: string | null;
  division: string;
  role_title: string;
  job_summary: string;
  manager_email: string | null;
  can_manage: boolean;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PerformanceItem {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  item_type: PerformanceItemType;
  title: string;
  description: string;
  cadence: PerformanceCadence;
  scope_type: PerformanceScopeType;
  scope_value: string;
  weight: number;
  target_value: number;
  unit: string;
  sort_order: number;
  active: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PerformanceUpdate {
  id: string;
  workspace_id: string;
  item_id: string | null;
  user_email: string;
  activity_date: string;
  title: string;
  details: string;
  progress: number;
  status: PerformanceUpdateStatus;
  evidence_url: string | null;
  blocker_note: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PerformanceReview {
  id: string;
  workspace_id: string;
  user_email: string;
  reviewer_email: string;
  period_start: string;
  period_end: string;
  overall_score: number;
  quality_score: number;
  ownership_score: number;
  collaboration_score: number;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface PerformanceRoleRecord {
  email: string;
  display_name: string;
  role: 'owner' | 'admin' | 'member' | 'client';
  is_superuser: boolean;
  status: 'active' | 'inactive';
}

export interface PerformanceBootstrap {
  storage_ready: boolean;
  workspace_id: string;
  viewer: PerformanceViewer;
  profile: PerformanceProfile;
  profiles: PerformanceProfile[];
  items: PerformanceItem[];
  updates: PerformanceUpdate[];
  reviews: PerformanceReview[];
  roles: PerformanceRoleRecord[];
  refreshed_at: string;
  warning?: string;
}

export const PERFORMANCE_ITEM_LABELS: Record<PerformanceItemType, string> = {
  job_description: 'Job Description',
  daily_activity: 'Kegiatan Harian',
  objective: 'Objective',
  key_result: 'Key Result',
  initiative: 'Initiative',
};

export const PERFORMANCE_CADENCE_LABELS: Record<PerformanceCadence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  per_activity: 'Per Kegiatan',
};

export const PERFORMANCE_STATUS_LABELS: Record<PerformanceUpdateStatus, string> = {
  todo: 'Belum Mulai',
  in_progress: 'Dikerjakan',
  completed: 'Selesai',
  blocked: 'Terhambat',
};
