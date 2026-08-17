ALTER TABLE public.bonus_settings
  ADD COLUMN IF NOT EXISTS min_app_version text,
  ADD COLUMN IF NOT EXISTS force_update_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS force_update_web boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_update_message text;

UPDATE public.bonus_settings SET min_app_version = COALESCE(min_app_version, '1.22') WHERE id = 'default';