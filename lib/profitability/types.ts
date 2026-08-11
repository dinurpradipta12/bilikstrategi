export type ProfitabilityHealth = 'healthy' | 'watch' | 'loss';

export type ProjectProfitabilityRow = {
  project_id: string;
  project_name: string;
  client_name: string;
  project_status: string;
  budget: number;
  revenue: number;
  revenue_override: number | null;
  revenue_source: 'override' | 'finance' | 'invoice' | 'none';
  invoice_revenue: number;
  finance_revenue: number;
  labor_hours: number;
  labor_cost: number;
  labor_cost_override: number | null;
  labor_cost_calculated: number;
  external_cost: number;
  finance_expense: number;
  total_cost: number;
  profit: number;
  margin_percent: number;
  budget_variance: number;
  tasks_total: number;
  tasks_completed: number;
  tasks_overdue: number;
  completion_percent: number;
  health: ProfitabilityHealth;
  notes: string;
  has_override: boolean;
};

export type ProfitabilityPayload = {
  storage_ready: boolean;
  month: string;
  currency: string;
  viewer: { email: string; name: string; role: string; can_manage: boolean };
  summary: {
    revenue: number;
    cost: number;
    profit: number;
    margin_percent: number;
    labor_hours: number;
    healthy_projects: number;
    at_risk_projects: number;
  };
  projects: ProjectProfitabilityRow[];
  warnings: string[];
};
