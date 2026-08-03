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
