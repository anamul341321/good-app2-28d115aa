DO $repair$
DECLARE
  r record;
  v_count integer;
  v_add numeric;
BEGIN
  FOR r IN
    WITH totals AS (
      SELECT ms.user_id,
             greatest(coalesce(ms.self_mining_accrued, 0), 0) AS self_total,
             coalesce((SELECT sum(greatest(t.locked_mined, 0)) FROM public.tasks t WHERE t.user_id = ms.user_id), 0) AS locked_total,
             coalesce((SELECT sum(greatest(sc.mining_amount, 0)) FROM public.slot_claims sc WHERE sc.user_id = ms.user_id AND sc.status = 'pending'), 0) AS pending_total,
             coalesce((SELECT sum(greatest(sc.mining_amount, 0)) FROM public.slot_claims sc WHERE sc.user_id = ms.user_id AND sc.status = 'claimed'), 0) AS claimed_total
        FROM public.mining_state ms
    )
    SELECT *, self_total - locked_total - pending_total - claimed_total AS gap
      FROM totals
     WHERE self_total - locked_total - pending_total - claimed_total > 0.02
  LOOP
    SELECT count(*) INTO v_count
      FROM public.tasks t
     WHERE t.user_id = r.user_id
       AND coalesce(t.reverify_count, 0) > 0;

    IF v_count > 0 THEN
      v_add := r.gap / v_count;
      UPDATE public.tasks t
         SET locked_mined = coalesce(t.locked_mined, 0) + v_add
       WHERE t.user_id = r.user_id
         AND coalesce(t.reverify_count, 0) > 0;
    END IF;
  END LOOP;
END;
$repair$;