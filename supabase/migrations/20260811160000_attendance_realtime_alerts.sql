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
