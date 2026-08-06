-- Close privilege escalation findings by removing authenticated UPDATE paths entirely.
-- All updates now go through service-role server functions.

-- ========== profiles ==========
REVOKE UPDATE ON public.profiles FROM authenticated;
DROP POLICY IF EXISTS "Own profile update" ON public.profiles;
DROP POLICY IF EXISTS "Own profile update safe columns" ON public.profiles;

-- Keep SELECT/INSERT/DELETE as before
GRANT SELECT, INSERT, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- ========== user_devices ==========
REVOKE UPDATE ON public.user_devices FROM authenticated;
DROP POLICY IF EXISTS "Users manage their own devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users update own device label" ON public.user_devices;

-- Keep SELECT/INSERT/DELETE as before
GRANT SELECT, INSERT, DELETE ON public.user_devices TO authenticated;
GRANT ALL ON public.user_devices TO service_role;

-- ========== slot_reset_requests ==========
REVOKE UPDATE ON public.slot_reset_requests FROM authenticated;
DROP POLICY IF EXISTS "Users can respond to their own reset requests" ON public.slot_reset_requests;
DROP POLICY IF EXISTS "Users update own reset requests" ON public.slot_reset_requests;
DROP POLICY IF EXISTS "Users update own slot reset requests" ON public.slot_reset_requests;

-- Keep SELECT/INSERT/DELETE as before
GRANT SELECT, INSERT, DELETE ON public.slot_reset_requests TO authenticated;
GRANT ALL ON public.slot_reset_requests TO service_role;
