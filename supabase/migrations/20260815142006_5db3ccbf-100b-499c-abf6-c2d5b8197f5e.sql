-- Update get_user_balance_breakdown to return expected keys for MiningCounter UI
CREATE OR REPLACE FUNCTION public.get_user_balance_breakdown(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  res jsonb;
BEGIN
  -- We aggregate from the balance_ledger to provide a consistent breakdown
  SELECT jsonb_build_object(
    'total_accrued', coalesce(sum(amount) FILTER (WHERE amount > 0), 0),
    'withdrawn_total', coalesce(abs(sum(amount) FILTER (WHERE amount < 0 AND type = 'withdrawal')), 0),
    'bonus_part', coalesce(sum(amount) FILTER (WHERE type IN ('bonus', 'referral_bonus', 'transfer_in', 'transfer_out', 'recharge', 'adjustment')), 0),
    'mining_part', coalesce(sum(amount) FILTER (WHERE type IN ('mining', 'referral')), 0),
    'current_balance', coalesce(sum(amount), 0)
  ) INTO res
  FROM public.balance_ledger
  WHERE user_id = _user_id;

  RETURN coalesce(res, '{"total_accrued":0,"withdrawn_total":0,"bonus_part":0,"mining_part":0,"current_balance":0}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_balance_breakdown(uuid) TO authenticated, service_role;