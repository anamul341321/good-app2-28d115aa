ALTER TABLE public.mining_state ADD COLUMN IF NOT EXISTS last_legacy_release_month date;

CREATE OR REPLACE FUNCTION public.release_legacy_verified_pending(_force boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_month date := date_trunc('month', now() AT TIME ZONE 'Asia/Dhaka')::date;
  v_prev date := (date_trunc('month', now() AT TIME ZONE 'Asia/Dhaka') - interval '1 month')::date;
  u record; v_slots_pend numeric; v_untracked numeric; v_entitled numeric; v_amt numeric;
  v_users int := 0; v_total numeric := 0;
BEGIN
  IF NOT _force AND extract(day from now() AT TIME ZONE 'Asia/Dhaka') <> 1 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'not_day_1');
  END IF;
  PERFORM set_config('app.balance_change_source', 'monthly_pending_release', true);
  FOR u IN SELECT * FROM public.mining_state WHERE coalesce(pending_mining,0) > 0
             AND (last_legacy_release_month IS NULL OR last_legacy_release_month < v_month) FOR UPDATE LOOP
    SELECT coalesce(sum(greatest(pending_mined,0)),0) INTO v_slots_pend FROM public.tasks WHERE user_id = u.user_id;
    v_untracked := greatest(coalesce(u.pending_mining,0) - v_slots_pend - greatest(coalesce(u.pending_referral,0),0), 0);
    -- 50৳/month per verified slot, prorated by days verified in the previous month
    SELECT coalesce(sum((50.0/30.0) * least(30, greatest(0,
             v_month - greatest(coalesce(t.initial_verify_at, t.created_at)::date, v_prev)))),0)
      INTO v_entitled
      FROM public.tasks t
     WHERE t.user_id = u.user_id AND coalesce(t.whitelist_ok,false) AND t.wallet_address IS NOT NULL
       AND t.status IN ('verified','done');
    v_amt := round(least(v_untracked, v_entitled), 2);
    UPDATE public.mining_state SET
      pending_mining = greatest(coalesce(pending_mining,0) - v_amt, 0),
      released_main = coalesce(released_main,0) + v_amt,
      last_legacy_release_month = v_month
     WHERE user_id = u.user_id;
    IF v_amt > 0 THEN v_users := v_users + 1; v_total := v_total + v_amt; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'users', v_users, 'total', v_total);
END $$;
REVOKE ALL ON FUNCTION public.release_legacy_verified_pending(boolean) FROM public, anon, authenticated;