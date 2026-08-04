-- Work schedule and holiday access approval for the attendance page.
-- Run this migration in Supabase SQL Editor before enabling holiday locking.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.attendance_work_schedules (
  workspace_key TEXT PRIMARY KEY,
  timezone TEXT NOT NULL DEFAULT 'Asia/Makassar',
  days JSONB NOT NULL DEFAULT '[
    {"day":1,"label":"Senin","shortLabel":"Sen","isWorking":true,"startTime":"08:30","endTime":"17:30"},
    {"day":2,"label":"Selasa","shortLabel":"Sel","isWorking":true,"startTime":"08:30","endTime":"17:30"},
    {"day":3,"label":"Rabu","shortLabel":"Rab","isWorking":true,"startTime":"08:30","endTime":"17:30"},
    {"day":4,"label":"Kamis","shortLabel":"Kam","isWorking":true,"startTime":"08:30","endTime":"17:30"},
    {"day":5,"label":"Jumat","shortLabel":"Jum","isWorking":true,"startTime":"08:30","endTime":"17:30"},
    {"day":6,"label":"Sabtu","shortLabel":"Sab","isWorking":false,"startTime":"08:30","endTime":"17:30"},
    {"day":0,"label":"Minggu","shortLabel":"Min","isWorking":false,"startTime":"08:30","endTime":"17:30"}
  ]'::JSONB,
  updated_by_email TEXT,
  updated_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.attendance_work_schedules (workspace_key)
VALUES ('bilik-strategi')
ON CONFLICT (workspace_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.attendance_access_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  request_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_email TEXT,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, request_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_access_requests_status_date
  ON public.attendance_access_requests (status, request_date, created_at DESC);

ALTER TABLE public.attendance_work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read attendance work schedules" ON public.attendance_work_schedules;
CREATE POLICY "Allow public read attendance work schedules"
  ON public.attendance_work_schedules
  FOR SELECT
  USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_work_schedules;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_access_requests;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
