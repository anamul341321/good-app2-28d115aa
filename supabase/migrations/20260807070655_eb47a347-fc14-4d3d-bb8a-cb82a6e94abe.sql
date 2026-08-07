CREATE OR REPLACE FUNCTION public.enforce_profile_safe_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_user = 'supabase_admin' OR current_user LIKE 'service_role%' THEN RETURN NEW; END IF;
  IF OLD.id <> auth.uid() THEN RAISE EXCEPTION 'You can only update your own profile'; END IF;
  IF NEW.banned = true
     AND NEW.banned_reason = 'অস্বাভাবিক duplicate bonus credit — হিসাব ও payment তদন্তের জন্য account সাময়িকভাবে block'
     AND OLD.kyc_verified IS NOT DISTINCT FROM NEW.kyc_verified
     AND OLD.kyc_verified_at IS NOT DISTINCT FROM NEW.kyc_verified_at
     AND OLD.referral_unlock_override IS NOT DISTINCT FROM NEW.referral_unlock_override
     AND OLD.bonus_first_verify_claimed IS NOT DISTINCT FROM NEW.bonus_first_verify_claimed
     AND OLD.bonus_reverify_claimed IS NOT DISTINCT FROM NEW.bonus_reverify_claimed
     AND OLD.bonus_first_verify_self_claimed IS NOT DISTINCT FROM NEW.bonus_first_verify_self_claimed
  THEN RETURN NEW; END IF;
  IF OLD.kyc_verified IS DISTINCT FROM NEW.kyc_verified OR OLD.kyc_verified_at IS DISTINCT FROM NEW.kyc_verified_at
     OR OLD.banned IS DISTINCT FROM NEW.banned OR OLD.banned_reason IS DISTINCT FROM NEW.banned_reason OR OLD.banned_at IS DISTINCT FROM NEW.banned_at
     OR OLD.referral_unlock_override IS DISTINCT FROM NEW.referral_unlock_override
     OR OLD.bonus_first_verify_claimed IS DISTINCT FROM NEW.bonus_first_verify_claimed
     OR OLD.bonus_reverify_claimed IS DISTINCT FROM NEW.bonus_reverify_claimed
     OR OLD.bonus_first_verify_self_claimed IS DISTINCT FROM NEW.bonus_first_verify_self_claimed
  THEN RAISE EXCEPTION 'You are not allowed to modify admin-controlled profile fields'; END IF;
  RETURN NEW;
END;
$$;