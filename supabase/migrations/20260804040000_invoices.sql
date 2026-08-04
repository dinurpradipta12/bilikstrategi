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
