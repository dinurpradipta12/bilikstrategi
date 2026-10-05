-- Central registry only. Each team app uses its own deployment and Supabase project.
-- This migration is additive and does not change existing Bilik Strategi workspaces.
CREATE TABLE IF NOT EXISTS public.team_app_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_name TEXT NOT NULL CHECK (char_length(short_name) BETWEEN 2 AND 40),
  owner_email TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#24324A',
  accent_color TEXT NOT NULL DEFAULT '#F26B5E',
  hosting_provider TEXT NOT NULL DEFAULT 'undecided'
    CHECK (hosting_provider IN ('undecided', 'vercel', 'cloudflare_workers', 'other')),
  app_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'link_recorded')),
  created_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_app_instances_created_at_idx
  ON public.team_app_instances (created_at DESC);

ALTER TABLE public.team_app_instances ENABLE ROW LEVEL SECURITY;
-- No browser policy: only the server API can read and write this registry.
REVOKE ALL ON public.team_app_instances FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.team_app_instances TO service_role;
