-- Fix privilege escalation findings:
-- 1. profiles: users could update kyc_verified, banned, bonus flags, etc.
-- 2. slot_reset_requests: users could update status to approved themselves.
-- 3. user_devices: users could update approval_state to approved themselves.

-- ============================================================
-- 1. profiles: restrict authenticated UPDATE to safe columns
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_profile_safe_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'supabase_admin' OR current_user LIKE 'service_role%' THEN
    RETURN NEW;
  END IF;

  IF OLD.id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only update your own profile';
  END IF;

  IF OLD.kyc_verified IS DISTINCT FROM NEW.kyc_verified
     OR OLD.kyc_verified_at IS DISTINCT FROM NEW.kyc_verified_at
     OR OLD.banned IS DISTINCT FROM NEW.banned
     OR OLD.banned_reason IS DISTINCT FROM NEW.banned_reason
     OR OLD.banned_until IS DISTINCT FROM NEW.banned_until
     OR OLD.referral_unlock_override IS DISTINCT FROM NEW.referral_unlock_override
     OR OLD.bonus_first_verify_claimed IS DISTINCT FROM NEW.bonus_first_verify_claimed
     OR OLD.bonus_reverify_claimed IS DISTINCT FROM NEW.bonus_reverify_claimed
     OR OLD.bonus_first_verify_self_claimed IS DISTINCT FROM NEW.bonus_first_verify_self_claimed
     OR OLD.role IS DISTINCT FROM NEW.role
     OR OLD.is_admin IS DISTINCT FROM NEW.is_admin
  THEN
    RAISE EXCEPTION 'You are not allowed to modify admin-controlled profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_safe_update_trigger ON public.profiles;
CREATE TRIGGER profiles_safe_update_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_safe_update();

GRANT EXECUTE ON FUNCTION public.enforce_profile_safe_update() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_profile_safe_update() TO service_role;

-- ============================================================
-- 2. slot_reset_requests: users can only update message/attachment, not status
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_slot_reset_request_safe_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'supabase_admin' OR current_user LIKE 'service_role%' THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only update your own slot reset request';
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status
     OR OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by
     OR OLD.resolved_at IS DISTINCT FROM NEW.resolved_at
     OR OLD.admin_note IS DISTINCT FROM NEW.admin_note
     OR OLD.decision_reason IS DISTINCT FROM NEW.decision_reason
  THEN
    RAISE EXCEPTION 'You are not allowed to change the status or admin fields of a slot reset request';
  END IF;

  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'You can only edit a pending slot reset request';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS slot_reset_request_safe_update_trigger ON public.slot_reset_requests;
CREATE TRIGGER slot_reset_request_safe_update_trigger
  BEFORE UPDATE ON public.slot_reset_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_slot_reset_request_safe_update();

GRANT EXECUTE ON FUNCTION public.enforce_slot_reset_request_safe_update() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_slot_reset_request_safe_update() TO service_role;

-- ============================================================
-- 3. user_devices: users can only update label, not approval_state
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_user_device_safe_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'supabase_admin' OR current_user LIKE 'service_role%' THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only update your own device';
  END IF;

  IF OLD.approval_state IS DISTINCT FROM NEW.approval_state
     OR OLD.trusted IS DISTINCT FROM NEW.trusted
     OR OLD.banned IS DISTINCT FROM NEW.banned
     OR OLD.is_primary IS DISTINCT FROM NEW.is_primary
     OR OLD.device_id IS DISTINCT FROM NEW.device_id
     OR OLD.user_id IS DISTINCT FROM NEW.user_id
     OR OLD.last_login_at IS DISTINCT FROM NEW.last_login_at
  THEN
    RAISE EXCEPTION 'You are not allowed to change the approval or security fields of a device';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_device_safe_update_trigger ON public.user_devices;
CREATE TRIGGER user_device_safe_update_trigger
  BEFORE UPDATE ON public.user_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_device_safe_update();

GRANT EXECUTE ON FUNCTION public.enforce_user_device_safe_update() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_user_device_safe_update() TO service_role;
