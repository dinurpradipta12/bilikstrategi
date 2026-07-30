-- =============================================================
-- BILIK STRATEGI WORKSPACE - FULL SUPABASE SETUP SCRIPT
-- Copy dan Paste seluruh isi skrip ini ke SQL Editor di Supabase Console:
-- https://supabase.com/dashboard/project/spnawjvexcwhhyfavvew/sql/new
-- =============================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABEL PROFILES (Pengguna & Hak Akses)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'team_lead', 'member', 'client')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    capacity_hours INT NOT NULL DEFAULT 40,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABEL CLICKUP CONNECTIONS (Koneksi & Token Terenkripsi)
CREATE TABLE IF NOT EXISTS public.clickup_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id TEXT NOT NULL UNIQUE,
    workspace_name TEXT NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    connection_type TEXT NOT NULL DEFAULT 'personal_token' CHECK (connection_type IN ('personal_token', 'oauth')),
    connected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disconnected'))
);

-- 3. TABEL CLIENTS (Katalog Klien Agency)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    industry TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'lead', 'archived')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    account_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    logo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABEL PROJECTS (Project Management Agency)
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
    clickup_space_id TEXT,
    clickup_folder_id TEXT,
    clickup_list_id TEXT,
    team_lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    start_date DATE,
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABEL PROJECT MEMBERS (Anggota Tim Project)
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_role TEXT NOT NULL DEFAULT 'contributor',
    UNIQUE(project_id, user_id)
);

-- 6. TABEL TASK CACHE (Cache Lokasi Fast Dashboard ClickUp)
CREATE TABLE IF NOT EXISTS public.task_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clickup_task_id TEXT NOT NULL UNIQUE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'to_do',
    priority TEXT DEFAULT 'normal',
    assignee_ids JSONB DEFAULT '[]'::jsonb,
    start_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    clickup_updated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_data JSONB DEFAULT '{}'::jsonb
);

-- 7. TABEL NOTIFICATIONS (Pemberitahuan Aktivitas)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABEL ACTIVITY LOGS (Audit Trail System)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    source TEXT NOT NULL DEFAULT 'web_app',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TABEL WEBHOOK EVENTS (Log Event Webhook ClickUp)
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clickup_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'ignored')),
    error_message TEXT
);

-- 10. TABEL SYNC LOGS (Log Riwayat Sync API)
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('pending', 'success', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT
);

-- 11. TABEL APP SETTINGS (Pengaturan Konfigurasi)
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES UNTUK PERFORMA QUERY
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_task_cache_clickup_id ON public.task_cache(clickup_task_id);
CREATE INDEX IF NOT EXISTS idx_task_cache_project_id ON public.task_cache(project_id);
CREATE INDEX IF NOT EXISTS idx_task_cache_due_date ON public.task_cache(due_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- AKTIFKAN ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clickup_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Allow public read projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Allow public read task_cache" ON public.task_cache FOR SELECT USING (true);
CREATE POLICY "Allow public read notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Allow public read activity logs" ON public.activity_logs FOR SELECT USING (true);

-- SEED DATA AWAL UNTUK CLIENT & PROJECT AGENCY
INSERT INTO public.clients (id, name, company_name, email, phone, industry, status, start_date, notes)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Budi Santoso', 'Nusantara Retail Group', 'budi@nusantararetail.co.id', '+6281234567890', 'Retail & E-commerce', 'active', '2026-01-15', 'Klien retainer tahunan untuk kampanye digital.'),
  ('22222222-2222-2222-2222-222222222222', 'Dewi Lestari', 'Kopi Senja Indonesia', 'dewi@kopisenja.id', '+6281898765432', 'Food & Beverage', 'active', '2026-02-01', 'Fokus pada branding Instagram & TikTok.'),
  ('33333333-3333-3333-3333-333333333333', 'Rian Ardianto', 'TechVision Global', 'rian@techvision.io', '+6281711223344', 'Technology & SaaS', 'active', '2026-03-10', 'Peluncuran produk SaaS B2B.'),
  ('44444444-4444-4444-4444-444444444444', 'Maya Putri', 'GlowSkin Cosmetic', 'maya@glowskin.co.id', '+6281355667788', 'Beauty & Lifestyle', 'active', '2026-04-05', 'Influencer marketing & video reels.'),
  ('55555555-5555-5555-5555-555555555555', 'Hendra Gunawan', 'Finansial Kuat', 'hendra@finansialkuat.com', '+6281900112233', 'Finance & FinTech', 'lead', '2026-06-20', 'Prospek rebranding institusi keuangan.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.projects (id, client_id, name, description, status, clickup_space_id, clickup_folder_id, clickup_list_id, start_date, due_date)
VALUES 
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Nusantara Grand Campaign 2026', 'Kampanye nasional peluncuran outlet baru & diskon akbar.', 'in_progress', 'sp_9001', 'fold_101', 'list_1001', '2026-06-01', '2026-08-31'),
  ('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Kopi Senja Social Media Retainer', 'Pengelolaan konten harian IG, TikTok, dan YouTube Shorts.', 'in_progress', 'sp_9001', 'fold_102', 'list_1002', '2026-01-01', '2026-12-31'),
  ('a3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'TechVision Product Launch', 'Desain UI/UX landing page & kampanye Google Ads.', 'in_progress', 'sp_9002', 'fold_103', 'list_1003', '2026-05-15', '2026-09-15'),
  ('a4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'GlowSkin Viral TikTok Campaign', 'Kerjasama 20 mikro-influencer & kompetisi TikTok.', 'planning', 'sp_9002', 'fold_104', 'list_1004', '2026-07-01', '2026-10-31')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES 
  ('clickup_sync_interval', '"15m"'::jsonb),
  ('agency_name', '"Bilik Strategi Workspace"'::jsonb),
  ('default_capacity_hours', '40'::jsonb)
ON CONFLICT (key) DO NOTHING;
