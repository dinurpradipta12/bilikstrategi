-- Owner-only monthly salary payment records.
-- Run this migration after 20260810030000_owner_finance_dashboard.sql.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.app_owner_salary_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  month_key DATE NOT NULL,
  user_email TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  paid_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'Bank transfer',
  bank_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  reference_number TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'cancelled')),
  created_by_email TEXT NOT NULL DEFAULT 'snllabsarchive@gmail.com',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, month_key, user_email)
);

CREATE INDEX IF NOT EXISTS idx_owner_salary_payments_workspace_month
  ON public.app_owner_salary_payments(workspace_id, month_key, paid_date DESC);

ALTER TABLE public.app_owner_salary_payments ENABLE ROW LEVEL SECURITY;

-- The owner-only Edge API uses the service role and bypasses these policies.
REVOKE ALL ON TABLE public.app_owner_salary_payments FROM anon, authenticated;
GRANT ALL ON TABLE public.app_owner_salary_payments TO service_role;
