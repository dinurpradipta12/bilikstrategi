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
  'Bilik Strategi Workspace',
  'bilik-strategi',
  'snllabsarchive@gmail.com',
  '90182855619',
  '901811771867',
  TRUE,
  'configured'
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
