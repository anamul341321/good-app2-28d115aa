
ALTER TYPE public.wallet_provider ADD VALUE IF NOT EXISTS 'usdt';

ALTER TABLE public.bonus_settings
  ADD COLUMN IF NOT EXISTS usdt_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS usdt_off_message text,
  ADD COLUMN IF NOT EXISTS usdt_rate_bdt numeric NOT NULL DEFAULT 125;
