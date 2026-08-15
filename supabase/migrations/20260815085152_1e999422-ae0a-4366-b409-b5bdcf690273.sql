ALTER TABLE public.bonus_settings 
ADD COLUMN IF NOT EXISTS test_apk_url text,
ADD COLUMN IF NOT EXISTS test_apk_version text;

GRANT SELECT, UPDATE ON public.bonus_settings TO authenticated;
GRANT ALL ON public.bonus_settings TO service_role;
