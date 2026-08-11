-- KPI, OKR, job-description, and daily-activity workspace module.
-- All reads and writes are performed through the server service role because
-- the application session is identified by ClickUp/email cookies, not auth.uid().

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE IF EXISTS public.app_user_roles
  ADD COLUMN IF NOT EXISTS page_access JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_user_roles
SET page_access = COALESCE(page_access, '{}'::jsonb) || '{"performance": true}'::jsonb
WHERE NOT (COALESCE(page_access, '{}'::jsonb) ? 'performance');

CREATE TABLE IF NOT EXISTS public.app_performance_profiles (
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  user_email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  division TEXT NOT NULL DEFAULT 'Agency Team',
  role_title TEXT NOT NULL DEFAULT 'Team Member',
  job_summary TEXT NOT NULL DEFAULT '',
  manager_email TEXT,
  can_manage BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_email)
);

CREATE TABLE IF NOT EXISTS public.app_performance_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  parent_id UUID REFERENCES public.app_performance_items(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (
    item_type IN ('job_description', 'daily_activity', 'objective', 'key_result', 'initiative')
  ),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cadence TEXT NOT NULL DEFAULT 'daily' CHECK (
    cadence IN ('daily', 'weekly', 'monthly', 'quarterly', 'per_activity')
  ),
  scope_type TEXT NOT NULL DEFAULT 'team' CHECK (
    scope_type IN ('team', 'division', 'role', 'user')
  ),
  scope_value TEXT NOT NULL DEFAULT '*',
  weight NUMERIC(6,2) NOT NULL DEFAULT 10 CHECK (weight >= 0 AND weight <= 100),
  target_value NUMERIC(12,2) NOT NULL DEFAULT 100 CHECK (target_value > 0),
  unit TEXT NOT NULL DEFAULT 'percent',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_performance_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  item_id UUID REFERENCES public.app_performance_items(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (
    status IN ('todo', 'in_progress', 'completed', 'blocked')
  ),
  evidence_url TEXT,
  blocker_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, item_id, user_email, activity_date)
);

CREATE TABLE IF NOT EXISTS public.app_performance_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id TEXT NOT NULL DEFAULT 'bilik-strategi',
  user_email TEXT NOT NULL,
  reviewer_email TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  quality_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  ownership_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (ownership_score >= 0 AND ownership_score <= 100),
  collaboration_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (collaboration_score >= 0 AND collaboration_score <= 100),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_email, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_performance_profiles_workspace_division
  ON public.app_performance_profiles (workspace_id, division, active);

CREATE INDEX IF NOT EXISTS idx_performance_items_scope
  ON public.app_performance_items (workspace_id, scope_type, scope_value, active, sort_order);

CREATE INDEX IF NOT EXISTS idx_performance_items_parent
  ON public.app_performance_items (parent_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_performance_updates_user_date
  ON public.app_performance_updates (workspace_id, user_email, activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_performance_reviews_user_period
  ON public.app_performance_reviews (workspace_id, user_email, period_end DESC);

ALTER TABLE public.app_performance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_performance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_performance_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_performance_reviews ENABLE ROW LEVEL SECURITY;

-- Intentionally no anon/authenticated policies. The service role API applies
-- owner/admin/member scoping before any row is returned to the browser.

INSERT INTO public.app_performance_profiles (
  workspace_id,
  user_email,
  display_name,
  division,
  role_title,
  can_manage,
  active
)
SELECT
  'bilik-strategi',
  LOWER(email),
  display_name,
  'Agency Team',
  CASE
    WHEN role = 'owner' THEN 'Owner / Project Lead'
    WHEN role = 'admin' THEN 'Workspace Admin'
    WHEN role = 'client' THEN 'Client'
    ELSE 'Team Member'
  END,
  role IN ('owner', 'admin') OR is_superuser = TRUE,
  status = 'active'
FROM public.app_user_roles
ON CONFLICT (workspace_id, user_email) DO NOTHING;

-- Starter structure based on the supplied Social Media Specialist reference.
INSERT INTO public.app_performance_items (
  workspace_id,
  item_type,
  title,
  description,
  cadence,
  scope_type,
  scope_value,
  weight,
  sort_order,
  created_by,
  updated_by
)
SELECT
  'bilik-strategi',
  seed.item_type,
  seed.title,
  seed.description,
  seed.cadence,
  seed.scope_type,
  seed.scope_value,
  seed.weight,
  seed.sort_order,
  'snllabsarchive@gmail.com',
  'snllabsarchive@gmail.com'
FROM (
  VALUES
    ('job_description', 'Mengelola seluruh aktivitas Instagram yang ditangani', 'Bertanggung jawab atas interaksi audiens, produksi konten, dan optimasi akun.', 'monthly', 'role', 'Social Media Specialist', 10::NUMERIC, 10),
    ('job_description', 'Membuat content plan, content writing, dan caption', 'Menyiapkan rencana serta materi konten sesuai timeline dan platform kerja tim.', 'monthly', 'role', 'Social Media Specialist', 10::NUMERIC, 20),
    ('job_description', 'Mencapai ekspektasi dan tujuan divisi', 'Menjalankan target sesuai ekspektasi divisi serta arahan yang telah disepakati.', 'quarterly', 'role', 'Social Media Specialist', 10::NUMERIC, 30),
    ('job_description', 'Menjalankan tanggung jawab jabatan secara mandiri', 'Menunjukkan inisiatif, kreativitas, problem solving, improvisasi, dan evaluasi dua arah.', 'quarterly', 'role', 'Social Media Specialist', 10::NUMERIC, 40),
    ('job_description', 'Menjalankan pekerjaan sesuai SOP dan kewenangan', 'Mematuhi wilayah kerja, arahan, rincian tugas, hubungan kerja, peraturan, dan prosedur.', 'monthly', 'role', 'Social Media Specialist', 10::NUMERIC, 50),
    ('job_description', 'Meningkatkan performa dan pengembangan jabatan', 'Mendiskusikan rencana pengembangan bersama strategist, creative manager, dan project manager.', 'quarterly', 'role', 'Social Media Specialist', 10::NUMERIC, 60),
    ('job_description', 'Menggunakan fasilitas kerja sesuai kebijakan', 'Memanfaatkan Canva Premium dan aplikasi pendukung yang disediakan secara bertanggung jawab.', 'per_activity', 'role', 'Social Media Specialist', 5::NUMERIC, 70),
    ('daily_activity', 'Check-in dan mengirim daily report', 'Lakukan presensi masuk/keluar dan kirim rangkuman pekerjaan setelah selesai bekerja.', 'daily', 'role', 'Social Media Specialist', 10::NUMERIC, 110),
    ('daily_activity', 'Menangani interaksi admin', 'Balas chat, komentar, mention, dan repost yang masuk pada akun yang ditangani.', 'daily', 'role', 'Social Media Specialist', 15::NUMERIC, 120),
    ('daily_activity', 'Membuat script konten sesuai timeline', 'Kerjakan script yang sudah direncanakan dan catat progres serta hambatannya.', 'daily', 'role', 'Social Media Specialist', 15::NUMERIC, 130),
    ('daily_activity', 'Membuat content writing', 'Siapkan content writing dan caption untuk kebutuhan content development.', 'daily', 'role', 'Social Media Specialist', 15::NUMERIC, 140),
    ('daily_activity', 'Upload konten sesuai jadwal', 'Publikasikan konten sesuai content plan yang telah disepakati.', 'daily', 'role', 'Social Media Specialist', 15::NUMERIC, 150),
    ('daily_activity', 'Menganalisis performa konten', 'Bantu tim strategist membaca performa setiap konten yang sudah dipublikasikan.', 'daily', 'role', 'Social Media Specialist', 15::NUMERIC, 160),
    ('daily_activity', 'Berkoordinasi dengan tim dan divisi terkait', 'Catat koordinasi, keputusan, dan tindak lanjut penting hari ini.', 'daily', 'role', 'Social Media Specialist', 15::NUMERIC, 170),
    ('initiative', 'Hadir di weekly meeting dan monthly presentation', 'Kehadiran pada meeting terjadwal dan penyampaian progres.', 'weekly', 'team', '*', 5::NUMERIC, 210),
    ('initiative', 'Brainstorming dan koordinasi antar tim', 'Berpartisipasi aktif dalam diskusi, brainstorming, dan sinkronisasi lintas divisi.', 'weekly', 'team', '*', 5::NUMERIC, 220),
    ('initiative', 'Individual daily reporting minimal tiga pekerjaan', 'Laporkan minimal tiga aktivitas atau progres kerja setiap hari.', 'daily', 'team', '*', 10::NUMERIC, 230)
) AS seed(item_type, title, description, cadence, scope_type, scope_value, weight, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.app_performance_items existing
  WHERE existing.workspace_id = 'bilik-strategi'
    AND existing.item_type = seed.item_type
    AND existing.title = seed.title
    AND existing.scope_type = seed.scope_type
    AND existing.scope_value = seed.scope_value
);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_performance_profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_performance_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_performance_updates;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_performance_reviews;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
