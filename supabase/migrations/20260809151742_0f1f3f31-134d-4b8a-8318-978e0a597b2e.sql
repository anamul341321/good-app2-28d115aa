ALTER TABLE public.bonus_settings
  ADD COLUMN IF NOT EXISTS face_verify_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS face_verify_off_message text,
  ADD COLUMN IF NOT EXISTS signup_off_message text;