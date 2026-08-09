-- Canonical application owner. This is independent from the active ClickUp token.
-- Run this migration (or the SQL below) once in the target Supabase project.

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
    "chat": true,
    "notifications": true,
    "activity_logs": true,
    "settings": true,
    "calendar": true,
    "invoices": true
  }'::jsonb;

INSERT INTO public.app_user_roles (
  email,
  display_name,
  role,
  is_superuser,
  status,
  page_access
)
VALUES (
  'snllabsarchive@gmail.com',
  'Dinur Pradipta',
  'owner',
  TRUE,
  'active',
  '{
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
    "chat": true,
    "notifications": true,
    "activity_logs": true,
    "settings": true,
    "calendar": true,
    "invoices": true
  }'::jsonb
)
ON CONFLICT (email) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  role = 'owner',
  is_superuser = TRUE,
  status = 'active',
  page_access = EXCLUDED.page_access,
  updated_at = NOW();
