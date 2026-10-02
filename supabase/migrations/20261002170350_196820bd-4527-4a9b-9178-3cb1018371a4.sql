CREATE OR REPLACE FUNCTION public.release_pending_on_reverify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_unver int; v_pend numeric; v_share numeric;
BEGIN
  IF coalesce(OLD.whitelist_ok,false) = false AND NEW.whitelist_ok = true AND NEW.wallet_address IS NOT NULL THEN
    SELECT coalesce(pending_mining,0) INTO v_pend FROM mining_state WHERE user_id = NEW.user_id FOR UPDATE;
    IF coalesce(v_pend,0) <= 0 THEN RETURN NEW; END IF;
    SELECT count(*) INTO v_unver FROM tasks
     WHERE user_id = NEW.user_id AND wallet_address IS NOT NULL AND coalesce(whitelist_ok,false) = false AND id <> NEW.id;
    IF v_unver = 0 THEN v_share := v_pend;
    ELSE v_share := round(v_pend / (v_unver + 1), 2); END IF;
    v_share := least(greatest(v_share,0), v_pend);
    PERFORM set_config('app.balance_change_source', 'reverify_pending_release', true);
    UPDATE mining_state SET pending_mining = greatest(coalesce(pending_mining,0) - v_share, 0) WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_release_pending_on_reverify ON public.tasks;
CREATE TRIGGER trg_release_pending_on_reverify AFTER UPDATE OF whitelist_ok ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.release_pending_on_reverify();