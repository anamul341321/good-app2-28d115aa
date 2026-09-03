create table if not exists public.country_settings (
  code text primary key,
  name_en text not null,
  name_local text not null,
  flag text not null default '🌐',
  monthly_mining_bdt numeric not null default 400,
  referral_bonus_bdt numeric not null default 0,
  referral_bonus_active boolean not null default false,
  signup_allowed boolean not null default true,
  tier text not null default 'standard',
  updated_at timestamptz not null default now()
);

grant select on public.country_settings to anon;
grant select on public.country_settings to authenticated;
grant all on public.country_settings to service_role;

alter table public.country_settings enable row level security;

drop policy if exists "Country settings are public" on public.country_settings;
create policy "Country settings are public"
  on public.country_settings for select
  to anon, authenticated
  using (true);

insert into public.country_settings (code, name_en, name_local, flag, monthly_mining_bdt, referral_bonus_bdt, referral_bonus_active, tier) values
  ('BD','Bangladesh','বাংলাদেশ','🇧🇩',500,0,false,'home'),
  ('US','United States','United States','🇺🇸',600,150,true,'premium'),
  ('CA','Canada','Canada','🇨🇦',600,150,true,'premium'),
  ('GB','United Kingdom','United Kingdom','🇬🇧',600,150,true,'premium'),
  ('AU','Australia','Australia','🇦🇺',600,150,true,'premium'),
  ('NZ','New Zealand','New Zealand','🇳🇿',600,150,true,'premium'),
  ('IE','Ireland','Ireland','🇮🇪',600,150,true,'premium'),
  ('DE','Germany','Deutschland','🇩🇪',600,150,true,'premium'),
  ('FR','France','France','🇫🇷',600,150,true,'premium'),
  ('IT','Italy','Italia','🇮🇹',600,150,true,'premium'),
  ('ES','Spain','España','🇪🇸',600,150,true,'premium'),
  ('NL','Netherlands','Nederland','🇳🇱',600,150,true,'premium'),
  ('BE','Belgium','Belgique','🇧🇪',600,150,true,'premium'),
  ('SE','Sweden','Sverige','🇸🇪',600,150,true,'premium'),
  ('NO','Norway','Norge','🇳🇴',600,150,true,'premium'),
  ('DK','Denmark','Danmark','🇩🇰',600,150,true,'premium'),
  ('FI','Finland','Suomi','🇫🇮',600,150,true,'premium'),
  ('CH','Switzerland','Schweiz','🇨🇭',600,150,true,'premium'),
  ('AT','Austria','Österreich','🇦🇹',600,150,true,'premium'),
  ('JP','Japan','日本','🇯🇵',600,150,true,'premium'),
  ('KR','South Korea','대한민국','🇰🇷',600,150,true,'premium'),
  ('SG','Singapore','Singapore','🇸🇬',600,150,true,'premium'),
  ('HK','Hong Kong','香港','🇭🇰',600,150,true,'premium'),
  ('AE','United Arab Emirates','الإمارات','🇦🇪',600,150,true,'premium'),
  ('SA','Saudi Arabia','السعودية','🇸🇦',600,150,true,'premium'),
  ('QA','Qatar','قطر','🇶🇦',600,150,true,'premium'),
  ('KW','Kuwait','الكويت','🇰🇼',600,150,true,'premium'),
  ('IN','India','भारत','🇮🇳',400,0,false,'standard'),
  ('PK','Pakistan','پاکستان','🇵🇰',400,0,false,'standard'),
  ('NP','Nepal','नेपाल','🇳🇵',400,0,false,'standard'),
  ('LK','Sri Lanka','Sri Lanka','🇱🇰',400,0,false,'standard'),
  ('MY','Malaysia','Malaysia','🇲🇾',400,0,false,'standard'),
  ('ID','Indonesia','Indonesia','🇮🇩',400,0,false,'standard'),
  ('PH','Philippines','Philippines','🇵🇭',400,0,false,'standard'),
  ('VN','Vietnam','Việt Nam','🇻🇳',400,0,false,'standard'),
  ('TH','Thailand','ไทย','🇹🇭',400,0,false,'standard'),
  ('EG','Egypt','مصر','🇪🇬',400,0,false,'standard'),
  ('NG','Nigeria','Nigeria','🇳🇬',400,0,false,'standard'),
  ('KE','Kenya','Kenya','🇰🇪',400,0,false,'standard'),
  ('ZA','South Africa','South Africa','🇿🇦',400,0,false,'standard'),
  ('BR','Brazil','Brasil','🇧🇷',400,0,false,'standard'),
  ('MX','Mexico','México','🇲🇽',400,0,false,'standard'),
  ('TR','Turkey','Türkiye','🇹🇷',400,0,false,'standard'),
  ('OTHER','Other country','Other country','🌐',400,0,false,'standard')
on conflict (code) do nothing;

alter table public.profiles
  add column if not exists signup_ip text,
  add column if not exists signup_ip_country text,
  add column if not exists signup_timezone text,
  add column if not exists geo_verified boolean not null default false,
  add column if not exists vpn_flagged boolean not null default false,
  add column if not exists foreign_referral_bonus_paid boolean not null default false;

create or replace function public.enforce_profile_safe_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  IF auth.role() = 'service_role'
     OR current_user IN ('postgres','supabase_admin','supabase_read_only_user')
     OR current_user LIKE 'service_role%'
  THEN RETURN NEW; END IF;
  IF OLD.id <> auth.uid() THEN RAISE EXCEPTION 'You can only update your own profile'; END IF;
  IF NEW.banned = true
     AND NEW.banned_reason = 'অস্বাভাবিক duplicate bonus credit — হিসাব ও payment তদন্তের জন্য account সাময়িকভাবে block'
     AND OLD.kyc_verified IS NOT DISTINCT FROM NEW.kyc_verified
     AND OLD.kyc_verified_at IS NOT DISTINCT FROM NEW.kyc_verified_at
     AND OLD.referral_unlock_override IS NOT DISTINCT FROM NEW.referral_unlock_override
     AND OLD.bonus_first_verify_claimed IS NOT DISTINCT FROM NEW.bonus_first_verify_claimed
     AND OLD.bonus_reverify_claimed IS NOT DISTINCT FROM NEW.bonus_reverify_claimed
     AND OLD.bonus_first_verify_self_claimed IS NOT DISTINCT FROM NEW.bonus_first_verify_self_claimed
     AND OLD.balance_frozen IS NOT DISTINCT FROM NEW.balance_frozen
  THEN RETURN NEW; END IF;
  IF OLD.kyc_verified IS DISTINCT FROM NEW.kyc_verified OR OLD.kyc_verified_at IS DISTINCT FROM NEW.kyc_verified_at
     OR OLD.banned IS DISTINCT FROM NEW.banned OR OLD.banned_reason IS DISTINCT FROM NEW.banned_reason OR OLD.banned_at IS DISTINCT FROM NEW.banned_at
     OR OLD.referral_unlock_override IS DISTINCT FROM NEW.referral_unlock_override
     OR OLD.bonus_first_verify_claimed IS DISTINCT FROM NEW.bonus_first_verify_claimed
     OR OLD.bonus_reverify_claimed IS DISTINCT FROM NEW.bonus_reverify_claimed
     OR OLD.bonus_first_verify_self_claimed IS DISTINCT FROM NEW.bonus_first_verify_self_claimed
     OR OLD.balance_frozen IS DISTINCT FROM NEW.balance_frozen
     OR OLD.balance_frozen_at IS DISTINCT FROM NEW.balance_frozen_at
     OR OLD.balance_frozen_reason IS DISTINCT FROM NEW.balance_frozen_reason
     OR OLD.country IS DISTINCT FROM NEW.country
     OR OLD.signup_ip IS DISTINCT FROM NEW.signup_ip
     OR OLD.signup_ip_country IS DISTINCT FROM NEW.signup_ip_country
     OR OLD.geo_verified IS DISTINCT FROM NEW.geo_verified
     OR OLD.vpn_flagged IS DISTINCT FROM NEW.vpn_flagged
     OR OLD.foreign_referral_bonus_paid IS DISTINCT FROM NEW.foreign_referral_bonus_paid
  THEN RAISE EXCEPTION 'You are not allowed to modify admin-controlled profile fields'; END IF;
  RETURN NEW;
END;
$function$;

create or replace function public.settle_mining(_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  m record;
  valid_count int;
  new_self_slots int;
  new_ref_units numeric;
  qual_ref int;
  elapsed_sec numeric;
  monthly_total numeric := 500.0;
  rate_per_slot_sec numeric;
  prev_self_rate numeric;
  prev_ref_rate numeric;
  self_delta numeric := 0;
  ref_delta numeric := 0;
  parent_id uuid;
  auto_qualified boolean;
  new_active boolean;
  fv_mode boolean;
  status_filter public.task_status[];
  split_count int;
BEGIN
  SELECT coalesce(first_verify_mining_mode, false) INTO fv_mode
    FROM public.bonus_settings WHERE id = 'default';

  IF fv_mode THEN
    status_filter := ARRAY['done','verified']::public.task_status[];
  ELSE
    status_filter := ARRAY['done']::public.task_status[];
  END IF;

  SELECT coalesce(cs.monthly_mining_bdt, 500.0) INTO monthly_total
    FROM public.profiles p
    LEFT JOIN public.country_settings cs ON cs.code = upper(coalesce(p.country, 'BD'))
   WHERE p.id = _user_id;
  monthly_total := coalesce(monthly_total, 500.0);
  rate_per_slot_sec := monthly_total / (30.0 * 24.0 * 3600.0) / 10.0;

  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO valid_count
    FROM public.tasks
   WHERE user_id = _user_id
     AND status = ANY(status_filter)
     AND coalesce(whitelist_ok, true) = true
     AND wallet_address IS NOT NULL;

  SELECT count(DISTINCT slot)::integer INTO new_self_slots
    FROM public.tasks
   WHERE user_id = _user_id
     AND coalesce(whitelist_ok, true) = true
     AND wallet_address IS NOT NULL
     AND (coalesce(reverify_count, 0) > 0
          OR (fv_mode AND status = ANY(status_filter)));

  auto_qualified := coalesce(new_self_slots, 0) > 0;

  SELECT coalesce(count(*), 0)::int,
         coalesce(sum(greatest(ms.self_slots, 0)) * 0.1, 0)
    INTO qual_ref, new_ref_units
    FROM public.profiles p
    JOIN public.mining_state ms ON ms.user_id = p.id
   WHERE p.referred_by = _user_id
     AND coalesce(ms.self_slots, 0) > 0;

  new_active := coalesce(m.admin_forced_active, false)
                OR coalesce(new_self_slots, 0) > 0
                OR coalesce(new_ref_units, 0) > 0;

  IF m.is_active AND m.last_credited_at IS NOT NULL THEN
    elapsed_sec := greatest(EXTRACT(EPOCH FROM (now() - m.last_credited_at)), 0);
    IF coalesce(m.self_qualified, false) OR coalesce(m.admin_forced_active, false) THEN
      prev_self_rate := rate_per_slot_sec * coalesce(m.self_slots, 0)::numeric;
    ELSE
      prev_self_rate := 0;
    END IF;
    prev_ref_rate := rate_per_slot_sec * coalesce(m.referral_units, 0);
    self_delta := elapsed_sec * prev_self_rate;
    ref_delta := elapsed_sec * prev_ref_rate;
  END IF;

  PERFORM set_config('app.balance_change_source', 'mining_settlement', true);

  UPDATE public.mining_state
     SET accrued_amount = coalesce(accrued_amount, 0) + self_delta + ref_delta,
         self_mining_accrued = coalesce(self_mining_accrued, 0) + self_delta,
         referral_accrued = coalesce(referral_accrued, 0) + ref_delta,
         mining_unlocked = coalesce(mining_unlocked, 0) + ref_delta,
         last_credited_at = CASE WHEN new_active THEN now() ELSE last_credited_at END,
         effective_task_count = valid_count,
         self_slots = coalesce(new_self_slots, 0),
         referral_units = coalesce(new_ref_units, 0),
         qualifying_referees = coalesce(qual_ref, 0),
         self_qualified = auto_qualified,
         is_active = new_active,
         activated_at = CASE WHEN activated_at IS NULL AND new_active THEN now() ELSE activated_at END
   WHERE user_id = _user_id;

  IF self_delta > 0 THEN
    SELECT count(*) INTO split_count
      FROM public.tasks
     WHERE user_id = _user_id
       AND coalesce(whitelist_ok, true) = true
       AND wallet_address IS NOT NULL
       AND (coalesce(reverify_count, 0) > 0
            OR (fv_mode AND status = ANY(status_filter)));

    IF coalesce(split_count, 0) > 0 THEN
      UPDATE public.tasks
         SET locked_mined = coalesce(locked_mined, 0) + (self_delta / split_count)
       WHERE user_id = _user_id
         AND coalesce(whitelist_ok, true) = true
         AND wallet_address IS NOT NULL
         AND (coalesce(reverify_count, 0) > 0
              OR (fv_mode AND status = ANY(status_filter)));
    END IF;
  END IF;

  IF self_delta > 0 THEN
    INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
    VALUES (_user_id, self_delta, 'mining', jsonb_build_object('slots', new_self_slots, 'sec', elapsed_sec, 'monthly', monthly_total));
  END IF;
  IF ref_delta > 0 THEN
    INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
    VALUES (_user_id, ref_delta, 'referral', jsonb_build_object('units', new_ref_units, 'sec', elapsed_sec));
  END IF;

  SELECT referred_by INTO parent_id FROM public.profiles WHERE id = _user_id;
  IF parent_id IS NOT NULL AND parent_id <> _user_id THEN
    PERFORM public.settle_mining(parent_id);
  END IF;
END;
$function$;