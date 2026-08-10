-- Owner-only finance, revenue, budgeting, and payroll settings.
-- Run this migration before opening /finance in production.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.app_owner_finance_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  month_key DATE NOT NULL,
  monthly_revenue_target NUMERIC(14, 2) NOT NULL DEFAULT 0,
  operational_budget NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  created_by_email TEXT NOT NULL DEFAULT 'snllabsarchive@gmail.com',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, month_key)
);

CREATE TABLE IF NOT EXISTS public.app_owner_finance_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  entry_type TEXT NOT NULL CHECK (entry_type IN ('revenue', 'expense')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('deal', 'pending', 'paid', 'cancelled')),
  customer_name TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_by_email TEXT NOT NULL DEFAULT 'snllabsarchive@gmail.com',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_owner_finance_entries_workspace_date
  ON public.app_owner_finance_entries(workspace_id, entry_date DESC);

CREATE TABLE IF NOT EXISTS public.app_owner_salary_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  user_email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  minimum_salary NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (minimum_salary >= 0),
  monthly_capacity_hours NUMERIC(8, 2) NOT NULL DEFAULT 160 CHECK (monthly_capacity_hours > 0),
  hourly_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_email)
);

ALTER TABLE public.app_owner_finance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_owner_finance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_owner_salary_settings ENABLE ROW LEVEL SECURITY;

-- Do not expose finance or payroll rows to browser clients. The owner-only
-- Edge API uses the service role and bypasses these policies.
REVOKE ALL ON TABLE public.app_owner_finance_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.app_owner_finance_entries FROM anon, authenticated;
REVOKE ALL ON TABLE public.app_owner_salary_settings FROM anon, authenticated;
GRANT ALL ON TABLE public.app_owner_finance_settings TO service_role;
GRANT ALL ON TABLE public.app_owner_finance_entries TO service_role;
GRANT ALL ON TABLE public.app_owner_salary_settings TO service_role;
