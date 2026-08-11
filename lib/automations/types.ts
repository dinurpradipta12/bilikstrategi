export type AutomationTriggerType =
  | 'missing_checkout'
  | 'daily_incomplete'
  | 'task_overdue'
  | 'invoice_due'
  | 'kpi_below';

export type AutomationAudience = 'assignee' | 'managers' | 'assignee_and_managers';

export type AutomationRule = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  trigger_type: AutomationTriggerType;
  conditions: Record<string, unknown>;
  actions: { audience?: AutomationAudience; [key: string]: unknown };
  enabled: boolean;
  cooldown_minutes: number;
  last_run_at: string | null;
  last_result: Record<string, unknown>;
  created_by_email: string;
  created_at: string;
  updated_at: string;
};

export type AutomationRun = {
  id: string;
  rule_id: string;
  workspace_id: string;
  run_key: string;
  status: 'running' | 'success' | 'skipped' | 'failed';
  matched_count: number;
  notified_count: number;
  details: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type AutomationTemplate = {
  trigger_type: AutomationTriggerType;
  name: string;
  description: string;
  conditions: Record<string, unknown>;
  actions: { audience: AutomationAudience };
  cooldown_minutes: number;
};
