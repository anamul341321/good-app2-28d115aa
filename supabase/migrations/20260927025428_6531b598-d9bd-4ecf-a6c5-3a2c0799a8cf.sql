ALTER TABLE public.mining_state
  ADD COLUMN IF NOT EXISTS last_daily_claim_day date,
  ADD COLUMN IF NOT EXISTS last_release_month date,
  ADD COLUMN IF NOT EXISTS pending_referral numeric NOT NULL DEFAULT 0;
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS pending_mined numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_carry numeric NOT NULL DEFAULT 0;

-- দিন = ঢাকা সন্ধ্যা ৬টা থেকে পরের সন্ধ্যা ৬টা
CREATE OR REPLACE FUNCTION public.mining_day_key(_now timestamptz DEFAULT now())
RETURNS date LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT ((_now AT TIME ZONE 'Asia/Dhaka') - interval '18 hours')::date $$;

CREATE OR REPLACE FUNCTION public.settle_mining(_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  valid_count int;
  new_self_slots int;
  new_ref_units numeric;
  qual_ref int;
  parent_id uuid;
  auto_qualified boolean;
  new_active boolean;
  fv_mode boolean;
  status_filter public.task_status[];
  v_today date;
  f_slot numeric := 0;
  f_ref numeric := 0;
  f_total numeric := 0;
  v_ref_claimed numeric := 0;
  v_month date;
  v_rel numeric := 0;
BEGIN
  SELECT coalesce(first_verify_mining_mode, false) INTO fv_mode FROM public.bonus_settings WHERE id = 'default';
  status_filter := CASE WHEN fv_mode THEN ARRAY['done','verified']::public.task_status[] ELSE ARRAY['done']::public.task_status[] END;

  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  v_today := public.mining_day_key(now());

  -- পুরনো (চলমান কাউন্টারের) ক্লেইম-না-করা মাইনিং দিন শেষে বাতিল
  IF m.mining_day IS NULL THEN
    UPDATE public.mining_state SET mining_day = v_today WHERE user_id = _user_id;
  ELSIF m.mining_day < v_today THEN
    SELECT coalesce(sum(greatest(locked_mined, 0)), 0) INTO f_slot FROM public.tasks WHERE user_id = _user_id;
    SELECT coalesce(sum(greatest(referral_amount, 0)), 0) INTO v_ref_claimed
      FROM public.mining_claims WHERE user_id = _user_id AND kind = 'mining'
       AND note = 'রেফারেল ১০% কমিশন → মেইন ব্যালেন্স ক্লেইম';
    f_ref := greatest(coalesce(m.referral_accrued, 0) - v_ref_claimed, 0);
    f_total := least(f_slot + f_ref, greatest(coalesce(m.accrued_amount, 0) - coalesce(m.withdrawn_amount, 0), 0));
    PERFORM set_config('app.balance_change_source', 'mining_daily_expire', true);
    UPDATE public.tasks SET locked_mined = 0 WHERE user_id = _user_id AND coalesce(locked_mined, 0) > 0;
    UPDATE public.mining_state
       SET accrued_amount = coalesce(accrued_amount, 0) - f_total,
           self_mining_accrued = greatest(coalesce(self_mining_accrued, 0) - f_slot, 0),
           referral_accrued = greatest(coalesce(referral_accrued, 0) - f_ref, 0),
           mining_unlocked = 0, mining_day = v_today
     WHERE user_id = _user_id;
    IF f_total > 0 THEN
      INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
      VALUES (_user_id, -f_total, 'mining_expired', jsonb_build_object('slot', f_slot, 'referral', f_ref, 'day', m.mining_day));
    END IF;
  END IF;

  -- মাসিক রিলিজ: ১ তারিখে whitelist থাকা ঘরের পেন্ডিং → মেইন
  v_month := date_trunc('month', (now() AT TIME ZONE 'Asia/Dhaka'))::date;
  IF m.last_release_month IS NULL THEN
    UPDATE public.mining_state SET last_release_month = v_month WHERE user_id = _user_id;
  ELSIF m.last_release_month < v_month THEN
    SELECT coalesce(sum(pending_mined + pending_carry), 0) INTO v_rel
      FROM public.tasks WHERE user_id = _user_id AND coalesce(whitelist_ok, false) = true;
    UPDATE public.tasks SET pending_mined = 0, pending_carry = 0
     WHERE user_id = _user_id AND coalesce(whitelist_ok, false) = true AND (pending_mined > 0 OR pending_carry > 0);
    UPDATE public.tasks SET pending_carry = pending_carry + pending_mined, pending_mined = 0
     WHERE user_id = _user_id AND coalesce(whitelist_ok, false) = false AND pending_mined > 0;
    v_rel := v_rel + greatest(coalesce(m.pending_referral, 0), 0);
    PERFORM set_config('app.balance_change_source', 'mining_monthly_release', true);
    UPDATE public.mining_state
       SET pending_mining = greatest(coalesce(pending_mining, 0) - v_rel, 0),
           pending_referral = 0, last_release_month = v_month
     WHERE user_id = _user_id;
    IF v_rel > 0 THEN
      INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
      VALUES (_user_id, 0, 'pending_to_main', jsonb_build_object('released', v_rel, 'month', v_month));
    END IF;
  END IF;

  SELECT count(*) INTO valid_count FROM public.tasks
   WHERE user_id = _user_id AND status = ANY(status_filter)
     AND coalesce(whitelist_ok, true) = true AND wallet_address IS NOT NULL;

  SELECT count(DISTINCT slot)::integer INTO new_self_slots FROM public.tasks
   WHERE user_id = _user_id AND coalesce(whitelist_ok, true) = true AND wallet_address IS NOT NULL
     AND (coalesce(reverify_count, 0) > 0 OR (fv_mode AND status = ANY(status_filter)));

  auto_qualified := coalesce(new_self_slots, 0) > 0;

  SELECT coalesce(count(*), 0)::int, coalesce(sum(greatest(ms.self_slots, 0)) * 0.1, 0)
    INTO qual_ref, new_ref_units
    FROM public.profiles p JOIN public.mining_state ms ON ms.user_id = p.id
   WHERE p.referred_by = _user_id AND coalesce(ms.self_slots, 0) > 0;

  new_active := coalesce(m.admin_forced_active, false) OR coalesce(new_self_slots, 0) > 0 OR coalesce(new_ref_units, 0) > 0;

  UPDATE public.mining_state
     SET last_credited_at = CASE WHEN new_active THEN now() ELSE last_credited_at END,
         effective_task_count = valid_count,
         self_slots = coalesce(new_self_slots, 0),
         referral_units = coalesce(new_ref_units, 0),
         qualifying_referees = coalesce(qual_ref, 0),
         self_qualified = auto_qualified,
         is_active = new_active,
         activated_at = CASE WHEN activated_at IS NULL AND new_active THEN now() ELSE activated_at END
   WHERE user_id = _user_id;

  SELECT referred_by INTO parent_id FROM public.profiles WHERE id = _user_id;
  IF parent_id IS NOT NULL AND parent_id <> _user_id AND pg_trigger_depth() < 1 AND current_setting('app.settle_child', true) IS DISTINCT FROM '1' THEN
    PERFORM set_config('app.settle_child', '1', true);
    PERFORM public.settle_mining(parent_id);
    PERFORM set_config('app.settle_child', '', true);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_daily_mining_status(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  m public.mining_state%ROWTYPE;
  fv_mode boolean;
  v_monthly numeric := 500;
  v_per numeric;
  v_slots int := 0;
  v_locked numeric := 0;
  v_today date := public.mining_day_key(now());
  v_next timestamptz;
  v_blocked numeric := 0;
  v_blocked_slots int := 0;
BEGIN
  SELECT coalesce(first_verify_mining_mode, false) INTO fv_mode FROM public.bonus_settings WHERE id = 'default';
  SELECT coalesce(cs.monthly_mining_bdt, 500) INTO v_monthly FROM public.profiles p
    LEFT JOIN public.country_settings cs ON cs.code = upper(coalesce(p.country, 'BD')) WHERE p.id = _user_id;
  v_per := round(coalesce(v_monthly, 500) / 10.0 / 30.0, 2);
  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id;

  SELECT count(DISTINCT slot), coalesce(sum(greatest(locked_mined,0)),0) INTO v_slots, v_locked FROM public.tasks
   WHERE user_id = _user_id AND coalesce(whitelist_ok, false) = true AND wallet_address IS NOT NULL
     AND (coalesce(reverify_count, 0) > 0 OR (fv_mode AND status IN ('done','verified')));

  SELECT coalesce(sum(pending_mined + pending_carry),0), count(*) FILTER (WHERE pending_mined + pending_carry > 0)
    INTO v_blocked, v_blocked_slots
    FROM public.tasks WHERE user_id = _user_id AND coalesce(whitelist_ok, false) = false;

  v_next := ((v_today + 1)::timestamp + interval '18 hours') AT TIME ZONE 'Asia/Dhaka';

  RETURN jsonb_build_object(
    'claimed_today', m.last_daily_claim_day IS NOT NULL AND m.last_daily_claim_day >= v_today,
    'slots', v_slots,
    'per_slot', v_per,
    'slot_amount', round(v_per * v_slots + v_locked, 2),
    'referral_amount', round(v_per * coalesce(m.referral_units, 0), 2),
    'amount', round(v_per * v_slots + v_locked + v_per * coalesce(m.referral_units, 0), 2),
    'next_at', v_next,
    'blocked_pending', round(v_blocked, 2),
    'blocked_slots', v_blocked_slots
  );
END $$;

CREATE OR REPLACE FUNCTION public.claim_daily_mining(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  m public.mining_state%ROWTYPE;
  fv_mode boolean;
  v_monthly numeric := 500;
  v_per numeric;
  v_today date;
  r record;
  v_amt numeric;
  v_new_self numeric := 0;
  v_old_locked numeric := 0;
  v_ref numeric := 0;
  v_total numeric := 0;
  v_slots int := 0;
BEGIN
  PERFORM public.settle_mining(_user_id);
  v_today := public.mining_day_key(now());
  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_state'); END IF;
  IF m.last_daily_claim_day IS NOT NULL AND m.last_daily_claim_day >= v_today THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END IF;

  SELECT coalesce(first_verify_mining_mode, false) INTO fv_mode FROM public.bonus_settings WHERE id = 'default';
  SELECT coalesce(cs.monthly_mining_bdt, 500) INTO v_monthly FROM public.profiles p
    LEFT JOIN public.country_settings cs ON cs.code = upper(coalesce(p.country, 'BD')) WHERE p.id = _user_id;
  v_per := round(coalesce(v_monthly, 500) / 10.0 / 30.0, 2);

  FOR r IN
    SELECT DISTINCT ON (t.slot) t.id, t.slot, greatest(coalesce(t.locked_mined,0),0) AS locked
      FROM public.tasks t
     WHERE t.user_id = _user_id AND coalesce(t.whitelist_ok, false) = true AND t.wallet_address IS NOT NULL
       AND (coalesce(t.reverify_count, 0) > 0 OR (fv_mode AND t.status IN ('done','verified')))
     ORDER BY t.slot, t.created_at DESC
  LOOP
    v_amt := round(v_per + r.locked, 2);
    UPDATE public.tasks SET locked_mined = 0, pending_mined = pending_mined + v_amt WHERE id = r.id;
    INSERT INTO public.slot_claims (user_id, task_id, slot, bonus_amount, mining_amount, status, claimed_at)
    VALUES (_user_id, r.id, r.slot, 0, v_amt, 'claimed', now());
    v_new_self := v_new_self + v_per;
    v_old_locked := v_old_locked + r.locked;
    v_slots := v_slots + 1;
  END LOOP;

  v_ref := round(v_per * coalesce(m.referral_units, 0), 2);
  v_total := round(v_new_self + v_old_locked + v_ref, 2);
  IF v_total <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_slots');
  END IF;

  PERFORM set_config('app.balance_change_source', 'daily_mining_claim', true);
  UPDATE public.mining_state
     SET accrued_amount = coalesce(accrued_amount, 0) + v_new_self + v_ref,
         self_mining_accrued = coalesce(self_mining_accrued, 0) + v_new_self,
         referral_accrued = coalesce(referral_accrued, 0) + v_ref,
         bonus_amount = coalesce(bonus_amount, 0) + v_total,
         pending_mining = coalesce(pending_mining, 0) + v_total,
         pending_referral = coalesce(pending_referral, 0) + v_ref,
         last_daily_claim_day = v_today
   WHERE user_id = _user_id;

  IF v_new_self > 0 THEN
    INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
    VALUES (_user_id, v_new_self, 'mining', jsonb_build_object('daily_claim', true, 'slots', v_slots, 'day', v_today));
  END IF;
  IF v_ref > 0 THEN
    INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
    VALUES (_user_id, v_ref, 'referral', jsonb_build_object('daily_claim', true, 'day', v_today));
  END IF;

  INSERT INTO public.mining_claims (user_id, amount, self_amount, referral_amount, balance_after, kind, note)
  SELECT _user_id, v_total, v_new_self + v_old_locked, v_ref,
         coalesce(accrued_amount, 0) - coalesce(withdrawn_amount, 0), 'mining',
         CASE WHEN v_ref > 0 THEN 'রেফারেল ১০% কমিশন → মেইন ব্যালেন্স ক্লেইম' ELSE 'দৈনিক মাইনিং ক্লেইম → পেন্ডিং' END
    FROM public.mining_state WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true, 'total', v_total, 'slots', v_slots, 'referral', v_ref);
END $$;

-- Re-verify করে আবার whitelist হলে আগের মাসের আটকে থাকা পেন্ডিং → মেইন
CREATE OR REPLACE FUNCTION public.tasks_unwhitelist_revert_claims()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_rel numeric;
BEGIN
  IF coalesce(OLD.whitelist_ok, false) = true AND coalesce(NEW.whitelist_ok, false) = false THEN
    PERFORM public.revert_slot_claim_on_unwhitelist(NEW.user_id, NEW.id);
  ELSIF coalesce(OLD.whitelist_ok, false) = false AND coalesce(NEW.whitelist_ok, false) = true
        AND coalesce(NEW.pending_carry, 0) > 0 THEN
    v_rel := NEW.pending_carry;
    UPDATE public.tasks SET pending_carry = 0 WHERE id = NEW.id;
    PERFORM set_config('app.balance_change_source', 'reverify_release', true);
    UPDATE public.mining_state SET pending_mining = greatest(coalesce(pending_mining,0) - v_rel, 0)
     WHERE user_id = NEW.user_id;
    INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
    VALUES (NEW.user_id, 0, 'pending_to_main', NEW.id, jsonb_build_object('released', v_rel, 'reverify', true, 'slot', NEW.slot));
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_daily_mining(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_daily_mining_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_mining(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_mining_status(uuid) TO service_role;