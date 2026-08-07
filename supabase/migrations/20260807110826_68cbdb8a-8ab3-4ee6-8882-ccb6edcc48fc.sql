CREATE TABLE IF NOT EXISTS public.balance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor text,
  source text NOT NULL DEFAULT 'trigger',
  note text,
  accrued_before numeric NOT NULL DEFAULT 0,
  accrued_after numeric NOT NULL DEFAULT 0,
  bonus_before numeric NOT NULL DEFAULT 0,
  bonus_after numeric NOT NULL DEFAULT 0,
  withdrawn_before numeric NOT NULL DEFAULT 0,
  withdrawn_after numeric NOT NULL DEFAULT 0,
  balance_before numeric NOT NULL DEFAULT 0,
  balance_after numeric NOT NULL DEFAULT 0,
  delta numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.balance_audit TO service_role;
ALTER TABLE public.balance_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "balance_audit no client access" ON public.balance_audit;
CREATE POLICY "balance_audit no client access" ON public.balance_audit
  FOR SELECT TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS balance_audit_user_created_idx
  ON public.balance_audit (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_mining_balance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal_before numeric;
  bal_after numeric;
BEGIN
  IF coalesce(OLD.accrued_amount,0) IS NOT DISTINCT FROM coalesce(NEW.accrued_amount,0)
     AND coalesce(OLD.bonus_amount,0) IS NOT DISTINCT FROM coalesce(NEW.bonus_amount,0)
     AND coalesce(OLD.withdrawn_amount,0) IS NOT DISTINCT FROM coalesce(NEW.withdrawn_amount,0)
  THEN
    RETURN NEW;
  END IF;

  bal_before := coalesce(OLD.accrued_amount,0) - coalesce(OLD.withdrawn_amount,0);
  bal_after  := coalesce(NEW.accrued_amount,0) - coalesce(NEW.withdrawn_amount,0);

  -- Skip the tiny per-second mining accrual so the log stays readable; only
  -- record meaningful changes (>= 0.5৳) or any withdrawal/bonus movement.
  IF abs(bal_after - bal_before) < 0.5
     AND coalesce(OLD.bonus_amount,0) IS NOT DISTINCT FROM coalesce(NEW.bonus_amount,0)
     AND coalesce(OLD.withdrawn_amount,0) IS NOT DISTINCT FROM coalesce(NEW.withdrawn_amount,0)
  THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.balance_audit (
    user_id, actor, source,
    accrued_before, accrued_after, bonus_before, bonus_after,
    withdrawn_before, withdrawn_after, balance_before, balance_after, delta
  ) VALUES (
    NEW.user_id, current_user, coalesce(current_setting('app.balance_change_source', true), 'db'),
    coalesce(OLD.accrued_amount,0), coalesce(NEW.accrued_amount,0),
    coalesce(OLD.bonus_amount,0), coalesce(NEW.bonus_amount,0),
    coalesce(OLD.withdrawn_amount,0), coalesce(NEW.withdrawn_amount,0),
    bal_before, bal_after, bal_after - bal_before
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mining_state_balance_audit ON public.mining_state;
CREATE TRIGGER mining_state_balance_audit
AFTER UPDATE ON public.mining_state
FOR EACH ROW EXECUTE FUNCTION public.log_mining_balance_change();