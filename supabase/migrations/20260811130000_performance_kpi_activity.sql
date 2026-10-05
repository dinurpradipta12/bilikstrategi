-- KPI, OKR, job-description, and daily-activity workspace module.
-- All reads and writes are performed through the server service role because
-- the application session is identified by ClickUp/email cookies, not auth.uid().

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE IF EXISTS public.app_user_roles
  ADD COLUMN IF NOT EXISTS page_access JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_user_roles
SET page_access = COALESCE(page_access, '{}'::jsonb) || '{"performance": true}'::jsonb
WHERE NOT (COALESCE(page_access, '{}'::jsonb) ? 'performance');

CREATE TABLE IF NOT EXISTS public.app_performance_profiles (
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  user_email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  division TEXT NOT NULL DEFAULT 'Agency Team',
  role_title TEXT NOT NULL DEFAULT 'Team Member',
  job_summary TEXT NOT NULL DEFAULT '',
  manager_email TEXT,
  can_manage BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_email)
);

CREATE TABLE IF NOT EXISTS public.app_performance_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  parent_id UUID REFERENCES public.app_performance_items(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (
    item_type IN ('job_description', 'daily_activity', 'objective', 'key_result', 'initiative')
  ),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cadence TEXT NOT NULL DEFAULT 'daily' CHECK (
    cadence IN ('daily', 'weekly', 'monthly', 'quarterly', 'per_activity')
  ),
  scope_type TEXT NOT NULL DEFAULT 'team' CHECK (
    scope_type IN ('team', 'division', 'role', 'user')
  ),
  scope_value TEXT NOT NULL DEFAULT '*',
  weight NUMERIC(6,2) NOT NULL DEFAULT 10 CHECK (weight >= 0 AND weight <= 100),
  target_value NUMERIC(12,2) NOT NULL DEFAULT 100 CHECK (target_value > 0),
  unit TEXT NOT NULL DEFAULT 'percent',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_performance_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  item_id UUID REFERENCES public.app_performance_items(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (
    status IN ('todo', 'in_progress', 'completed', 'blocked')
  ),
  evidence_url TEXT,
  blocker_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, item_id, user_email, activity_date)
);

CREATE TABLE IF NOT EXISTS public.app_performance_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  user_email TEXT NOT NULL,
  reviewer_email TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  quality_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  ownership_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (ownership_score >= 0 AND ownership_score <= 100),
  collaboration_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (collaboration_score >= 0 AND collaboration_score <= 100),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_email, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_performance_profiles_workspace_division
  ON public.app_performance_profiles (workspace_id, division, active);

CREATE INDEX IF NOT EXISTS idx_performance_items_scope
  ON public.app_performance_items (workspace_id, scope_type, scope_value, active, sort_order);

CREATE INDEX IF NOT EXISTS idx_performance_items_parent
  ON public.app_performance_items (parent_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_performance_updates_user_date
  ON public.app_performance_updates (workspace_id, user_email, activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_performance_reviews_user_period
  ON public.app_performance_reviews (workspace_id, user_email, period_end DESC);

ALTER TABLE public.app_performance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_performance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_performance_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_performance_reviews ENABLE ROW LEVEL SECURITY;

-- Intentionally no anon/authenticated policies. The service role API applies
-- owner/admin/member scoping before any row is returned to the browser.

INSERT INTO public.app_performance_profiles (
  workspace_id,
  user_email,
  display_name,
  division,
  role_title,
  can_manage,
  active
)
SELECT
  'bilik-strategi',
  LOWER(email),
  display_name,
  'Agency Team',
  CASE
    WHEN role = 'owner' THEN 'Owner / Project Lead'
    WHEN role = 'admin' THEN 'Workspace Admin'
    WHEN role = 'client' THEN 'Client'
    ELSE 'Team Member'
  END,
  role IN ('owner', 'admin') OR is_superuser = TRUE,
  status = 'active'
FROM public.app_user_roles
ON CONFLICT (workspace_id, user_email) DO NOTHING;

-- KPI items begin empty in each new team installation.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_performance_profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_performance_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_performance_updates;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_performance_reviews;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
