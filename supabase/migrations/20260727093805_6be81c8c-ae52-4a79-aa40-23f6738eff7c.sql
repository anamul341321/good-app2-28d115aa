ALTER TABLE public.bonus_settings ALTER COLUMN usdt_rate_bdt SET DEFAULT 130;

UPDATE public.bonus_settings
SET usdt_rate_bdt = 130
WHERE id = 'default';

GRANT SELECT, UPDATE ON public.bonus_settings TO authenticated;
GRANT ALL ON public.bonus_settings TO service_role;