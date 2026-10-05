CREATE OR REPLACE FUNCTION public.burn_slot_pending_on_reset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pending numeric := 0;
  v_available numeric := 0;
  v_burn numeric := 0;
BEGIN
  IF OLD.status <> 'empty'::public.task_status
     AND NEW.status = 'empty'::public.task_status THEN
    v_pending := round(
      greatest(coalesce(OLD.pending_mined, 0), 0)
      + greatest(coalesce(OLD.pending_carry, 0), 0),
      2
    );

    IF v_pending > 0 THEN
      SELECT greatest(coalesce(pending_mining, 0), 0)
        INTO v_available
        FROM public.mining_state
       WHERE user_id = OLD.user_id
       FOR UPDATE;

      v_burn := least(v_pending, v_available);
      IF v_burn > 0 THEN
        PERFORM set_config('app.balance_change_source', 'slot_reset_pending_burn', true);
        UPDATE public.mining_state
           SET pending_mining = greatest(coalesce(pending_mining, 0) - v_burn, 0)
         WHERE user_id = OLD.user_id;
      END IF;

      INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
      VALUES (
        OLD.user_id,
        0,
        'slot_reset_pending_burn',
        OLD.id,
        jsonb_build_object('removed_pending', v_burn, 'slot', OLD.slot)
      );
    END IF;

    NEW.pending_mined := 0;
    NEW.pending_carry := 0;
    NEW.released_mined := 0;
  END IF;
  RETURN NEW;
END;
$function$;