ALTER TABLE public.bonus_settings ADD COLUMN IF NOT EXISTS withdraw_off_until timestamptz;
UPDATE public.bonus_settings SET withdraw_enabled = true, withdraw_off_until = NULL WHERE id = 'default';