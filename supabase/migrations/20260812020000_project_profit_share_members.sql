-- Per-project allocation mode and member percentage overrides.

ALTER TABLE public.app_project_profit_share_settings
  ADD COLUMN IF NOT EXISTS allocation_mode TEXT NOT NULL DEFAULT 'automatic';

ALTER TABLE public.app_project_profit_share_settings
  DROP CONSTRAINT IF EXISTS app_project_profit_share_settings_allocation_mode_check;

ALTER TABLE public.app_project_profit_share_settings
  ADD CONSTRAINT app_project_profit_share_settings_allocation_mode_check
  CHECK (allocation_mode IN ('automatic', 'manual'));

ALTER TABLE public.app_project_profit_share_settings
  ADD COLUMN IF NOT EXISTS member_share_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.app_project_profit_share_settings
  DROP CONSTRAINT IF EXISTS app_project_profit_share_settings_member_share_overrides_check;

ALTER TABLE public.app_project_profit_share_settings
  ADD CONSTRAINT app_project_profit_share_settings_member_share_overrides_check
  CHECK (jsonb_typeof(member_share_overrides) = 'object');

NOTIFY pgrst, 'reload schema';
