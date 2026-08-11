-- Configurable operational automation rules and immutable execution history.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE IF EXISTS public.app_user_roles
  ADD COLUMN IF NOT EXISTS page_access JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_user_roles
SET page_access = jsonb_set(
  COALESCE(page_access, '{}'::jsonb),
  '{automations}',
  to_jsonb(role IN ('owner', 'admin') OR is_superuser = TRUE),
  TRUE
);

CREATE TABLE IF NOT EXISTS public.app_automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger_type TEXT NOT NULL CHECK (
    trigger_type IN ('missing_checkout', 'daily_incomplete', 'task_overdue', 'invoice_due', 'kpi_below')
  ),
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '{"audience":"assignee"}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  cooldown_minutes INTEGER NOT NULL DEFAULT 1440 CHECK (cooldown_minutes BETWEEN 5 AND 10080),
  last_run_at TIMESTAMPTZ,
  last_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.app_automation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID NOT NULL REFERENCES public.app_automation_rules(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  run_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'skipped', 'failed')),
  matched_count INTEGER NOT NULL DEFAULT 0 CHECK (matched_count >= 0),
  notified_count INTEGER NOT NULL DEFAULT 0 CHECK (notified_count >= 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rule_id, run_key)
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled
  ON public.app_automation_rules (workspace_id, enabled, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_runs_recent
  ON public.app_automation_runs (workspace_id, created_at DESC);

ALTER TABLE public.app_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_automation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_automation_rules FROM anon, authenticated;
REVOKE ALL ON TABLE public.app_automation_runs FROM anon, authenticated;
GRANT ALL ON TABLE public.app_automation_rules TO service_role;
GRANT ALL ON TABLE public.app_automation_runs TO service_role;
