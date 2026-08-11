-- Project profit-sharing rules per accounting month.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.app_project_profit_share_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  project_key TEXT NOT NULL,
  month_key DATE NOT NULL,
  project_name TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  agreed_service_value NUMERIC(14, 2) CHECK (agreed_service_value IS NULL OR agreed_service_value >= 0),
  operational_deduction_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (operational_deduction_percent BETWEEN 0 AND 100),
  tax_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (tax_percent BETWEEN 0 AND 100),
  other_deduction_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (other_deduction_amount >= 0),
  team_share_percent NUMERIC(5, 2) NOT NULL DEFAULT 30 CHECK (team_share_percent BETWEEN 0 AND 100),
  task_weight_percent NUMERIC(5, 2) NOT NULL DEFAULT 40 CHECK (task_weight_percent BETWEEN 0 AND 100),
  completion_weight_percent NUMERIC(5, 2) NOT NULL DEFAULT 30 CHECK (completion_weight_percent BETWEEN 0 AND 100),
  hours_weight_percent NUMERIC(5, 2) NOT NULL DEFAULT 30 CHECK (hours_weight_percent BETWEEN 0 AND 100),
  notes TEXT NOT NULL DEFAULT '',
  updated_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, project_key, month_key)
);

CREATE INDEX IF NOT EXISTS idx_project_profit_share_month
  ON public.app_project_profit_share_settings (workspace_id, month_key DESC, project_name);

ALTER TABLE public.app_project_profit_share_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_project_profit_share_settings FROM anon, authenticated;
GRANT ALL ON TABLE public.app_project_profit_share_settings TO service_role;

NOTIFY pgrst, 'reload schema';
