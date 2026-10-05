-- Apply after the original schema migrations on a NEW Supabase project dedicated to one team.
-- The old app's public policies are replaced here before the application is exposed.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS division TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Makassar',
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (LOWER(username));

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS team_lead_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS member_ids JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE public.app_user_roles
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS page_access JSONB NOT NULL DEFAULT '{}'::JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS app_user_roles_user_id_unique ON public.app_user_roles (user_id);

CREATE TABLE IF NOT EXISTS public.team_branding (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  name TEXT NOT NULL DEFAULT 'Team Workspace',
  short_name TEXT NOT NULL DEFAULT 'Team',
  tagline TEXT NOT NULL DEFAULT 'Ruang kerja tim Anda',
  primary_color TEXT NOT NULL DEFAULT '#24324A',
  accent_color TEXT NOT NULL DEFAULT '#F26B5E',
  logo_url TEXT NOT NULL DEFAULT '',
  icon_url TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  company_address TEXT NOT NULL DEFAULT '',
  company_email TEXT NOT NULL DEFAULT '',
  company_phone TEXT NOT NULL DEFAULT '',
  modules_enabled JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.team_branding (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- The legacy app assumed these two tables were created manually. Include them
-- so presensi and its Owner reports work on a fresh team database.
CREATE TABLE IF NOT EXISTS public.active_sessions (
  user_name TEXT NOT NULL,
  user_email TEXT PRIMARY KEY,
  user_avatar TEXT,
  check_in_time TEXT,
  check_in_timestamp BIGINT NOT NULL,
  is_paused BOOLEAN NOT NULL DEFAULT FALSE,
  paused_at TIMESTAMPTZ,
  accumulated_seconds INTEGER NOT NULL DEFAULT 0,
  selected_project TEXT NOT NULL DEFAULT 'Team Workspace',
  notes_input TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS active_sessions_email_idx ON public.active_sessions (LOWER(user_email));

CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  user_email TEXT,
  user_avatar TEXT,
  date DATE NOT NULL,
  day_name TEXT,
  check_in_time TEXT,
  check_out_time TEXT,
  duration_hours NUMERIC NOT NULL DEFAULT 0,
  regular_hours NUMERIC NOT NULL DEFAULT 0,
  overtime_hours NUMERIC NOT NULL DEFAULT 0,
  status TEXT,
  project_name TEXT,
  notes TEXT,
  checkout_source TEXT NOT NULL DEFAULT 'self',
  checkout_by_email TEXT,
  checkout_by_name TEXT,
  checkout_reason TEXT,
  inactivity_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS attendance_logs_date_idx ON public.attendance_logs (date DESC);
CREATE INDEX IF NOT EXISTS attendance_logs_email_idx ON public.attendance_logs (LOWER(user_email));

CREATE TABLE IF NOT EXISTS public.agency_assets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'pdf',
  size TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL DEFAULT '',
  uploaded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tags JSONB NOT NULL DEFAULT '[]'::JSONB,
  downloads_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('team-branding', 'team-branding', TRUE, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = TRUE, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.team_user_active() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active') $$;
CREATE OR REPLACE FUNCTION public.team_user_owner() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role = 'owner') $$;
CREATE OR REPLACE FUNCTION public.team_user_can(page_key TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.app_user_roles r ON r.user_id = p.id
    WHERE p.id = auth.uid() AND p.status = 'active'
      AND COALESCE(r.status, 'active') = 'active'
      AND COALESCE((SELECT b.modules_enabled ->> page_key FROM public.team_branding b WHERE b.id = TRUE)::BOOLEAN, TRUE)
      AND (p.role IN ('owner', 'admin') OR COALESCE((r.page_access ->> page_key)::BOOLEAN, page_key NOT IN ('profitability', 'automations')))
  )
$$;
REVOKE ALL ON FUNCTION public.team_user_active() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_user_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_user_can(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.team_user_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_user_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_user_can(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_team_attendance() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.team_user_owner() THEN RAISE EXCEPTION 'Owner access required'; END IF;
  DELETE FROM public.attendance_logs;
  DELETE FROM public.active_sessions;
  DELETE FROM public.attendance_access_requests;
END $$;
REVOKE ALL ON FUNCTION public.reset_team_attendance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_team_attendance() TO authenticated;

-- Remove every policy installed by the Bilik app. Service-role API handlers still
-- bypass RLS, while browser requests require an active Auth user and page access.
DO $$
DECLARE row RECORD; access_expr TEXT; page_key TEXT;
BEGIN
  FOR row IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', row.tablename);
    FOR access_expr IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = row.tablename LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', access_expr, row.tablename);
    END LOOP;

    IF row.tablename IN ('clickup_connections', 'webhook_events', 'sync_logs', 'app_chat_sync_jobs',
      'attendance_presence_state', 'attendance_activity_events') THEN
      CONTINUE;
    END IF;

    IF row.tablename IN ('profiles', 'app_user_roles', 'app_workspace_members', 'app_workspaces', 'team_branding') THEN
      EXECUTE format('CREATE POLICY team_read ON public.%I FOR SELECT TO authenticated USING (public.team_user_active())', row.tablename);
      CONTINUE;
    END IF;

    -- Identity-bearing records are written only by server APIs. Browser
    -- clients may subscribe/read but cannot impersonate another teammate.
    IF row.tablename IN ('active_sessions', 'attendance_logs', 'attendance_work_schedules',
      'attendance_access_requests', 'app_chat_messages', 'app_chat_rooms',
      'app_chat_room_members', 'app_chat_media_attachments') THEN
      page_key := CASE WHEN row.tablename LIKE 'attendance_%' OR row.tablename = 'active_sessions' THEN 'attendance' ELSE 'chat' END;
      EXECUTE format('CREATE POLICY team_read ON public.%I FOR SELECT TO authenticated USING (public.team_user_can(%L))', row.tablename, page_key);
      CONTINUE;
    END IF;

    page_key := CASE
      WHEN row.tablename LIKE 'app_owner_finance_%' THEN 'finance'
      WHEN row.tablename LIKE 'app_owner_salary_%' THEN 'salary_slips'
      WHEN row.tablename IN ('app_project_profit_share_settings', 'app_project_profitability_settings') THEN 'profitability'
      WHEN row.tablename IN ('active_sessions', 'attendance_logs', 'attendance_work_schedules', 'attendance_access_requests') THEN 'attendance'
      WHEN row.tablename LIKE 'app_performance_%' THEN 'performance'
      WHEN row.tablename IN ('app_invoices') THEN 'invoices'
      WHEN row.tablename IN ('app_quotes') THEN 'quotes'
      WHEN row.tablename IN ('app_agreements') THEN 'agreements'
      WHEN row.tablename IN ('app_approval_requests') THEN 'approvals'
      WHEN row.tablename IN ('app_automation_rules', 'app_automation_runs') THEN 'automations'
      WHEN row.tablename IN ('app_content_ideas', 'app_content_references') THEN 'content_ideas'
      WHEN row.tablename IN ('content_plan_sheets') THEN 'content_plan'
      WHEN row.tablename IN ('agency_assets') THEN 'assets'
      WHEN row.tablename IN ('clients') THEN 'clients'
      WHEN row.tablename IN ('projects', 'project_members', 'project_meta') THEN 'projects'
      WHEN row.tablename IN ('task_cache') THEN 'tasks'
      WHEN row.tablename IN ('app_chat_messages', 'app_chat_rooms', 'app_chat_room_members', 'app_chat_media_attachments') THEN 'chat'
      WHEN row.tablename IN ('app_notifications', 'notifications') THEN 'notifications'
      WHEN row.tablename IN ('app_settings') THEN 'settings'
      ELSE 'dashboard'
    END;

    IF page_key IN ('finance', 'salary_slips', 'profitability') THEN
      access_expr := format('public.team_user_owner() AND public.team_user_can(%L)', page_key);
    ELSE
      access_expr := format('public.team_user_can(%L)', page_key);
    END IF;
    EXECUTE format('CREATE POLICY team_access ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)', row.tablename, access_expr, access_expr);
  END LOOP;
END $$;

-- Profiles and roles can only be provisioned by trusted server APIs.
REVOKE INSERT, UPDATE, DELETE ON public.profiles, public.app_user_roles, public.app_workspace_members, public.app_workspaces, public.team_branding FROM anon, authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.agency_assets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
