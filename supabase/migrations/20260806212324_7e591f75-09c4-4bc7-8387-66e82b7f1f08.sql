-- Fix privilege escalation in profiles and user_devices tables.
-- Server functions use service_role, so this only affects direct client access.

-- ========== profiles ==========
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  display_name,
  phone_number,
  avatar_url,
  nid_number,
  date_of_birth,
  father_name,
  mother_name,
  village_area,
  post_office,
  thana_upazila,
  district,
  full_address
) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Own profile update" ON public.profiles;
CREATE POLICY "Own profile update safe columns"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ========== user_devices ==========
REVOKE UPDATE ON public.user_devices FROM authenticated;
GRANT UPDATE (
  label,
  user_agent
) ON public.user_devices TO authenticated;

DROP POLICY IF EXISTS "Users manage their own devices" ON public.user_devices;

CREATE POLICY "Users view own devices"
  ON public.user_devices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own devices"
  ON public.user_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own device label"
  ON public.user_devices
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
