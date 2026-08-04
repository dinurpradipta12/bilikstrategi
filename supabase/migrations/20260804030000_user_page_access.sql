-- Per-user page visibility for the application navigation and route guard.
-- Semua halaman aktif secara default agar role lama tidak kehilangan akses.

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
    "calendar": true
  }'::jsonb;

UPDATE public.app_user_roles
SET page_access = COALESCE(page_access, '{
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
  "calendar": true
}'::jsonb);
