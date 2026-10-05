-- Standalone team application: new, empty Supabase project only.
-- Generated from the ordered supabase/migrations/*.sql files.
-- Do not run this on the existing Bilik Strategi project.


-- ===== 20260730000000_initial_schema.sql =====
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'team_lead', 'member', 'client')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    capacity_hours INT NOT NULL DEFAULT 40,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CLICKUP CONNECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.clickup_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id TEXT NOT NULL UNIQUE,
    workspace_name TEXT NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    connection_type TEXT NOT NULL DEFAULT 'personal_token' CHECK (connection_type IN ('personal_token', 'oauth')),
    connected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disconnected'))
);

-- 3. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    industry TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'lead', 'archived')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    account_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    logo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
    clickup_space_id TEXT,
    clickup_folder_id TEXT,
    clickup_list_id TEXT,
    team_lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    start_date DATE,
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PROJECT MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_role TEXT NOT NULL DEFAULT 'contributor',
    UNIQUE(project_id, user_id)
);

-- 6. TASK CACHE TABLE
CREATE TABLE IF NOT EXISTS public.task_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clickup_task_id TEXT NOT NULL UNIQUE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'to_do',
    priority TEXT DEFAULT 'normal',
    assignee_ids JSONB DEFAULT '[]'::jsonb,
    start_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    clickup_updated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_data JSONB DEFAULT '{}'::jsonb
);

-- 7. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    source TEXT NOT NULL DEFAULT 'web_app',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. WEBHOOK EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clickup_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'ignored')),
    error_message TEXT
);

-- 10. SYNC LOGS TABLE
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('pending', 'success', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT
);

-- 11. APP SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR OPTIMAL QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_task_cache_clickup_id ON public.task_cache(clickup_task_id);
CREATE INDEX IF NOT EXISTS idx_task_cache_project_id ON public.task_cache(project_id);
CREATE INDEX IF NOT EXISTS idx_task_cache_due_date ON public.task_cache(due_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clickup_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Read policies: Authenticated users can view profiles, projects, clients, tasks
CREATE POLICY "Allow authenticated read profiles" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read clients" ON public.clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read projects" ON public.projects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read task_cache" ON public.task_cache FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow user read own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow authenticated read activity logs" ON public.activity_logs FOR SELECT USING (auth.role() = 'authenticated');

-- ===== 20260802000000_project_meta.sql =====
CREATE TABLE IF NOT EXISTS public.project_meta (
    project_id TEXT PRIMARY KEY,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_meta_updated_at ON public.project_meta(updated_at DESC);

ALTER TABLE public.project_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read project_meta" ON public.project_meta;
DROP POLICY IF EXISTS "Allow public insert project_meta" ON public.project_meta;
DROP POLICY IF EXISTS "Allow public update project_meta" ON public.project_meta;
DROP POLICY IF EXISTS "Allow public delete project_meta" ON public.project_meta;

CREATE POLICY "Allow public read project_meta" ON public.project_meta FOR SELECT USING (true);
CREATE POLICY "Allow public insert project_meta" ON public.project_meta FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update project_meta" ON public.project_meta FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete project_meta" ON public.project_meta FOR DELETE USING (true);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_meta;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

-- ===== 20260803000000_app_realtime_sync.sql =====
-- App-first realtime sync policies.
-- Jalankan SQL ini di Supabase SQL Editor supaya client, project, task,
-- detail task, deadline, dan content plan bisa dibaca/ditulis oleh semua user aplikasi.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE IF EXISTS public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.task_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read clients" ON public.clients;
DROP POLICY IF EXISTS "Allow public insert clients" ON public.clients;
DROP POLICY IF EXISTS "Allow public update clients" ON public.clients;
DROP POLICY IF EXISTS "Allow public delete clients" ON public.clients;
CREATE POLICY "Allow public read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Allow public insert clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update clients" ON public.clients FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete clients" ON public.clients FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read projects" ON public.projects;
DROP POLICY IF EXISTS "Allow public insert projects" ON public.projects;
DROP POLICY IF EXISTS "Allow public update projects" ON public.projects;
DROP POLICY IF EXISTS "Allow public delete projects" ON public.projects;
CREATE POLICY "Allow public read projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Allow public insert projects" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update projects" ON public.projects FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete projects" ON public.projects FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read project_meta" ON public.project_meta;
DROP POLICY IF EXISTS "Allow public insert project_meta" ON public.project_meta;
DROP POLICY IF EXISTS "Allow public update project_meta" ON public.project_meta;
DROP POLICY IF EXISTS "Allow public delete project_meta" ON public.project_meta;
CREATE POLICY "Allow public read project_meta" ON public.project_meta FOR SELECT USING (true);
CREATE POLICY "Allow public insert project_meta" ON public.project_meta FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update project_meta" ON public.project_meta FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete project_meta" ON public.project_meta FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow authenticated read task_cache" ON public.task_cache;
DROP POLICY IF EXISTS "Allow public read task_cache" ON public.task_cache;
DROP POLICY IF EXISTS "Allow public insert task_cache" ON public.task_cache;
DROP POLICY IF EXISTS "Allow public update task_cache" ON public.task_cache;
DROP POLICY IF EXISTS "Allow public delete task_cache" ON public.task_cache;
CREATE POLICY "Allow public read task_cache" ON public.task_cache FOR SELECT USING (true);
CREATE POLICY "Allow public insert task_cache" ON public.task_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update task_cache" ON public.task_cache FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete task_cache" ON public.task_cache FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS public.content_plan_sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id TEXT,
  client_name TEXT NOT NULL,
  title TEXT NOT NULL,
  sheet_url TEXT NOT NULL,
  embed_url TEXT,
  platform TEXT DEFAULT 'Google Sheets',
  status TEXT DEFAULT 'active',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.content_plan_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read content_plan_sheets" ON public.content_plan_sheets;
DROP POLICY IF EXISTS "Allow public insert content_plan_sheets" ON public.content_plan_sheets;
DROP POLICY IF EXISTS "Allow public update content_plan_sheets" ON public.content_plan_sheets;
DROP POLICY IF EXISTS "Allow public delete content_plan_sheets" ON public.content_plan_sheets;
CREATE POLICY "Allow public read content_plan_sheets" ON public.content_plan_sheets FOR SELECT USING (true);
CREATE POLICY "Allow public insert content_plan_sheets" ON public.content_plan_sheets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update content_plan_sheets" ON public.content_plan_sheets FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete content_plan_sheets" ON public.content_plan_sheets FOR DELETE USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.project_meta;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_cache;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.content_plan_sheets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== 20260803010000_app_chat_messages.sql =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.app_chat_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  normalized_channel_id TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  text TEXT NOT NULL,
  parent_id TEXT,
  reply_count INTEGER NOT NULL DEFAULT 0,
  reply_author TEXT,
  reply_text TEXT,
  clickup_message_id TEXT,
  clickup_synced BOOLEAN NOT NULL DEFAULT FALSE,
  clickup_sync_warning TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_chat_messages_channel_created
  ON public.app_chat_messages (normalized_channel_id, created_at);

CREATE INDEX IF NOT EXISTS idx_app_chat_messages_clickup_message
  ON public.app_chat_messages (clickup_message_id);

ALTER TABLE public.app_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read app_chat_messages" ON public.app_chat_messages;
DROP POLICY IF EXISTS "Allow public insert app_chat_messages" ON public.app_chat_messages;
DROP POLICY IF EXISTS "Allow public update app_chat_messages" ON public.app_chat_messages;
DROP POLICY IF EXISTS "Allow public delete app_chat_messages" ON public.app_chat_messages;

CREATE POLICY "Allow public read app_chat_messages"
  ON public.app_chat_messages FOR SELECT USING (true);

CREATE POLICY "Allow public insert app_chat_messages"
  ON public.app_chat_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update app_chat_messages"
  ON public.app_chat_messages FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete app_chat_messages"
  ON public.app_chat_messages FOR DELETE USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== 20260803020000_app_workspaces_chat_core.sql =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.app_workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_user_id TEXT,
  owner_email TEXT,
  clickup_workspace_id TEXT,
  clickup_space_id TEXT,
  clickup_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  clickup_sync_status TEXT NOT NULL DEFAULT 'not_configured',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_workspace_members (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  workspace_id TEXT NOT NULL REFERENCES public.app_workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT,
  user_avatar TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.app_chat_rooms (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES public.app_workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'channel',
  name TEXT NOT NULL,
  normalized_channel_id TEXT NOT NULL,
  clickup_channel_id TEXT,
  clickup_view_id TEXT,
  clickup_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, normalized_channel_id)
);

CREATE TABLE IF NOT EXISTS public.app_chat_room_members (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  room_id TEXT NOT NULL REFERENCES public.app_chat_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  last_read_message_id TEXT,
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.app_chat_sync_jobs (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  workspace_id TEXT REFERENCES public.app_workspaces(id) ON DELETE CASCADE,
  room_id TEXT,
  message_id TEXT,
  provider TEXT NOT NULL DEFAULT 'clickup',
  action TEXT NOT NULL DEFAULT 'send_message',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_chat_messages
  ADD COLUMN IF NOT EXISTS workspace_id TEXT,
  ADD COLUMN IF NOT EXISTS room_id TEXT,
  ADD COLUMN IF NOT EXISTS app_first BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_app_workspace_members_workspace
  ON public.app_workspace_members (workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_app_chat_rooms_workspace
  ON public.app_chat_rooms (workspace_id, normalized_channel_id);

CREATE INDEX IF NOT EXISTS idx_app_chat_sync_jobs_status
  ON public.app_chat_sync_jobs (status, run_after);

CREATE INDEX IF NOT EXISTS idx_app_chat_messages_workspace_room
  ON public.app_chat_messages (workspace_id, room_id, created_at);

ALTER TABLE public.app_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_chat_sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read app_workspaces" ON public.app_workspaces;
DROP POLICY IF EXISTS "Allow public insert app_workspaces" ON public.app_workspaces;
DROP POLICY IF EXISTS "Allow public update app_workspaces" ON public.app_workspaces;
DROP POLICY IF EXISTS "Allow public delete app_workspaces" ON public.app_workspaces;
CREATE POLICY "Allow public read app_workspaces" ON public.app_workspaces FOR SELECT USING (true);
CREATE POLICY "Allow public insert app_workspaces" ON public.app_workspaces FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update app_workspaces" ON public.app_workspaces FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete app_workspaces" ON public.app_workspaces FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read app_workspace_members" ON public.app_workspace_members;
DROP POLICY IF EXISTS "Allow public insert app_workspace_members" ON public.app_workspace_members;
DROP POLICY IF EXISTS "Allow public update app_workspace_members" ON public.app_workspace_members;
DROP POLICY IF EXISTS "Allow public delete app_workspace_members" ON public.app_workspace_members;
CREATE POLICY "Allow public read app_workspace_members" ON public.app_workspace_members FOR SELECT USING (true);
CREATE POLICY "Allow public insert app_workspace_members" ON public.app_workspace_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update app_workspace_members" ON public.app_workspace_members FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete app_workspace_members" ON public.app_workspace_members FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read app_chat_rooms" ON public.app_chat_rooms;
DROP POLICY IF EXISTS "Allow public insert app_chat_rooms" ON public.app_chat_rooms;
DROP POLICY IF EXISTS "Allow public update app_chat_rooms" ON public.app_chat_rooms;
DROP POLICY IF EXISTS "Allow public delete app_chat_rooms" ON public.app_chat_rooms;
CREATE POLICY "Allow public read app_chat_rooms" ON public.app_chat_rooms FOR SELECT USING (true);
CREATE POLICY "Allow public insert app_chat_rooms" ON public.app_chat_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update app_chat_rooms" ON public.app_chat_rooms FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete app_chat_rooms" ON public.app_chat_rooms FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read app_chat_room_members" ON public.app_chat_room_members;
DROP POLICY IF EXISTS "Allow public insert app_chat_room_members" ON public.app_chat_room_members;
DROP POLICY IF EXISTS "Allow public update app_chat_room_members" ON public.app_chat_room_members;
DROP POLICY IF EXISTS "Allow public delete app_chat_room_members" ON public.app_chat_room_members;
CREATE POLICY "Allow public read app_chat_room_members" ON public.app_chat_room_members FOR SELECT USING (true);
CREATE POLICY "Allow public insert app_chat_room_members" ON public.app_chat_room_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update app_chat_room_members" ON public.app_chat_room_members FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete app_chat_room_members" ON public.app_chat_room_members FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read app_chat_sync_jobs" ON public.app_chat_sync_jobs;
DROP POLICY IF EXISTS "Allow public insert app_chat_sync_jobs" ON public.app_chat_sync_jobs;
DROP POLICY IF EXISTS "Allow public update app_chat_sync_jobs" ON public.app_chat_sync_jobs;
DROP POLICY IF EXISTS "Allow public delete app_chat_sync_jobs" ON public.app_chat_sync_jobs;
CREATE POLICY "Allow public read app_chat_sync_jobs" ON public.app_chat_sync_jobs FOR SELECT USING (true);
CREATE POLICY "Allow public insert app_chat_sync_jobs" ON public.app_chat_sync_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update app_chat_sync_jobs" ON public.app_chat_sync_jobs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete app_chat_sync_jobs" ON public.app_chat_sync_jobs FOR DELETE USING (true);

INSERT INTO public.app_workspaces (id, name, slug, owner_email, clickup_workspace_id, clickup_space_id, clickup_sync_enabled, clickup_sync_status)
VALUES (
  'bilik-strategi',
  'Team Workspace',
  'team',
  NULL,
  NULL,
  NULL,
  FALSE,
  'not_configured'
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_workspaces;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_workspace_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_chat_rooms;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_chat_room_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_chat_sync_jobs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== 20260804000000_attendance_pause.sql =====
-- Pause/resume support for live attendance.
-- Run this in Supabase SQL Editor before using the pause button.

ALTER TABLE IF EXISTS public.active_sessions
  ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS accumulated_seconds INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.active_sessions
  ALTER COLUMN accumulated_seconds SET DEFAULT 0;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- ===== 20260804010000_app_user_roles.sql =====
CREATE TABLE IF NOT EXISTS public.app_user_roles (
  email TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'client')),
  is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_user_roles_status
  ON public.app_user_roles (status, role);

ALTER TABLE public.app_user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read app_user_roles" ON public.app_user_roles;
CREATE POLICY "Allow public read app_user_roles"
  ON public.app_user_roles
  FOR SELECT
  USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_user_roles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== 20260804020000_task_identity_dedupe.sql =====
-- Remove duplicate app/ClickUp rows created before task re-keying was fixed.
WITH ranked_tasks AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(NULLIF(raw_data->>'id', ''), clickup_task_id)
      ORDER BY
        CASE WHEN COALESCE(clickup_task_id, '') LIKE 'app-%' THEN 0 ELSE 1 END DESC,
        last_synced_at DESC,
        id DESC
    ) AS row_number
  FROM public.task_cache
)
DELETE FROM public.task_cache AS tasks
USING ranked_tasks
WHERE tasks.id = ranked_tasks.id
  AND ranked_tasks.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_cache_raw_identity_unique
  ON public.task_cache ((NULLIF(raw_data->>'id', '')))
  WHERE NULLIF(raw_data->>'id', '') IS NOT NULL;

-- ===== 20260804030000_user_page_access.sql =====
-- Per-user page visibility for the application navigation and route guard.
-- Semua halaman aktif secara default agar role lama tidak kehilangan akses.

ALTER TABLE IF EXISTS public.app_user_roles
  ADD COLUMN IF NOT EXISTS page_access JSONB NOT NULL DEFAULT '{
    "dashboard": true,
    "projects": true,
    "tasks": true,
    "my_tasks": true,
    "timeline": true,
    "team": true,
    "attendance": true,
    "clients": true,
    "assets": true,
    "content_plan": true,
    "chat": true,
    "notifications": true,
    "activity_logs": true,
    "settings": true,
    "calendar": true
  }'::jsonb;

UPDATE public.app_user_roles
SET page_access = COALESCE(page_access, '{
  "dashboard": true,
  "projects": true,
  "tasks": true,
  "my_tasks": true,
  "timeline": true,
  "team": true,
  "attendance": true,
  "clients": true,
  "assets": true,
  "content_plan": true,
  "chat": true,
  "notifications": true,
  "activity_logs": true,
  "settings": true,
  "calendar": true
}'::jsonb);

-- ===== 20260804040000_invoices.sql =====
-- Custom invoice studio storage.
-- Jalankan setelah migration app_user_roles dan app_realtime_sync.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE IF EXISTS public.app_user_roles
  ADD COLUMN IF NOT EXISTS page_access JSONB NOT NULL DEFAULT '{
    "dashboard": true,
    "projects": true,
    "tasks": true,
    "my_tasks": true,
    "timeline": true,
    "team": true,
    "attendance": true,
    "clients": true,
    "assets": true,
    "content_plan": true,
    "invoices": true,
    "chat": true,
    "notifications": true,
    "activity_logs": true,
    "settings": true,
    "calendar": true
  }'::jsonb;

ALTER TABLE IF EXISTS public.app_user_roles
  ALTER COLUMN page_access SET DEFAULT '{
    "dashboard": true,
    "projects": true,
    "tasks": true,
    "my_tasks": true,
    "timeline": true,
    "team": true,
    "attendance": true,
    "clients": true,
    "assets": true,
    "content_plan": true,
    "invoices": true,
    "chat": true,
    "notifications": true,
    "activity_logs": true,
    "settings": true,
    "calendar": true
  }'::jsonb;

UPDATE public.app_user_roles
SET page_access = jsonb_set(
  COALESCE(page_access, '{}'::jsonb),
  '{invoices}',
  'true'::jsonb,
  true
);

CREATE TABLE IF NOT EXISTS public.app_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_app_invoices_workspace_updated
  ON public.app_invoices(workspace_id, updated_at DESC);

ALTER TABLE public.app_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read app_invoices" ON public.app_invoices;
DROP POLICY IF EXISTS "Allow public insert app_invoices" ON public.app_invoices;
DROP POLICY IF EXISTS "Allow public update app_invoices" ON public.app_invoices;
DROP POLICY IF EXISTS "Allow public delete app_invoices" ON public.app_invoices;

CREATE POLICY "Allow public read app_invoices"
  ON public.app_invoices FOR SELECT USING (true);
CREATE POLICY "Allow public insert app_invoices"
  ON public.app_invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update app_invoices"
  ON public.app_invoices FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete app_invoices"
  ON public.app_invoices FOR DELETE USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_invoices;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== 20260804050000_attendance_schedule_and_access.sql =====
-- Work schedule and holiday access approval for the attendance page.
-- Run this migration in Supabase SQL Editor before enabling holiday locking.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.attendance_work_schedules (
  workspace_key TEXT PRIMARY KEY,
  timezone TEXT NOT NULL DEFAULT 'Asia/Makassar',
  days JSONB NOT NULL DEFAULT '[
    {"day":1,"label":"Senin","shortLabel":"Sen","isWorking":true,"startTime":"08:30","endTime":"17:30"},
    {"day":2,"label":"Selasa","shortLabel":"Sel","isWorking":true,"startTime":"08:30","endTime":"17:30"},
    {"day":3,"label":"Rabu","shortLabel":"Rab","isWorking":true,"startTime":"08:30","endTime":"17:30"},
    {"day":4,"label":"Kamis","shortLabel":"Kam","isWorking":true,"startTime":"08:30","endTime":"17:30"},
    {"day":5,"label":"Jumat","shortLabel":"Jum","isWorking":true,"startTime":"08:30","endTime":"17:30"},
    {"day":6,"label":"Sabtu","shortLabel":"Sab","isWorking":false,"startTime":"08:30","endTime":"17:30"},
    {"day":0,"label":"Minggu","shortLabel":"Min","isWorking":false,"startTime":"08:30","endTime":"17:30"}
  ]'::JSONB,
  updated_by_email TEXT,
  updated_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.attendance_work_schedules (workspace_key)
VALUES ('bilik-strategi')
ON CONFLICT (workspace_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.attendance_access_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  request_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_email TEXT,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, request_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_access_requests_status_date
  ON public.attendance_access_requests (status, request_date, created_at DESC);

ALTER TABLE public.attendance_work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read attendance work schedules" ON public.attendance_work_schedules;
CREATE POLICY "Allow public read attendance work schedules"
  ON public.attendance_work_schedules
  FOR SELECT
  USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_work_schedules;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_access_requests;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- ===== 20260810000000_enforce_superuser_identity.sql =====
-- The standalone template provisions its first Owner through the setup flow.
-- Keep the page access column expected by all modules without seeding a person.
ALTER TABLE IF EXISTS public.app_user_roles
  ADD COLUMN IF NOT EXISTS page_access JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ===== 20260810010000_app_quotes.sql =====
-- Penawaran harga terpisah dari Invoice Studio.
-- Jalankan setelah migration app_user_roles dan app_invoices.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE IF EXISTS public.app_user_roles
  ADD COLUMN IF NOT EXISTS page_access JSONB NOT NULL DEFAULT '{
    "dashboard": true,
    "projects": true,
    "tasks": true,
    "my_tasks": true,
    "timeline": true,
    "team": true,
    "attendance": true,
    "clients": true,
    "assets": true,
    "content_plan": true,
    "invoices": true,
    "quotes": true,
    "notifications": true,
    "activity_logs": true,
    "settings": true,
    "calendar": true
  }'::jsonb;

UPDATE public.app_user_roles
SET page_access = jsonb_set(
  COALESCE(page_access, '{}'::jsonb),
  '{quotes}',
  'true'::jsonb,
  true
)
WHERE page_access IS NULL OR NOT (page_access ? 'quotes');

CREATE TABLE IF NOT EXISTS public.app_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  quote_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, quote_number)
);

CREATE INDEX IF NOT EXISTS idx_app_quotes_workspace_updated
  ON public.app_quotes(workspace_id, updated_at DESC);

ALTER TABLE public.app_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read app_quotes" ON public.app_quotes;
DROP POLICY IF EXISTS "Allow public insert app_quotes" ON public.app_quotes;
DROP POLICY IF EXISTS "Allow public update app_quotes" ON public.app_quotes;
DROP POLICY IF EXISTS "Allow public delete app_quotes" ON public.app_quotes;

CREATE POLICY "Allow public read app_quotes"
  ON public.app_quotes FOR SELECT USING (true);
CREATE POLICY "Allow public insert app_quotes"
  ON public.app_quotes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update app_quotes"
  ON public.app_quotes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete app_quotes"
  ON public.app_quotes FOR DELETE USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_quotes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== 20260810020000_app_agreements.sql =====
-- Collaboration Agreement storage.
-- Run after the app_user_roles/page-access migrations so the editor is
-- persistent across users in the same workspace.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE IF EXISTS public.app_user_roles
  ADD COLUMN IF NOT EXISTS page_access JSONB NOT NULL DEFAULT '{
    "dashboard": true,
    "projects": true,
    "tasks": true,
    "my_tasks": true,
    "timeline": true,
    "team": true,
    "attendance": true,
    "clients": true,
    "assets": true,
    "content_plan": true,
    "invoices": true,
    "quotes": true,
    "agreements": true,
    "notifications": true,
    "activity_logs": true,
    "settings": true,
    "calendar": true
  }'::jsonb;

UPDATE public.app_user_roles
SET page_access = jsonb_set(
  COALESCE(page_access, '{}'::jsonb),
  '{agreements}',
  'true'::jsonb,
  true
)
WHERE page_access IS NULL OR NOT (page_access ? 'agreements');

CREATE TABLE IF NOT EXISTS public.app_agreements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  agreement_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'archived')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, agreement_number)
);

CREATE INDEX IF NOT EXISTS idx_app_agreements_workspace_updated
  ON public.app_agreements(workspace_id, updated_at DESC);

ALTER TABLE public.app_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read app_agreements" ON public.app_agreements;
DROP POLICY IF EXISTS "Allow public insert app_agreements" ON public.app_agreements;
DROP POLICY IF EXISTS "Allow public update app_agreements" ON public.app_agreements;
DROP POLICY IF EXISTS "Allow public delete app_agreements" ON public.app_agreements;

CREATE POLICY "Allow public read app_agreements"
  ON public.app_agreements FOR SELECT USING (true);
CREATE POLICY "Allow public insert app_agreements"
  ON public.app_agreements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update app_agreements"
  ON public.app_agreements FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete app_agreements"
  ON public.app_agreements FOR DELETE USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_agreements;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== 20260810030000_owner_finance_dashboard.sql =====
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
  created_by_email TEXT NOT NULL DEFAULT '',
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
  created_by_email TEXT NOT NULL DEFAULT '',
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

-- ===== 20260810040000_owner_salary_slips.sql =====
-- Owner-only salary slip branding and per-member monthly payroll documents.
-- Run this migration before opening /salary-slips in production.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.app_owner_salary_slip_branding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi' UNIQUE,
  company_name TEXT NOT NULL DEFAULT 'Team Workspace',
  company_address TEXT NOT NULL DEFAULT '',
  company_email TEXT NOT NULL DEFAULT '',
  company_phone TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  footer_text TEXT NOT NULL DEFAULT 'Slip gaji ini bersifat rahasia dan hanya ditujukan untuk penerima yang tercantum.',
  currency TEXT NOT NULL DEFAULT 'IDR',
  created_by_email TEXT NOT NULL DEFAULT '',
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
  created_by_email TEXT NOT NULL DEFAULT '',
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

-- ===== 20260810050000_owner_salary_payments.sql =====
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
  created_by_email TEXT NOT NULL DEFAULT '',
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

-- ===== 20260811000000_app_activity_notifications.sql =====
-- Persistent app notifications for cookie-based ClickUp/app identities.
-- The application reads and writes this table through the Supabase service role
-- because the app session is identified by email cookies, not auth.uid().

CREATE TABLE IF NOT EXISTS public.app_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  recipient_email TEXT NOT NULL,
  recipient_clickup_id TEXT,
  actor_email TEXT,
  actor_name TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  entity_url TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  dedupe_key TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_recipient
  ON public.app_notifications (workspace_id, recipient_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_notifications_unread
  ON public.app_notifications (workspace_id, recipient_email, is_read, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_notifications_dedupe
  ON public.app_notifications (workspace_id, recipient_email, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== 20260811130000_performance_kpi_activity.sql =====
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

-- ===== 20260811160000_attendance_realtime_alerts.sql =====
-- Expose complete deleted/updated attendance rows to Supabase Realtime.
-- This lets the global UI identify check-in, pause, and check-out events.

ALTER TABLE IF EXISTS public.active_sessions REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- ===== 20260811170000_approval_center.sql =====
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

-- ===== 20260811180000_project_profitability.sql =====
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

-- ===== 20260811190000_automation_center.sql =====
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

-- ===== 20260812000000_approval_request_categories.sql =====
-- Expand Approval Center with clearly separated work and operational requests.
-- The approval category itself is derived from request_type in the application,
-- while this constraint keeps the accepted database values explicit.

ALTER TABLE public.app_approval_requests
  DROP CONSTRAINT IF EXISTS app_approval_requests_request_type_check;

ALTER TABLE public.app_approval_requests
  ADD CONSTRAINT app_approval_requests_request_type_check CHECK (
    request_type IN (
      'daily_activity',
      'script',
      'strategy',
      'deliverable',
      'work_other',
      'leave',
      'overtime',
      'kpi',
      'general'
    )
  );

UPDATE public.app_approval_requests
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'approval_category',
  CASE
    WHEN request_type IN ('daily_activity', 'script', 'strategy', 'deliverable', 'work_other') THEN 'work'
    ELSE 'operational'
  END
)
WHERE metadata->>'approval_category' IS DISTINCT FROM CASE
  WHEN request_type IN ('daily_activity', 'script', 'strategy', 'deliverable', 'work_other') THEN 'work'
  ELSE 'operational'
END;

NOTIFY pgrst, 'reload schema';

-- ===== 20260812010000_project_profit_sharing.sql =====
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

-- ===== 20260812020000_project_profit_share_members.sql =====
-- Per-project allocation mode and member percentage overrides.

ALTER TABLE public.app_project_profit_share_settings
  ADD COLUMN IF NOT EXISTS allocation_mode TEXT NOT NULL DEFAULT 'automatic';

ALTER TABLE public.app_project_profit_share_settings
  DROP CONSTRAINT IF EXISTS app_project_profit_share_settings_allocation_mode_check;

ALTER TABLE public.app_project_profit_share_settings
  ADD CONSTRAINT app_project_profit_share_settings_allocation_mode_check
  CHECK (allocation_mode IN ('automatic', 'manual'));

ALTER TABLE public.app_project_profit_share_settings
  ADD COLUMN IF NOT EXISTS member_share_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.app_project_profit_share_settings
  DROP CONSTRAINT IF EXISTS app_project_profit_share_settings_member_share_overrides_check;

ALTER TABLE public.app_project_profit_share_settings
  ADD CONSTRAINT app_project_profit_share_settings_member_share_overrides_check
  CHECK (jsonb_typeof(member_share_overrides) = 'object');

NOTIFY pgrst, 'reload schema';

-- ===== 20260813000000_content_idea_bank.sql =====
-- Shared content-reference and content-idea bank for every active app user.
-- The app reads and writes these tables through the server service role because
-- workspace sessions are identified by ClickUp email cookies, not auth.uid().

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE IF EXISTS public.app_user_roles
  ADD COLUMN IF NOT EXISTS page_access JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_user_roles
SET page_access = jsonb_set(
  COALESCE(page_access, '{}'::jsonb),
  '{content_ideas}',
  'true'::jsonb,
  true
)
WHERE page_access IS NULL OR NOT (page_access ? 'content_ideas');

CREATE TABLE IF NOT EXISTS public.app_content_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  platform TEXT NOT NULL,
  pillar TEXT NOT NULL,
  content_url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  insight TEXT NOT NULL DEFAULT '',
  is_brand_relevant BOOLEAN NOT NULL DEFAULT FALSE,
  is_applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_email TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_references_workspace_updated
  ON public.app_content_references (workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_references_workspace_pillar
  ON public.app_content_references (workspace_id, pillar);

CREATE TABLE IF NOT EXISTS public.app_content_ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  headline TEXT NOT NULL,
  pillar TEXT NOT NULL,
  reference_id UUID REFERENCES public.app_content_references(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  is_brand_relevant BOOLEAN NOT NULL DEFAULT FALSE,
  is_applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_email TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_ideas_workspace_updated
  ON public.app_content_ideas (workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_ideas_workspace_pillar
  ON public.app_content_ideas (workspace_id, pillar);

CREATE INDEX IF NOT EXISTS idx_content_ideas_reference
  ON public.app_content_ideas (reference_id)
  WHERE reference_id IS NOT NULL;

ALTER TABLE public.app_content_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_content_ideas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_content_references FROM anon, authenticated;
REVOKE ALL ON TABLE public.app_content_ideas FROM anon, authenticated;
GRANT ALL ON TABLE public.app_content_references TO service_role;
GRANT ALL ON TABLE public.app_content_ideas TO service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_content_references;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_content_ideas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== 20260814000000_attendance_presence_monitoring.sql =====
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

-- ===== 20261005000000_standalone_team_template.sql =====
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
