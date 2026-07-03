-- Add admin force flag to mining_state so admin ON/OFF overrides the auto rules.
ALTER TABLE public.mining_state
  ADD COLUMN IF NOT EXISTS admin_forced_active boolean NOT NULL DEFAULT false;

-- New settle_mining:
--  * Mining starts (activated_at set) only once user has 10 done+whitelisted tasks.
--  * After activation, if ANY task loses whitelist (whitelist_ok=false) → mining auto OFF.
--  * admin_forced_active = true  → force is_active=true (ignore whitelist loss / re-verify).
--  * admin_forced_active = false explicitly by admin toggle OFF → force is_active=false.
CREATE OR REPLACE FUNCTION public.settle_mining(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  valid_count int;
  total_bound int;
  lost_count int;
  qual_ref int;
  elapsed_sec numeric;
  rate_per_sec numeric := 500.0 / (30.0 * 24.0 * 3600.0);
  prev_rate numeric;
  parent_id uuid;
  is_activated boolean;
  auto_active boolean;
  new_active boolean;
BEGIN
  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO valid_count
  FROM public.tasks
  WHERE user_id = _user_id AND status = 'done' AND coalesce(whitelist_ok, true) = true;

  SELECT count(*) INTO total_bound
  FROM public.tasks
  WHERE user_id = _user_id AND status IN ('done','verified');

  SELECT count(*) INTO lost_count
  FROM public.tasks
  WHERE user_id = _user_id AND coalesce(whitelist_ok, true) = false;

  SELECT count(*) INTO qual_ref
  FROM public.profiles p
  WHERE p.referred_by = _user_id
    AND (SELECT count(*) FROM public.tasks t
         WHERE t.user_id = p.id AND t.status = 'done' AND coalesce(t.whitelist_ok, true) = true) >= 10;

  is_activated := m.activated_at IS NOT NULL OR valid_count >= 10;

  -- Auto rule: activated AND no whitelist loss AND at least some earning source.
  auto_active := is_activated AND lost_count = 0 AND (valid_count > 0 OR qual_ref > 0);

  -- Admin override wins in both directions.
  IF m.admin_forced_active THEN
    new_active := true;
  ELSE
    new_active := auto_active;
  END IF;

  IF m.is_active AND m.last_credited_at IS NOT NULL THEN
    elapsed_sec := EXTRACT(EPOCH FROM (now() - m.last_credited_at));
    prev_rate := rate_per_sec * (coalesce(m.effective_task_count,0)::numeric / 10.0)
               + rate_per_sec * 0.10 * coalesce(m.qualifying_referees, 0);
    UPDATE public.mining_state
    SET accrued_amount = accrued_amount + elapsed_sec * prev_rate,
        last_credited_at = CASE WHEN new_active THEN now() ELSE last_credited_at END,
        effective_task_count = valid_count,
        qualifying_referees = qual_ref,
        is_active = new_active,
        activated_at = CASE WHEN activated_at IS NULL AND valid_count >= 10 THEN now() ELSE activated_at END
    WHERE user_id = _user_id;
  ELSE
    UPDATE public.mining_state
    SET effective_task_count = valid_count,
        qualifying_referees = qual_ref,
        is_active = new_active,
        last_credited_at = CASE WHEN new_active THEN now() ELSE last_credited_at END,
        activated_at = CASE WHEN activated_at IS NULL AND valid_count >= 10 THEN now() ELSE activated_at END
    WHERE user_id = _user_id;
  END IF;

  SELECT referred_by INTO parent_id FROM public.profiles WHERE id = _user_id;
  IF parent_id IS NOT NULL AND parent_id <> _user_id THEN
    DECLARE
      pm record;
      p_valid int;
      p_lost int;
      p_qual int;
      p_elapsed numeric;
      p_rate numeric;
      p_activated boolean;
      p_auto boolean;
      p_new_active boolean;
    BEGIN
      SELECT * INTO pm FROM public.mining_state WHERE user_id = parent_id FOR UPDATE;
      IF FOUND THEN
        SELECT count(*) INTO p_valid FROM public.tasks
          WHERE user_id = parent_id AND status='done' AND coalesce(whitelist_ok,true)=true;
        SELECT count(*) INTO p_lost FROM public.tasks
          WHERE user_id = parent_id AND coalesce(whitelist_ok,true)=false;
        SELECT count(*) INTO p_qual FROM public.profiles p
          WHERE p.referred_by = parent_id
            AND (SELECT count(*) FROM public.tasks t
                 WHERE t.user_id=p.id AND t.status='done' AND coalesce(t.whitelist_ok,true)=true) >= 10;
        p_activated := pm.activated_at IS NOT NULL OR p_valid >= 10;
        p_auto := p_activated AND p_lost = 0 AND (p_valid > 0 OR p_qual > 0);
        IF pm.admin_forced_active THEN
          p_new_active := true;
        ELSE
          p_new_active := p_auto;
        END IF;
        IF pm.is_active AND pm.last_credited_at IS NOT NULL THEN
          p_elapsed := EXTRACT(EPOCH FROM (now() - pm.last_credited_at));
          p_rate := rate_per_sec * (coalesce(pm.effective_task_count,0)::numeric / 10.0)
                  + rate_per_sec * 0.10 * coalesce(pm.qualifying_referees, 0);
          UPDATE public.mining_state
          SET accrued_amount = accrued_amount + p_elapsed * p_rate,
              last_credited_at = CASE WHEN p_new_active THEN now() ELSE last_credited_at END,
              qualifying_referees = p_qual,
              is_active = p_new_active,
              activated_at = CASE WHEN activated_at IS NULL AND p_valid >= 10 THEN now() ELSE activated_at END
          WHERE user_id = parent_id;
        ELSE
          UPDATE public.mining_state
          SET qualifying_referees = p_qual,
              is_active = p_new_active,
              last_credited_at = CASE WHEN p_new_active THEN now() ELSE last_credited_at END,
              activated_at = CASE WHEN activated_at IS NULL AND p_valid >= 10 THEN now() ELSE activated_at END
          WHERE user_id = parent_id;
        END IF;
      END IF;
    END;
  END IF;
END;
$function$;