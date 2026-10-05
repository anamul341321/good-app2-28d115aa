CREATE OR REPLACE FUNCTION public.release_pending_on_reverify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Exact per-slot release is handled by tasks_unwhitelist_revert_claims().
  -- Keep this legacy trigger target harmless so no user's aggregate pending
  -- balance can be divided approximately between slots.
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.burn_slot_locked_share(_task_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_pending numeric := 0;
  v_available numeric := 0;
  v_burn numeric := 0;
BEGIN
  SELECT user_id,
         round(greatest(coalesce(pending_mined, 0), 0) + greatest(coalesce(pending_carry, 0), 0), 2)
    INTO v_user_id, v_pending
    FROM public.tasks
   WHERE id = _task_id
   FOR UPDATE;

  IF v_user_id IS NULL OR v_pending <= 0 THEN
    RETURN 0;
  END IF;

  SELECT greatest(coalesce(pending_mining, 0), 0)
    INTO v_available
    FROM public.mining_state
   WHERE user_id = v_user_id
   FOR UPDATE;

  v_burn := least(v_pending, v_available);

  IF v_burn > 0 THEN
    PERFORM set_config('app.balance_change_source', 'slot_reset_pending_burn', true);
    UPDATE public.mining_state
       SET pending_mining = greatest(coalesce(pending_mining, 0) - v_burn, 0)
     WHERE user_id = v_user_id;
  END IF;

  UPDATE public.tasks
     SET pending_mined = 0,
         pending_carry = 0
   WHERE id = _task_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (
    v_user_id,
    0,
    'slot_reset_pending_burn',
    _task_id,
    jsonb_build_object('removed_pending', v_burn)
  );

  RETURN v_burn;
END;
$function$;

CREATE OR REPLACE FUNCTION public.burn_slot_pending_on_reset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status <> 'empty'::public.task_status
     AND NEW.status = 'empty'::public.task_status THEN
    PERFORM public.burn_slot_locked_share(OLD.id);
    NEW.pending_mined := 0;
    NEW.pending_carry := 0;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_burn_slot_pending_on_reset ON public.tasks;
CREATE TRIGGER trg_burn_slot_pending_on_reset
BEFORE UPDATE OF status ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.burn_slot_pending_on_reset();

REVOKE ALL ON FUNCTION public.burn_slot_locked_share(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.burn_slot_locked_share(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.burn_slot_pending_on_reset() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.burn_slot_pending_on_reset() TO service_role;