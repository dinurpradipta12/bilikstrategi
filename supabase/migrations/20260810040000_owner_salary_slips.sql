-- Owner-only salary slip branding and per-member monthly payroll documents.
-- Run this migration before opening /salary-slips in production.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.app_owner_salary_slip_branding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi' UNIQUE,
  company_name TEXT NOT NULL DEFAULT 'Bilik Strategi',
  company_address TEXT NOT NULL DEFAULT '',
  company_email TEXT NOT NULL DEFAULT '',
  company_phone TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '/landscape.png',
  footer_text TEXT NOT NULL DEFAULT 'Slip gaji ini bersifat rahasia dan hanya ditujukan untuk penerima yang tercantum.',
  currency TEXT NOT NULL DEFAULT 'IDR',
  created_by_email TEXT NOT NULL DEFAULT 'snllabsarchive@gmail.com',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_owner_salary_slips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  month_key DATE NOT NULL,
  user_email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  employee_role TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  slip_number TEXT NOT NULL DEFAULT '',
  base_salary NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  attendance_days NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (attendance_days >= 0),
  worked_hours NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (worked_hours >= 0),
  overtime_hours NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
  overtime_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (overtime_rate >= 0),
  allowances JSONB NOT NULL DEFAULT '[]'::jsonb,
  deductions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid')),
  payment_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_by_email TEXT NOT NULL DEFAULT 'snllabsarchive@gmail.com',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, month_key, user_email)
);

CREATE INDEX IF NOT EXISTS idx_owner_salary_slips_workspace_month
  ON public.app_owner_salary_slips(workspace_id, month_key DESC);

ALTER TABLE public.app_owner_salary_slip_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_owner_salary_slips ENABLE ROW LEVEL SECURITY;

-- Browser clients must not read or write owner payroll documents directly.
-- The owner-only Edge API uses the service role and bypasses these policies.
REVOKE ALL ON TABLE public.app_owner_salary_slip_branding FROM anon, authenticated;
REVOKE ALL ON TABLE public.app_owner_salary_slips FROM anon, authenticated;
GRANT ALL ON TABLE public.app_owner_salary_slip_branding TO service_role;
GRANT ALL ON TABLE public.app_owner_salary_slips TO service_role;
