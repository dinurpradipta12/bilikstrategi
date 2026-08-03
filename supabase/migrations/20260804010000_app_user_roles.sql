CREATE TABLE IF NOT EXISTS public.app_user_roles (
  email TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'client')),
  is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_user_roles_status
  ON public.app_user_roles (status, role);

ALTER TABLE public.app_user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read app_user_roles" ON public.app_user_roles;
CREATE POLICY "Allow public read app_user_roles"
  ON public.app_user_roles
  FOR SELECT
  USING (true);

INSERT INTO public.app_user_roles (email, display_name, role, is_superuser, status)
VALUES ('snllabsarchive@gmail.com', 'Dinur Pradipta', 'owner', TRUE, 'active')
ON CONFLICT (email) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  role = 'owner',
  is_superuser = TRUE,
  status = 'active',
  updated_at = NOW();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_user_roles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
