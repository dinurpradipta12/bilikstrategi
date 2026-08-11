-- Central approval workflow for daily activity, leave, overtime, deliverables,
-- KPI submissions, and custom requests.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE IF EXISTS public.app_user_roles
  ADD COLUMN IF NOT EXISTS page_access JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_user_roles
SET page_access = COALESCE(page_access, '{}'::jsonb) || '{"approvals": true}'::jsonb
WHERE NOT (COALESCE(page_access, '{}'::jsonb) ? 'approvals');

CREATE TABLE IF NOT EXISTS public.app_approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  request_type TEXT NOT NULL DEFAULT 'general' CHECK (
    request_type IN ('daily_activity', 'leave', 'overtime', 'deliverable', 'kpi', 'general')
  ),
  source_type TEXT,
  source_id TEXT,
  requested_by_email TEXT NOT NULL,
  requested_by_name TEXT NOT NULL,
  requested_by_avatar TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'revision', 'rejected', 'cancelled')
  ),
  reviewer_email TEXT,
  reviewer_name TEXT,
  reviewer_note TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_source_unique
  ON public.app_approval_requests (workspace_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approval_workspace_status
  ON public.app_approval_requests (workspace_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requester
  ON public.app_approval_requests (workspace_id, requested_by_email, submitted_at DESC);

ALTER TABLE public.app_approval_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_approval_requests FROM anon, authenticated;
GRANT ALL ON TABLE public.app_approval_requests TO service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_approval_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
