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
