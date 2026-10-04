ALTER TABLE public.support_calls
  ADD COLUMN IF NOT EXISTS on_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_charged_at timestamptz,
  ADD COLUMN IF NOT EXISTS charged_total numeric NOT NULL DEFAULT 0;

-- প্রতি মিনিটে ০.৪৳ — আগে মেইন, না থাকলে পেন্ডিং থেকে কাটে। মোট ব্যালেন্স কখনো বাড়ে না।
CREATE OR REPLACE FUNCTION public.support_call_balance(_user uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE b jsonb; d numeric := 0;
BEGIN
  b := public.get_user_balance_breakdown(_user);
  SELECT coalesce(sum(amount),0) INTO d FROM public.user_debts WHERE user_id = _user AND status = 'active';
  RETURN greatest(coalesce((b->>'bonus_part')::numeric,0) + coalesce((b->>'pending_part')::numeric,0) - d, 0);
END $$;

CREATE OR REPLACE FUNCTION public.charge_support_minute(_call uuid, _user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.support_calls%ROWTYPE; b jsonb; v_main numeric; v_pend numeric; v_from_pend numeric; v_fee numeric := 0.4;
BEGIN
  SELECT * INTO c FROM public.support_calls WHERE id = _call FOR UPDATE;
  IF NOT FOUND OR c.caller_user_id IS DISTINCT FROM _user THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF c.status <> 'accepted' THEN RETURN jsonb_build_object('ok', false, 'error', 'not_active'); END IF;
  IF c.on_hold THEN RETURN jsonb_build_object('ok', true, 'skipped', 'hold'); END IF;
  IF c.last_charged_at IS NOT NULL AND c.last_charged_at > now() - interval '55 seconds' THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'early');
  END IF;
  IF public.support_call_balance(_user) < v_fee THEN RETURN jsonb_build_object('ok', false, 'error', 'no_balance'); END IF;
  b := public.get_user_balance_breakdown(_user);
  v_main := coalesce((b->>'bonus_part')::numeric,0);
  v_pend := coalesce((b->>'pending_part')::numeric,0);
  v_from_pend := greatest(v_fee - greatest(v_main,0), 0);
  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount,0) + v_fee,
         pending_mining = greatest(coalesce(pending_mining,0) - least(v_from_pend, v_pend), 0)
   WHERE user_id = _user;
  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user, -v_fee, 'support_call', _call, jsonb_build_object('from_pending', v_from_pend));
  UPDATE public.support_calls SET last_charged_at = now(), charged_total = charged_total + v_fee WHERE id = _call;
  RETURN jsonb_build_object('ok', true, 'charged', v_fee);
END $$;

REVOKE ALL ON FUNCTION public.charge_support_minute(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.support_call_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_support_minute(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_call_balance(uuid) TO service_role;