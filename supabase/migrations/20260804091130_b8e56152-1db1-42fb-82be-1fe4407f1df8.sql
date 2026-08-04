ALTER TABLE public.mining_state
  ADD COLUMN IF NOT EXISTS self_slots integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_units numeric NOT NULL DEFAULT 0;

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
  new_self_slots int;
  new_ref_units numeric;
  qual_ref int;
  elapsed_sec numeric;
  rate_per_slot_sec numeric := 500.0 / (30.0 * 24.0 * 3600.0) / 10.0;
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

  -- Distinct slots that are re-verified AND still valid/whitelisted.
  SELECT count(DISTINCT slot)::integer INTO reverified_count
    FROM public.tasks
   WHERE user_id = _user_id
     AND coalesce(reverify_count, 0) > 0
     AND coalesce(whitelist_ok, true) = true
     AND wallet_address IS NOT NULL;

  auto_qualified := coalesce(reverified_count, 0) >= 10
                    OR (fv_mode AND valid_count >= 10);

  -- Each qualifying slot mines 50৳/month. First 10 are mandatory to start;
  -- every extra re-verified slot adds its own 50৳/month.
  IF auto_qualified THEN
    new_self_slots := CASE WHEN fv_mode
      THEN greatest(coalesce(valid_count,0), coalesce(reverified_count,0))
      ELSE coalesce(reverified_count,0) END;
  ELSE
    new_self_slots := 0;
  END IF;

  -- Referrer earns 10% of each qualifying referee's own monthly rate.
  SELECT coalesce(count(*), 0)::int,
         coalesce(sum(slots) * 0.1, 0)
    INTO qual_ref, new_ref_units
    FROM (
      SELECT CASE WHEN fv_mode
               THEN greatest(ms.self_slots, 0)
               ELSE greatest(ms.self_slots, 0) END AS slots
        FROM public.profiles p
        JOIN public.mining_state ms ON ms.user_id = p.id
       WHERE p.referred_by = _user_id
         AND coalesce(ms.self_slots, 0) > 0
    ) q;

  new_active := coalesce(m.admin_forced_active, false)
                OR new_self_slots > 0
                OR coalesce(new_ref_units, 0) > 0;

  IF m.is_active AND m.last_credited_at IS NOT NULL THEN
    elapsed_sec := greatest(EXTRACT(EPOCH FROM (now() - m.last_credited_at)), 0);
    IF coalesce(m.self_qualified, false) OR coalesce(m.admin_forced_active, false) THEN
      prev_self_rate := rate_per_slot_sec * coalesce(m.self_slots, 0)::numeric;
    ELSE
      prev_self_rate := 0;
    END IF;
    prev_ref_rate := rate_per_slot_sec * coalesce(m.referral_units, 0);
    UPDATE public.mining_state
       SET accrued_amount = accrued_amount + elapsed_sec * (prev_self_rate + prev_ref_rate),
           referral_accrued = coalesce(referral_accrued, 0) + elapsed_sec * prev_ref_rate,
           last_credited_at = CASE WHEN new_active THEN now() ELSE last_credited_at END,
           effective_task_count = valid_count,
           self_slots = new_self_slots,
           referral_units = coalesce(new_ref_units, 0),
           qualifying_referees = coalesce(qual_ref, 0),
           self_qualified = auto_qualified,
           is_active = new_active,
           activated_at = CASE WHEN activated_at IS NULL AND new_active THEN now() ELSE activated_at END
     WHERE user_id = _user_id;
  ELSE
    UPDATE public.mining_state
       SET effective_task_count = valid_count,
           self_slots = new_self_slots,
           referral_units = coalesce(new_ref_units, 0),
           qualifying_referees = coalesce(qual_ref, 0),
           self_qualified = auto_qualified,
           is_active = new_active,
           last_credited_at = CASE WHEN new_active THEN now() ELSE last_credited_at END,
           activated_at = CASE WHEN activated_at IS NULL AND new_active THEN now() ELSE activated_at END
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

-- Backfill self_slots for everyone, then referral_units from those values.
UPDATE public.mining_state ms
   SET self_slots = CASE WHEN sub.rv >= 10 THEN sub.rv ELSE 0 END,
       self_qualified = (sub.rv >= 10)
  FROM (
    SELECT t.user_id,
           count(DISTINCT t.slot)::int AS rv
      FROM public.tasks t
     WHERE coalesce(t.reverify_count, 0) > 0
       AND coalesce(t.whitelist_ok, true) = true
       AND t.wallet_address IS NOT NULL
     GROUP BY t.user_id
  ) sub
 WHERE ms.user_id = sub.user_id;

UPDATE public.mining_state ms
   SET self_slots = 0, self_qualified = false
 WHERE NOT EXISTS (
   SELECT 1 FROM public.tasks t
    WHERE t.user_id = ms.user_id AND coalesce(t.reverify_count,0) > 0
 );

UPDATE public.mining_state ms
   SET referral_units = coalesce(r.units, 0),
       qualifying_referees = coalesce(r.cnt, 0)
  FROM (
    SELECT p.referred_by AS uid,
           count(*) FILTER (WHERE coalesce(c.self_slots,0) > 0)::int AS cnt,
           sum(greatest(coalesce(c.self_slots,0), 0)) * 0.1 AS units
      FROM public.profiles p
      JOIN public.mining_state c ON c.user_id = p.id
     WHERE p.referred_by IS NOT NULL
     GROUP BY p.referred_by
  ) r
 WHERE ms.user_id = r.uid;