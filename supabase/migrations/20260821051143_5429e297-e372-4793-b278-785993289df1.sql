ALTER TABLE public.bonus_settings
  ADD COLUMN IF NOT EXISTS first_verify_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS first_verify_off_message text;