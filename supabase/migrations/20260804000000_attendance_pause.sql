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
