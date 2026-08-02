-- SEED DATA FOR BILIK STRATEGI WORKSPACE

-- Sample Clients
INSERT INTO public.clients (id, name, company_name, email, phone, industry, status, start_date, notes)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Budi Santoso', 'Nusantara Retail Group', 'budi@nusantararetail.co.id', '+6281234567890', 'Retail & E-commerce', 'active', '2026-01-15', 'Klien retainer tahunan untuk kampanye digital.'),
  ('22222222-2222-2222-2222-222222222222', 'Dewi Lestari', 'Kopi Senja Indonesia', 'dewi@kopisenja.id', '+6281898765432', 'Food & Beverage', 'active', '2026-02-01', 'Fokus pada branding Instagram & TikTok.'),
  ('33333333-3333-3333-3333-333333333333', 'Rian Ardianto', 'TechVision Global', 'rian@techvision.io', '+6281711223344', 'Technology & SaaS', 'active', '2026-03-10', 'Peluncuran produk SaaS B2B.'),
  ('44444444-4444-4444-4444-444444444444', 'Maya Putri', 'GlowSkin Cosmetic', 'maya@glowskin.co.id', '+6281355667788', 'Beauty & Lifestyle', 'active', '2026-04-05', 'Influencer marketing & video reels.'),
  ('55555555-5555-5555-5555-555555555555', 'Hendra Gunawan', 'Finansial Kuat', 'hendra@finansialkuat.com', '+6281900112233', 'Finance & FinTech', 'lead', '2026-06-20', 'Prospek rebranding institusi keuangan.')
ON CONFLICT (id) DO NOTHING;

-- Sample Projects
INSERT INTO public.projects (id, client_id, name, description, status, clickup_space_id, clickup_folder_id, clickup_list_id, start_date, due_date)
VALUES 
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Nusantara Grand Campaign 2026', 'Kampanye nasional peluncuran outlet baru & diskon akbar.', 'in_progress', 'sp_9001', 'fold_101', 'list_1001', '2026-06-01', '2026-08-31'),
  ('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Kopi Senja Social Media Retainer', 'Pengelolaan konten harian IG, TikTok, dan YouTube Shorts.', 'in_progress', 'sp_9001', 'fold_102', 'list_1002', '2026-01-01', '2026-12-31'),
  ('a3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'TechVision Product Launch', 'Desain UI/UX landing page & kampanye Google Ads.', 'in_progress', 'sp_9002', 'fold_103', 'list_1003', '2026-05-15', '2026-09-15'),
  ('a4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'GlowSkin Viral TikTok Campaign', 'Kerjasama 20 mikro-influencer & kompetisi TikTok.', 'planning', 'sp_9002', 'fold_104', 'list_1004', '2026-07-01', '2026-10-31')
ON CONFLICT (id) DO NOTHING;

-- Initial Settings
INSERT INTO public.app_settings (key, value)
VALUES 
  ('clickup_sync_interval', '"15m"'::jsonb),
  ('agency_name', '"Bilik Strategi Workspace"'::jsonb),
  ('default_capacity_hours', '40'::jsonb)
ON CONFLICT (key) DO NOTHING;
