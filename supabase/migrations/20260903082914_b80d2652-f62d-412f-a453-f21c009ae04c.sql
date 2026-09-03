UPDATE public.country_settings
SET referral_bonus_bdt = 150,
    referral_bonus_active = true,
    signup_allowed = true,
    updated_at = now()
WHERE code <> 'BD';

UPDATE public.country_settings
SET referral_bonus_active = false,
    referral_bonus_bdt = 0,
    updated_at = now()
WHERE code = 'BD';