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
