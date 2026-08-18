CREATE OR REPLACE FUNCTION public.claim_mining_to_main(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_break jsonb;
  v_amount numeric := 0;
BEGIN
  PERFORM public.settle_mining(_user_id);

  v_break := public.get_user_balance_breakdown(_user_id);
  v_amount := floor(coalesce((v_break->>'mining_available')::numeric, 0) * 100) / 100;

  IF v_amount < 0.5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_small', 'pending', v_amount);
  END IF;

  PERFORM set_config('app.balance_change_source', 'claim_to_main', true);

  UPDATE public.mining_state
     SET bonus_amount    = coalesce(bonus_amount, 0) + v_amount,
         mining_unlocked = greatest(coalesce(mining_unlocked, 0) - v_amount, 0)
   WHERE user_id = _user_id;

  INSERT INTO public.mining_claims (user_id, amount, self_amount, referral_amount, balance_after, kind, note)
  SELECT _user_id, v_amount, v_amount, 0,
         coalesce(accrued_amount, 0) - coalesce(withdrawn_amount, 0),
         'mining', 'মাইনিং → মেইন ব্যালেন্স ক্লেইম'
    FROM public.mining_state WHERE user_id = _user_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
  VALUES (_user_id, 0, 'mining_claim',
          jsonb_build_object('moved_to_main', v_amount, 'reason', 'claim_mining_to_main'));

  RETURN jsonb_build_object('ok', true, 'amount', v_amount);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_mining_to_main(uuid) TO authenticated, service_role;