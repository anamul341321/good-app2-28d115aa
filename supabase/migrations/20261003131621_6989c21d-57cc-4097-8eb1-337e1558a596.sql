CREATE OR REPLACE FUNCTION public.admin_move_pending_to_main(_user_id uuid, _amount numeric DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pend numeric; v_move numeric;
BEGIN
  SELECT coalesce(pending_mining,0) INTO v_pend FROM mining_state WHERE user_id = _user_id FOR UPDATE;
  IF coalesce(v_pend,0) <= 0 THEN RETURN 0; END IF;
  v_move := CASE WHEN _amount IS NULL OR _amount <= 0 THEN v_pend ELSE least(_amount, v_pend) END;
  v_move := round(v_move, 2);
  PERFORM set_config('app.balance_change_source', 'admin_pending_release', true);
  UPDATE mining_state SET pending_mining = greatest(coalesce(pending_mining,0) - v_move, 0),
         released_main = coalesce(released_main,0) + v_move
   WHERE user_id = _user_id;
  RETURN v_move;
END $$;
REVOKE ALL ON FUNCTION public.admin_move_pending_to_main(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_move_pending_to_main(uuid, numeric) TO service_role;

DO $$ DECLARE r record; BEGIN
  FOR r IN
    SELECT m.user_id FROM mining_state m
     WHERE coalesce(m.pending_mining,0) > 0
       AND EXISTS (SELECT 1 FROM tasks t WHERE t.user_id = m.user_id AND t.wallet_address IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.user_id = m.user_id AND t.wallet_address IS NOT NULL AND coalesce(t.whitelist_ok,false) = false)
  LOOP PERFORM public.admin_move_pending_to_main(r.user_id, NULL); END LOOP;
END $$;