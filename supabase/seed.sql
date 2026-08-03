-- No demo clients or projects are seeded.
-- Keep only baseline application settings.

INSERT INTO public.app_settings (key, value)
VALUES
  ('clickup_sync_interval', '"15m"'::jsonb),
  ('agency_name', '"Bilik Strategi Workspace"'::jsonb),
  ('default_capacity_hours', '40'::jsonb)
ON CONFLICT (key) DO NOTHING;
