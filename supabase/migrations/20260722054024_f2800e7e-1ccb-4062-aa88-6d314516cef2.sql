
ALTER TABLE public.bonus_settings
  ADD COLUMN IF NOT EXISTS promo_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_title text,
  ADD COLUMN IF NOT EXISTS promo_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_first_verify_bonus integer,
  ADD COLUMN IF NOT EXISTS promo_reverify_bonus integer,
  ADD COLUMN IF NOT EXISTS promo_referrer_bonus integer,
  ADD COLUMN IF NOT EXISTS bkash_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nagad_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bkash_off_message text,
  ADD COLUMN IF NOT EXISTS nagad_off_message text;

UPDATE public.bonus_settings
SET promo_active = true,
    promo_title = '🎊 ৫০,০০০+ User পূর্তি 2X বোনাস অফার!',
    promo_start_at = '2026-07-22T00:00:00+06:00',
    promo_end_at   = '2026-08-11T23:59:59+06:00',
    promo_first_verify_bonus = 100,
    promo_reverify_bonus     = 400,
    promo_referrer_bonus     = 150,
    updated_at = now()
WHERE id = 'default';

CREATE SEQUENCE IF NOT EXISTS public.profile_uid_seq;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS uid_seq bigint;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.profiles
)
UPDATE public.profiles p
SET uid_seq = o.rn
FROM ordered o
WHERE p.id = o.id AND p.uid_seq IS NULL;

SELECT setval('public.profile_uid_seq', COALESCE((SELECT MAX(uid_seq) FROM public.profiles), 0) + 1, false);

ALTER TABLE public.profiles
  ALTER COLUMN uid_seq SET DEFAULT nextval('public.profile_uid_seq');

CREATE UNIQUE INDEX IF NOT EXISTS profiles_uid_seq_uidx ON public.profiles(uid_seq);

ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_pkey;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_pkey PRIMARY KEY (user_id, provider);

DROP POLICY IF EXISTS "Own wallet insert once" ON public.wallets;
DROP POLICY IF EXISTS "Own wallet insert" ON public.wallets;
CREATE POLICY "Own wallet insert" ON public.wallets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Own wallet update" ON public.wallets;
CREATE POLICY "Own wallet update" ON public.wallets
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update handle_new_user to also assign uid_seq (in case it's not defaulted for some path)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  i int;
  display_name text;
  phone_number text;
  ref_code_in text;
  ref_user_id uuid;
  new_code text;
BEGIN
  display_name := coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name');
  phone_number := coalesce(new.raw_user_meta_data ->> 'phone_number', new.phone);
  ref_code_in  := upper(coalesce(new.raw_user_meta_data ->> 'referral_code', ''));

  IF ref_code_in <> '' THEN
    SELECT id INTO ref_user_id FROM public.profiles WHERE referral_code = ref_code_in LIMIT 1;
  END IF;

  LOOP
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = new_code);
  END LOOP;

  INSERT INTO public.profiles (id, display_name, email, phone_number, referral_code, referred_by)
  VALUES (new.id, display_name, new.email, phone_number, new_code, ref_user_id)
  ON CONFLICT (id) DO UPDATE SET
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    phone_number = coalesce(public.profiles.phone_number, excluded.phone_number);

  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user') ON CONFLICT DO NOTHING;
  INSERT INTO public.mining_state (user_id) VALUES (new.id) ON CONFLICT DO NOTHING;
  FOR i IN 1..10 LOOP
    INSERT INTO public.tasks (user_id, slot) VALUES (new.id, i) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN new;
END;
$function$;
