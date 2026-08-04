-- ==============================================================================
-- BILIK STRATEGI - CHAT MEDIA ATTACHMENTS & AUTO-CLEANUP SQL SCHEMA
-- ==============================================================================

-- 1. Create Storage Bucket for Chat Attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage Bucket RLS Policies
DROP POLICY IF EXISTS "Public Read Chat Attachments" ON storage.objects;
CREATE POLICY "Public Read Chat Attachments"
ON storage.objects FOR SELECT
USING ( bucket_id = 'chat-attachments' );

DROP POLICY IF EXISTS "Public Upload Chat Attachments" ON storage.objects;
CREATE POLICY "Public Upload Chat Attachments"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'chat-attachments' );

DROP POLICY IF EXISTS "Public Delete Chat Attachments" ON storage.objects;
CREATE POLICY "Public Delete Chat Attachments"
ON storage.objects FOR DELETE
USING ( bucket_id = 'chat-attachments' );

-- 3. Create Media Tracking Table for Auto-Cleanup
CREATE TABLE IF NOT EXISTS public.app_chat_media_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  sender_id TEXT,
  viewed_by TEXT[] DEFAULT '{}'::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.app_chat_media_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All Read Media Attachments" ON public.app_chat_media_attachments;
CREATE POLICY "Allow All Read Media Attachments"
ON public.app_chat_media_attachments FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow All Insert Media Attachments" ON public.app_chat_media_attachments;
CREATE POLICY "Allow All Insert Media Attachments"
ON public.app_chat_media_attachments FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow All Update Media Attachments" ON public.app_chat_media_attachments;
CREATE POLICY "Allow All Update Media Attachments"
ON public.app_chat_media_attachments FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Allow All Delete Media Attachments" ON public.app_chat_media_attachments;
CREATE POLICY "Allow All Delete Media Attachments"
ON public.app_chat_media_attachments FOR DELETE
USING (true);
