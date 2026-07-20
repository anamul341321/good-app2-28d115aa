CREATE OR REPLACE FUNCTION public.settle_mining(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  valid_count int;
  lost_count int;
  qual_ref int;
  elapsed_sec numeric;
  rate_per_sec numeric := 500.0 / (30.0 * 24.0 * 3600.0);
  prev_rate numeric;
  parent_id uuid;
  is_activated boolean;
  auto_active boolean;
  new_active boolean;
  fv_mode boolean;
  status_filter public.task_status[];
BEGIN
  SELECT coalesce(first_verify_mining_mode, false) INTO fv_mode
    FROM public.bonus_settings WHERE id = 'default';
  IF fv_mode THEN
    status_filter := ARRAY['done','verified']::public.task_status[];
  ELSE
    status_filter := ARRAY['done']::public.task_status[];
  END IF;

  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO valid_count
  FROM public.tasks
  WHERE user_id = _user_id
    AND status = ANY(status_filter)
    AND coalesce(whitelist_ok, true) = true
    AND wallet_address IS NOT NULL;

  SELECT count(*) INTO lost_count
  FROM public.tasks
  WHERE user_id = _user_id
    AND status = ANY(status_filter)
    AND wallet_address IS NOT NULL
    AND coalesce(whitelist_ok, true) = false;

  SELECT count(*) INTO qual_ref
  FROM public.profiles p
  WHERE p.referred_by = _user_id
    AND (SELECT count(*) FROM public.tasks t
         WHERE t.user_id = p.id
           AND t.status = ANY(status_filter)
           AND coalesce(t.whitelist_ok, true) = true
           AND t.wallet_address IS NOT NULL) >= 10;

  is_activated := m.activated_at IS NOT NULL OR valid_count >= 10;
  auto_active := is_activated AND valid_count >= 10 AND lost_count = 0;

  IF coalesce(m.admin_forced_active, false) THEN
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
          WHERE user_id = parent_id
            AND status = ANY(status_filter)
            AND coalesce(whitelist_ok,true)=true
            AND wallet_address IS NOT NULL;
        SELECT count(*) INTO p_lost FROM public.tasks
          WHERE user_id = parent_id
            AND status = ANY(status_filter)
            AND wallet_address IS NOT NULL
            AND coalesce(whitelist_ok,true)=false;
        SELECT count(*) INTO p_qual FROM public.profiles p
          WHERE p.referred_by = parent_id
            AND (SELECT count(*) FROM public.tasks t
                 WHERE t.user_id=p.id
                   AND t.status = ANY(status_filter)
                   AND coalesce(t.whitelist_ok,true)=true
                   AND t.wallet_address IS NOT NULL) >= 10;
        p_activated := pm.activated_at IS NOT NULL OR p_valid >= 10;
        p_auto := p_activated AND p_valid >= 10 AND p_lost = 0;
        IF coalesce(pm.admin_forced_active, false) THEN
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
              effective_task_count = p_valid,
              qualifying_referees = p_qual,
              is_active = p_new_active,
              activated_at = CASE WHEN activated_at IS NULL AND p_valid >= 10 THEN now() ELSE activated_at END
          WHERE user_id = parent_id;
        ELSE
          UPDATE public.mining_state
          SET effective_task_count = p_valid,
              qualifying_referees = p_qual,
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

-- Backfill: re-run settle for every user so those whose whitelist was restored
-- (or who ever hit the broken enum cast) get their mining activated.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.mining_state LOOP
    PERFORM public.settle_mining(r.user_id);
  END LOOP;
END $$;