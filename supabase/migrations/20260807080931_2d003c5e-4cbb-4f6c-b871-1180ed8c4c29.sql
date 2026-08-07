CREATE OR REPLACE FUNCTION public.claim_welcome_bonuses(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  p public.profiles%ROWTYPE;
  s public.bonus_settings%ROWTYPE;
  v_first_count integer := 0;
  v_reverify_count integer := 0;
  self_award numeric := 0;
  ref_award numeric := 0;
  reverify_award numeric := 0;
  in_promo boolean := false;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND OR coalesce(p.banned, false) THEN
    RETURN jsonb_build_object('self_first_amount',0,'referrer_amount',0,'reverify_amount',0);
  END IF;

  SELECT count(DISTINCT t.slot) FILTER (WHERE t.initial_verify_at IS NOT NULL),
         count(DISTINCT t.slot) FILTER (WHERE coalesce(t.reverify_count,0) > 0 AND coalesce(t.whitelist_ok,true) AND t.wallet_address IS NOT NULL)
    INTO v_first_count, v_reverify_count
    FROM public.tasks t WHERE t.user_id = _user_id;

  SELECT * INTO s FROM public.bonus_settings WHERE id = 'default';
  in_promo := coalesce(s.promo_active,false)
              AND s.promo_start_at IS NOT NULL AND s.promo_end_at IS NOT NULL
              AND now() BETWEEN s.promo_start_at AND s.promo_end_at;

  IF v_first_count >= 10 AND NOT coalesce(p.bonus_first_verify_self_claimed,false) THEN
    self_award := greatest(CASE WHEN in_promo AND s.promo_first_verify_bonus IS NOT NULL THEN s.promo_first_verify_bonus ELSE coalesce(s.first_verify_bonus,50) END,0);
    UPDATE public.profiles SET bonus_first_verify_self_claimed=true WHERE id=_user_id;
    PERFORM public.credit_bonus_balance(_user_id,self_award);
  END IF;

  IF v_first_count >= 10 AND NOT coalesce(p.bonus_first_verify_claimed,false) THEN
    UPDATE public.profiles SET bonus_first_verify_claimed=true WHERE id=_user_id;
    IF p.referred_by IS NOT NULL AND p.referred_by <> _user_id THEN
      PERFORM 1 FROM public.profiles WHERE id=p.referred_by FOR UPDATE;
      ref_award := greatest(CASE WHEN in_promo AND s.promo_referrer_bonus IS NOT NULL THEN s.promo_referrer_bonus ELSE coalesce(s.referrer_bonus,100) END,0);
      PERFORM public.credit_bonus_balance(p.referred_by,ref_award);
    END IF;
  END IF;

  IF v_reverify_count >= 10 AND NOT coalesce(p.bonus_reverify_claimed,false) THEN
    reverify_award := public.claim_reverify_bonus(_user_id);
  END IF;

  RETURN jsonb_build_object('self_first_amount',self_award,'referrer_amount',ref_award,'reverify_amount',reverify_award);
END;
$fn$;

REVOKE ALL ON FUNCTION public.claim_welcome_bonuses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_welcome_bonuses(uuid) TO service_role;