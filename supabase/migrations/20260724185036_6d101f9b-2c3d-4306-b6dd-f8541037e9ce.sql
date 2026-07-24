ALTER TABLE public.bonus_settings ADD COLUMN IF NOT EXISTS recharge_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.bonus_settings ADD COLUMN IF NOT EXISTS recharge_off_message TEXT;