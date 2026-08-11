-- Monthly project profitability overrides and budget controls.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE IF EXISTS public.app_user_roles
  ADD COLUMN IF NOT EXISTS page_access JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_user_roles
SET page_access = jsonb_set(
  COALESCE(page_access, '{}'::jsonb),
  '{profitability}',
  to_jsonb(role IN ('owner', 'admin') OR is_superuser = TRUE),
  TRUE
);

CREATE TABLE IF NOT EXISTS public.app_project_profitability_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  project_id TEXT NOT NULL,
  month_key DATE NOT NULL,
  project_name TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  budget NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (budget >= 0),
  revenue_override NUMERIC(14, 2) CHECK (revenue_override IS NULL OR revenue_override >= 0),
  labor_cost_override NUMERIC(14, 2) CHECK (labor_cost_override IS NULL OR labor_cost_override >= 0),
  external_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (external_cost >= 0),
  notes TEXT NOT NULL DEFAULT '',
  updated_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, project_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_project_profitability_month
  ON public.app_project_profitability_settings (workspace_id, month_key DESC, project_name);

ALTER TABLE public.app_project_profitability_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_project_profitability_settings FROM anon, authenticated;
GRANT ALL ON TABLE public.app_project_profitability_settings TO service_role;
