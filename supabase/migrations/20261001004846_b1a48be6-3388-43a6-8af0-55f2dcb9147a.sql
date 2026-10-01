ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS released_mined numeric NOT NULL DEFAULT 0;
ALTER TABLE public.mining_state ADD COLUMN IF NOT EXISTS released_main numeric NOT NULL DEFAULT 0;
ALTER TABLE public.mining_state ADD COLUMN IF NOT EXISTS released_referral numeric NOT NULL DEFAULT 0;
ALTER TABLE public.mining_state ADD COLUMN IF NOT EXISTS last_release_month date;

CREATE OR REPLACE FUNCTION public.release_pending_verified_slots(_force boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_month date := date_trunc('month', now() AT TIME ZONE 'Asia/Dhaka')::date;
  fv_mode boolean; u record; v_slot numeric; v_ref numeric; v_has boolean; v_users int := 0; v_total numeric := 0;
BEGIN
  IF NOT _force AND extract(day from now() AT TIME ZONE 'Asia/Dhaka') <> 1 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'not_day_1');
  END IF;
  SELECT coalesce(first_verify_mining_mode,false) INTO fv_mode FROM public.bonus_settings WHERE id='default';
  PERFORM set_config('app.balance_change_source', 'monthly_pending_release', true);
  FOR u IN SELECT * FROM public.mining_state WHERE coalesce(pending_mining,0) > 0
             AND (last_release_month IS NULL OR last_release_month < v_month) FOR UPDATE LOOP
    SELECT coalesce(sum(greatest(pending_mined,0)),0), count(*) > 0 INTO v_slot, v_has
      FROM public.tasks t WHERE t.user_id = u.user_id AND coalesce(t.whitelist_ok,false)
       AND t.wallet_address IS NOT NULL
       AND (coalesce(t.reverify_count,0) > 0 OR (fv_mode AND t.status IN ('done','verified')));
    v_ref := CASE WHEN v_has THEN greatest(coalesce(u.pending_referral,0),0) ELSE 0 END;
    v_slot := least(v_slot + v_ref, greatest(coalesce(u.pending_mining,0),0)) - v_ref;
    IF v_slot < 0 THEN v_ref := v_ref + v_slot; v_slot := 0; END IF;
    UPDATE public.tasks t SET released_mined = released_mined + pending_mined, pending_mined = 0
     WHERE t.user_id = u.user_id AND coalesce(t.whitelist_ok,false) AND t.wallet_address IS NOT NULL
       AND (coalesce(t.reverify_count,0) > 0 OR (fv_mode AND t.status IN ('done','verified')))
       AND pending_mined > 0;
    UPDATE public.mining_state SET
      pending_mining = greatest(coalesce(pending_mining,0) - v_slot - v_ref, 0),
      pending_referral = greatest(coalesce(pending_referral,0) - v_ref, 0),
      released_main = coalesce(released_main,0) + v_slot,
      released_referral = coalesce(released_referral,0) + v_ref,
      last_release_month = v_month
     WHERE user_id = u.user_id;
    IF v_slot + v_ref > 0 THEN v_users := v_users + 1; v_total := v_total + v_slot + v_ref; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'users', v_users, 'total', v_total);
END $$;

CREATE OR REPLACE FUNCTION public.revert_unwithdrawn_mining_main()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u record; bd jsonb; v_main numeric; v_rel numeric; v_back numeric; v_ratio numeric; v_users int := 0;
BEGIN
  PERFORM set_config('app.balance_change_source', 'monthly_pending_revert', true);
  FOR u IN SELECT * FROM public.mining_state WHERE coalesce(released_main,0)+coalesce(released_referral,0) > 0 FOR UPDATE LOOP
    bd := public.get_user_balance_breakdown(u.user_id);
    v_main := greatest(coalesce((bd->>'bonus_part')::numeric,0),0);
    v_rel := coalesce(u.released_main,0) + coalesce(u.released_referral,0);
    v_back := least(v_rel, v_main);
    v_ratio := CASE WHEN v_rel > 0 THEN v_back / v_rel ELSE 0 END;
    UPDATE public.tasks SET pending_mined = pending_mined + round(released_mined * v_ratio, 2), released_mined = 0
     WHERE user_id = u.user_id AND released_mined > 0;
    UPDATE public.mining_state SET
      pending_mining = coalesce(pending_mining,0) + v_back,
      pending_referral = coalesce(pending_referral,0) + round(coalesce(released_referral,0) * v_ratio, 2),
      released_main = 0, released_referral = 0
     WHERE user_id = u.user_id;
    IF v_back > 0 THEN v_users := v_users + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'users', v_users);
END $$;

REVOKE ALL ON FUNCTION public.release_pending_verified_slots(boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revert_unwithdrawn_mining_main() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_withdrawal_request_atomic(_user_id uuid, _gross numeric, _payout numeric, _provider wallet_provider, _wallet_number text, _admin_note text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  s public.bonus_settings%ROWTYPE;
  v_debt numeric := 0; v_id uuid; v_breakdown jsonb; v_main numeric := 0;
BEGIN
  IF _gross IS NULL OR _gross <= 0 OR _payout IS NULL OR _payout <= 0 OR _payout > _gross THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সঠিক withdrawal amount দিন');
  END IF;
  SELECT * INTO s FROM public.bonus_settings WHERE id = 'default';
  IF coalesce(s.withdraw_enabled, true) = false
     AND (s.withdraw_off_until IS NULL OR s.withdraw_off_until > now()) THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(s.withdraw_off_message, 'উইথড্র সাময়িকভাবে বন্ধ'));
  END IF;
  PERFORM public.settle_mining(_user_id);
  PERFORM 1 FROM public.mining_state WHERE user_id = _user_id FOR UPDATE;
  SELECT coalesce(sum(amount), 0) INTO v_debt FROM public.user_debts WHERE user_id = _user_id AND status IN ('active', 'claimed');
  IF v_debt > 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'অ্যাকাউন্টে warning/ঋণ আছে'); END IF;

  v_breakdown := public.get_user_balance_breakdown(_user_id);
  v_main := coalesce((v_breakdown->>'bonus_part')::numeric, 0);
  IF v_main < _gross THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'উইথড্র শুধু মেইন ব্যালেন্স থেকে হয়। পেন্ডিং টাকা সরাসরি তোলা যায় না — ভেরিফাই স্লটের টাকা ১ তারিখে মেইনে আসে। এখন তোলা যাবে: ' || greatest(floor(v_main),0)::text || '৳');
  END IF;

  INSERT INTO public.withdrawals (user_id, amount, provider, wallet_number, status, admin_note, src_main, src_mining, src_referral)
  VALUES (_user_id, _payout, _provider, _wallet_number, 'pending', _admin_note, round(_gross, 2), 0, 0)
  RETURNING id INTO v_id;
  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, -_gross, 'withdrawal', v_id,
          jsonb_build_object('gross', _gross, 'payout', _payout, 'fee', _gross - _payout, 'mining_part', 0, 'main_part', _gross, 'referral_part', 0));
  UPDATE public.mining_state SET withdrawn_amount = coalesce(withdrawn_amount, 0) + _gross WHERE user_id = _user_id;
  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_id, 'gross', _gross, 'payout', _payout, 'main_part', _gross, 'mining_part', 0, 'referral_part', 0);
END;
$function$;