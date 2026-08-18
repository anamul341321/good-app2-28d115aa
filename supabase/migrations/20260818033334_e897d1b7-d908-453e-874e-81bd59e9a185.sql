CREATE TABLE IF NOT EXISTS public.slot_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  slot integer NOT NULL,
  bonus_amount numeric NOT NULL DEFAULT 0,
  mining_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz
);

CREATE INDEX IF NOT EXISTS slot_claims_user_status_idx ON public.slot_claims (user_id, status);
CREATE INDEX IF NOT EXISTS slot_claims_task_idx ON public.slot_claims (task_id);

GRANT SELECT ON public.slot_claims TO authenticated;
GRANT ALL ON public.slot_claims TO service_role;

ALTER TABLE public.slot_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slot_claims_select_own" ON public.slot_claims;
CREATE POLICY "slot_claims_select_own" ON public.slot_claims
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.transition_task_whitelist(_task_id uuid, _is_whitelisted boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.tasks%ROWTYPE;
  now_at timestamptz := now();
  v_unlock numeric := 0;
  v_bonus numeric := 0;
  v_bonus_on boolean := true;
BEGIN
  SELECT * INTO t FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'missing'; END IF;

  IF t.wallet_address IS NULL OR t.status = 'empty'::public.task_status THEN
    RETURN 'skipped_empty';
  END IF;

  IF NOT _is_whitelisted THEN
    IF t.status <> 'verified'::public.task_status OR coalesce(t.whitelist_ok, true) <> false THEN
      UPDATE public.tasks
      SET whitelist_ok = false,
          last_whitelist_check_at = now_at,
          status = 'verified'::public.task_status,
          reverify_due_at = now_at
      WHERE id = _task_id;
      RETURN 'lost';
    END IF;

    UPDATE public.tasks SET last_whitelist_check_at = now_at WHERE id = _task_id;
    RETURN 'unchanged';
  END IF;

  IF coalesce(t.whitelist_ok, true) = false THEN
    v_unlock := greatest(coalesce(t.locked_mined, 0), 0);

    UPDATE public.tasks
    SET whitelist_ok = true,
        last_whitelist_check_at = now_at,
        status = 'done'::public.task_status,
        done_at = now_at,
        last_reverified_at = now_at,
        reverify_count = coalesce(reverify_count, 0) + 1,
        locked_mined = 0
    WHERE id = _task_id;

    -- repeat re-verify (slot was already re-verified before) -> 10 BDT main balance bonus
    SELECT coalesce(bonus_enabled, true) INTO v_bonus_on FROM public.bonus_settings WHERE id = 'default';
    IF coalesce(v_bonus_on, true) AND coalesce(t.reverify_count, 0) > 0 THEN
      v_bonus := 10;
    END IF;

    -- Instead of crediting silently, park the reward as a per-slot claim the
    -- user must tap to move into the main balance.
    IF v_unlock > 0 OR v_bonus > 0 THEN
      INSERT INTO public.slot_claims (user_id, task_id, slot, bonus_amount, mining_amount)
      VALUES (t.user_id, t.id, t.slot, v_bonus, v_unlock);
    END IF;

    RETURN 'restored';
  END IF;

  UPDATE public.tasks SET last_whitelist_check_at = now_at WHERE id = _task_id;
  RETURN 'unchanged';
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_slot_reward(_user_id uuid, _task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bonus numeric := 0;
  v_mining numeric := 0;
  v_ids uuid[];
BEGIN
  PERFORM public.settle_mining(_user_id);

  SELECT coalesce(sum(bonus_amount), 0), coalesce(sum(mining_amount), 0), array_agg(id)
    INTO v_bonus, v_mining, v_ids
    FROM public.slot_claims
   WHERE user_id = _user_id AND task_id = _task_id AND status = 'pending'
   FOR UPDATE;

  IF v_ids IS NULL OR array_length(v_ids, 1) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_to_claim');
  END IF;

  v_bonus := floor(greatest(v_bonus, 0) * 100) / 100;
  v_mining := floor(greatest(v_mining, 0) * 100) / 100;

  PERFORM set_config('app.balance_change_source', 'slot_claim', true);

  -- Mining money already exists in accrued_amount but sits in the mining pocket.
  -- Moving it to the main pocket = raise bonus_amount by the same value.
  IF v_mining > 0 THEN
    UPDATE public.mining_state
       SET bonus_amount = coalesce(bonus_amount, 0) + v_mining
     WHERE user_id = _user_id;

    INSERT INTO public.mining_claims (user_id, amount, self_amount, referral_amount, balance_after, kind, note)
    SELECT _user_id, v_mining, v_mining, 0,
           coalesce(accrued_amount, 0) - coalesce(withdrawn_amount, 0),
           'mining', 'স্লট ক্লেইম — মাইনিং → মেইন ব্যালেন্স'
      FROM public.mining_state WHERE user_id = _user_id;

    INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
    VALUES (_user_id, 0, 'mining_claim', _task_id,
            jsonb_build_object('moved_to_main', v_mining, 'reason', 'claim_slot_reward'));
  END IF;

  IF v_bonus > 0 THEN
    PERFORM public.credit_bonus_balance(
      _user_id, v_bonus, 'bonus', _task_id,
      jsonb_build_object('reason', 'reverify_cycle_claim'));
  END IF;

  UPDATE public.slot_claims
     SET status = 'claimed', claimed_at = now()
   WHERE id = ANY(v_ids);

  RETURN jsonb_build_object('ok', true, 'bonus', v_bonus, 'mining', v_mining,
                            'total', v_bonus + v_mining);
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_slot_reward(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_slot_reward(uuid, uuid) TO service_role;