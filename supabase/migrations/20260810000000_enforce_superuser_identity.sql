-- The standalone template provisions its first Owner through the setup flow.
-- Keep the page access column expected by all modules without seeding a person.
ALTER TABLE IF EXISTS public.app_user_roles
  ADD COLUMN IF NOT EXISTS page_access JSONB NOT NULL DEFAULT '{}'::jsonb;
