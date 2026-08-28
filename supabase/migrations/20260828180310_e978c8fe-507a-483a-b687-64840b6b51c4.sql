ALTER TABLE public.bonus_settings
  ADD COLUMN IF NOT EXISTS ads_test_mode boolean DEFAULT false;