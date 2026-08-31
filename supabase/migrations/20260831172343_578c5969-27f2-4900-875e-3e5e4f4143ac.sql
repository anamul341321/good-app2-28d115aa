-- 1) Withdraw stays paused until midnight Dhaka (2026-09-01 00:00 +06), then auto-opens.
UPDATE public.bonus_settings
   SET withdraw_enabled = false,
       withdraw_off_until = '2026-08-31 18:00:00+00',
       withdraw_off_message = 'উইথড্র রাত ১২:০০টার পর স্বয়ংক্রিয়ভাবে চালু হবে — অনুগ্রহ করে অপেক্ষা করুন।',
       bkash_enabled = true,
       nagad_enabled = true
 WHERE id = 'default';

-- 2) Reverse an already-claimed slot reward when that slot loses whitelist.
CREATE OR REPLACE FUNCTION public.revert_slot_claim_on_unwhitelist(_user_id uuid, _task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed_total numeric := 0;
  v_claimed_bonus numeric := 0;
  v_rev_total numeric := 0;
  v_rev_bonus numeric := 0;
  v_net_total numeric := 0;
  v_net_bonus numeric := 0;
  v_net_mining numeric := 0;
  v_slot int;
  v_bonus_avail numeric := 0;
BEGIN
  SELECT slot INTO v_slot FROM public.tasks WHERE id = _task_id AND user_id = _user_id;
  IF v_slot IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT coalesce(sum(coalesce((metadata->>'total')::numeric, 0)), 0),
         coalesce(sum(coalesce((metadata->>'bonus')::numeric, 0)), 0)
    INTO v_claimed_total, v_claimed_bonus
    FROM public.balance_ledger
   WHERE user_id = _user_id AND source_id = _task_id AND type = 'slot_claim';

  SELECT coalesce(sum(coalesce((metadata->>'total')::numeric, 0)), 0),
         coalesce(sum(coalesce((metadata->>'bonus')::numeric, 0)), 0)
    INTO v_rev_total, v_rev_bonus
    FROM public.balance_ledger
   WHERE user_id = _user_id AND source_id = _task_id AND type = 'slot_claim_reverted';

  v_net_total := floor(greatest(v_claimed_total - v_rev_total, 0) * 100) / 100;
  v_net_bonus := floor(greatest(v_claimed_bonus - v_rev_bonus, 0) * 100) / 100;
  IF v_net_total <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'reverted', 0);
  END IF;

  -- Never push the main pool negative: only what is still sitting in main can move back.
  SELECT greatest(coalesce(bonus_amount, 0), 0) INTO v_bonus_avail
    FROM public.mining_state WHERE user_id = _user_id FOR UPDATE;
  v_net_total := least(v_net_total, v_bonus_avail);
  IF v_net_total <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'reverted', 0);
  END IF;
  v_net_bonus := least(v_net_bonus, v_net_total);
  v_net_mining := greatest(v_net_total - v_net_bonus, 0);

  PERFORM set_config('app.balance_change_source', 'slot_claim_reverted', true);

  -- Main pool shrinks; the mining part slides back into the mining balance.
  UPDATE public.mining_state
     SET bonus_amount = greatest(coalesce(bonus_amount, 0) - v_net_total, 0),
         accrued_amount = greatest(coalesce(accrued_amount, 0) - v_net_bonus, 0)
   WHERE user_id = _user_id;

  -- Park the reward again so it becomes claimable only after a fresh re-verify.
  INSERT INTO public.slot_claims (user_id, task_id, slot, bonus_amount, mining_amount, status)
  VALUES (_user_id, _task_id, v_slot, v_net_bonus, v_net_mining, 'pending');

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, -v_net_bonus, 'slot_claim_reverted', _task_id,
          jsonb_build_object('total', v_net_total, 'bonus', v_net_bonus, 'mining', v_net_mining, 'slot', v_slot));

  RETURN jsonb_build_object('ok', true, 'reverted', v_net_total, 'bonus', v_net_bonus, 'mining', v_net_mining);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_slot_claim_on_unwhitelist(uuid, uuid) TO service_role;

-- 3) Auto-run the reversal the moment a slot stops being whitelisted.
CREATE OR REPLACE FUNCTION public.tasks_unwhitelist_revert_claims()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(OLD.whitelist_ok, false) = true AND coalesce(NEW.whitelist_ok, false) = false THEN
    PERFORM public.revert_slot_claim_on_unwhitelist(NEW.user_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_unwhitelist_revert ON public.tasks;
CREATE TRIGGER trg_tasks_unwhitelist_revert
AFTER UPDATE OF whitelist_ok ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_unwhitelist_revert_claims();