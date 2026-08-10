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
