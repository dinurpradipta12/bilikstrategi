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
