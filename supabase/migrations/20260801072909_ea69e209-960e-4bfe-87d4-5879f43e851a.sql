UPDATE public.profiles
SET kyc_verified = true,
    kyc_verified_at = COALESCE(kyc_verified_at, now())
WHERE telegram_user_id IS NOT NULL AND kyc_verified IS NOT TRUE;