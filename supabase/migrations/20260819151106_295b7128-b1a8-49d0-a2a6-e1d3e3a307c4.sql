CREATE OR REPLACE FUNCTION public.spend_locked_mining(_user_id uuid, _amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_left numeric := greatest(coalesce(_amount, 0), 0);
  v_take numeric;
BEGIN
  IF v_left <= 0 THEN RETURN 0; END IF;

  FOR r IN
    SELECT id, greatest(coalesce(locked_mined, 0), 0) AS locked
      FROM public.tasks
     WHERE user_id = _user_id AND coalesce(locked_mined, 0) > 0
     ORDER BY slot
     FOR UPDATE
  LOOP
    EXIT WHEN v_left <= 0;
    v_take := least(r.locked, v_left);
    UPDATE public.tasks
       SET locked_mined = greatest(coalesce(locked_mined, 0) - v_take, 0)
     WHERE id = r.id;
    v_left := v_left - v_take;
  END LOOP;

  RETURN greatest(coalesce(_amount, 0), 0) - v_left;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_locked_mining_on_spend()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.mining_withdrawn, 0) > coalesce(OLD.mining_withdrawn, 0) THEN
    PERFORM public.spend_locked_mining(
      NEW.user_id,
      coalesce(NEW.mining_withdrawn, 0) - coalesce(OLD.mining_withdrawn, 0)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_locked_mining_on_spend ON public.mining_state;
CREATE TRIGGER trg_sync_locked_mining_on_spend
AFTER UPDATE OF mining_withdrawn ON public.mining_state
FOR EACH ROW
EXECUTE FUNCTION public.sync_locked_mining_on_spend();

WITH b AS (
  SELECT ms.user_id,
         greatest(coalesce(ms.accrued_amount, 0) - coalesce(ms.withdrawn_amount, 0), 0) AS bal,
         greatest(
           least(
             greatest(coalesce(ms.accrued_amount, 0) - coalesce(ms.withdrawn_amount, 0), 0),
             coalesce(ms.bonus_amount, 0)
               - greatest(coalesce(ms.withdrawn_amount, 0)
                          - least(coalesce(ms.mining_withdrawn, 0), coalesce(ms.withdrawn_amount, 0)), 0)
           ), 0) AS main
    FROM public.mining_state ms
), l AS (
  SELECT user_id, sum(greatest(coalesce(locked_mined, 0), 0)) AS locked
    FROM public.tasks GROUP BY user_id
), excess AS (
  SELECT l.user_id, l.locked - (b.bal - b.main) AS extra
    FROM l JOIN b USING (user_id)
   WHERE l.locked > (b.bal - b.main) + 0.01
)
SELECT public.spend_locked_mining(user_id, extra) FROM excess;

UPDATE public.mining_state ms
   SET bonus_amount = greatest(
         least(
           coalesce(ms.bonus_amount, 0),
           greatest(coalesce(ms.accrued_amount, 0) - coalesce(ms.withdrawn_amount, 0), 0)
             + greatest(coalesce(ms.withdrawn_amount, 0)
                        - least(coalesce(ms.mining_withdrawn, 0), coalesce(ms.withdrawn_amount, 0)), 0)
         ), 0)
 WHERE coalesce(ms.bonus_amount, 0)
       > greatest(coalesce(ms.accrued_amount, 0) - coalesce(ms.withdrawn_amount, 0), 0)
         + greatest(coalesce(ms.withdrawn_amount, 0)
                    - least(coalesce(ms.mining_withdrawn, 0), coalesce(ms.withdrawn_amount, 0)), 0)
         + 0.01;