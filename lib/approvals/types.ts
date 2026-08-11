export const APPROVAL_REQUEST_TYPES = [
  'daily_activity',
  'script',
  'strategy',
  'deliverable',
  'work_other',
  'leave',
  'overtime',
  'kpi',
  'general',
] as const;

export type ApprovalRequestType = (typeof APPROVAL_REQUEST_TYPES)[number];

export type ApprovalRequestCategory = 'work' | 'operational';

export const APPROVAL_CATEGORY_BY_TYPE: Record<ApprovalRequestType, ApprovalRequestCategory> = {
  daily_activity: 'work',
  script: 'work',
  strategy: 'work',
  deliverable: 'work',
  work_other: 'work',
  leave: 'operational',
  overtime: 'operational',
  kpi: 'operational',
  general: 'operational',
};

export type ApprovalStatus = 'pending' | 'approved' | 'revision' | 'rejected' | 'cancelled';

export type ApprovalRequest = {
  id: string;
  workspace_id: string;
  request_type: ApprovalRequestType;
  source_type: string | null;
  source_id: string | null;
  requested_by_email: string;
  requested_by_name: string;
  requested_by_avatar: string | null;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  status: ApprovalStatus;
  reviewer_email: string | null;
  reviewer_name: string | null;
  reviewer_note: string;
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApprovalBootstrap = {
  storage_ready: boolean;
  viewer: {
    email: string;
    name: string;
    role: string;
    can_manage: boolean;
  };
  requests: ApprovalRequest[];
};
