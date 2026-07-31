ALTER TABLE public.mining_state
  ADD COLUMN IF NOT EXISTS referral_accrued numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.settle_mining(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  valid_count int;
  reverified_count int;
  qual_ref int;
  elapsed_sec numeric;
  rate_per_sec numeric := 500.0 / (30.0 * 24.0 * 3600.0);
  prev_self_rate numeric;
  prev_ref_rate numeric;
  parent_id uuid;
  auto_qualified boolean;
  new_active boolean;
  fv_mode boolean;
  status_filter public.task_status[];
BEGIN
  SELECT coalesce(first_verify_mining_mode, false)
    INTO fv_mode
    FROM public.bonus_settings
   WHERE id = 'default';

  IF fv_mode THEN
    status_filter := ARRAY['done','verified']::public.task_status[];
  ELSE
    status_filter := ARRAY['done']::public.task_status[];
  END IF;

  SELECT * INTO m
    FROM public.mining_state
   WHERE user_id = _user_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO valid_count
    FROM public.tasks
   WHERE user_id = _user_id
     AND status = ANY(status_filter)
     AND coalesce(whitelist_ok, true) = true
     AND wallet_address IS NOT NULL;

  SELECT count(DISTINCT slot)::integer INTO reverified_count
    FROM public.tasks
   WHERE user_id = _user_id
     AND coalesce(reverify_count, 0) > 0;

  -- Referral commission counts only referees whose mining is actually running:
  -- all 10 slots valid/whitelisted AND all 10 slots re-verified at least once.
  -- Losing even one slot drops them out until they re-verify again.
  SELECT count(*) INTO qual_ref
    FROM public.profiles p
   WHERE p.referred_by = _user_id
     AND (SELECT count(*) FROM public.tasks t
           WHERE t.user_id = p.id
             AND t.status = ANY(status_filter)
             AND coalesce(t.whitelist_ok, true) = true
             AND t.wallet_address IS NOT NULL) >= 10
     AND (
       (SELECT count(DISTINCT t2.slot) FROM public.tasks t2
         WHERE t2.user_id = p.id
           AND coalesce(t2.reverify_count, 0) > 0) >= 10
       OR fv_mode
     );

  auto_qualified := coalesce(reverified_count, 0) >= 10
                    OR (fv_mode AND valid_count >= 10);
  -- Referral commission alone is enough to keep the meter running.
  new_active := coalesce(m.admin_forced_active, false) OR auto_qualified OR coalesce(qual_ref, 0) > 0;

  IF m.is_active AND m.last_credited_at IS NOT NULL THEN
    elapsed_sec := greatest(EXTRACT(EPOCH FROM (now() - m.last_credited_at)), 0);
    prev_self_rate := rate_per_sec * (coalesce(m.effective_task_count,0)::numeric / 10.0);
    prev_ref_rate  := rate_per_sec * 0.10 * coalesce(m.qualifying_referees, 0);
    UPDATE public.mining_state
       SET accrued_amount = accrued_amount + elapsed_sec * (prev_self_rate + prev_ref_rate),
           referral_accrued = coalesce(referral_accrued, 0) + elapsed_sec * prev_ref_rate,
           last_credited_at = CASE WHEN new_active THEN now() ELSE last_credited_at END,
           effective_task_count = valid_count,
           qualifying_referees = qual_ref,
           is_active = new_active,
           activated_at = CASE WHEN activated_at IS NULL AND (auto_qualified OR coalesce(qual_ref,0) > 0) THEN now() ELSE activated_at END
     WHERE user_id = _user_id;
  ELSE
    UPDATE public.mining_state
       SET effective_task_count = valid_count,
           qualifying_referees = qual_ref,
           is_active = new_active,
           last_credited_at = CASE WHEN new_active THEN now() ELSE last_credited_at END,
           activated_at = CASE WHEN activated_at IS NULL AND (auto_qualified OR coalesce(qual_ref,0) > 0) THEN now() ELSE activated_at END
     WHERE user_id = _user_id;
  END IF;

  SELECT referred_by INTO parent_id
    FROM public.profiles
   WHERE id = _user_id;
  IF parent_id IS NOT NULL AND parent_id <> _user_id THEN
    PERFORM public.settle_mining(parent_id);
  END IF;
END;
$function$;