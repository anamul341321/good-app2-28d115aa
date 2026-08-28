ALTER TABLE public.bonus_settings
  ADD COLUMN IF NOT EXISTS ads_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ads_banner_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ads_rewarded_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ads_appopen_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ads_banner_unit text,
  ADD COLUMN IF NOT EXISTS ads_interstitial_unit text,
  ADD COLUMN IF NOT EXISTS ads_rewarded_unit text;