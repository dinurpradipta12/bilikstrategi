-- App-presence monitoring for checked-in team members.
-- This stores only page-level activity and timestamps. It does not capture
-- typed content, screenshots, or activity outside Bilik Strategi.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.attendance_presence_state (
  user_email TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  user_name TEXT NOT NULL,
  session_check_in_timestamp BIGINT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ,
  last_foreground_at TIMESTAMPTZ,
  current_path TEXT,
  current_page_label TEXT,
  device_type TEXT,
  app_mode TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_presence_workspace_seen
  ON public.attendance_presence_state (workspace_id, last_seen_at DESC);

ALTER TABLE public.attendance_presence_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.attendance_presence_state FROM anon, authenticated;
GRANT ALL ON TABLE public.attendance_presence_state TO service_role;

COMMENT ON TABLE public.attendance_presence_state IS
  'Server-only current app presence for checked-in users; visible through manager-authorized APIs only.';

ALTER TABLE IF EXISTS public.attendance_logs
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS checkout_source TEXT NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS checkout_by_email TEXT,
  ADD COLUMN IF NOT EXISTS checkout_by_name TEXT,
  ADD COLUMN IF NOT EXISTS checkout_reason TEXT,
  ADD COLUMN IF NOT EXISTS inactivity_seconds INTEGER;

CREATE TABLE IF NOT EXISTS public.attendance_activity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  session_check_in_timestamp BIGINT,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('page_view', 'interaction', 'forced_checkout')
  ),
  page_path TEXT,
  page_label TEXT,
  device_type TEXT,
  app_mode TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_activity_user_created
  ON public.attendance_activity_events (LOWER(user_email), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_activity_workspace_created
  ON public.attendance_activity_events (workspace_id, created_at DESC);

ALTER TABLE public.attendance_activity_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.attendance_activity_events FROM anon, authenticated;
GRANT ALL ON TABLE public.attendance_activity_events TO service_role;

COMMENT ON TABLE public.attendance_activity_events IS
  'Privacy-limited page activity timeline for checked-in users; no input contents or external-app tracking.';
