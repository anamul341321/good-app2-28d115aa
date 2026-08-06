-- Lock down user-level UPDATE on profiles to only harmless onboarding columns
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;
GRANT UPDATE (onboarded_at, tg_link_skipped) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Users must never modify vouchers directly; claiming happens server-side
DROP POLICY IF EXISTS "own vouchers claim" ON public.bonus_vouchers;
REVOKE UPDATE ON public.bonus_vouchers FROM authenticated;
REVOKE UPDATE ON public.bonus_vouchers FROM anon;
GRANT ALL ON public.bonus_vouchers TO service_role;