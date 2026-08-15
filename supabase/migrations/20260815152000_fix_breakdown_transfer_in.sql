-- Ensure all transfer_in entries are counted as bonus/main balance in the breakdown
CREATE OR REPLACE FUNCTION public.get_user_balance_breakdown(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  res jsonb;
BEGIN
  -- Main/Bonus pool includes: welcome bonuses, re-verify bonuses, transfers IN.
  -- Mining pool includes: passive mining earnings, referral share of mining earnings.
  
  SELECT jsonb_build_object(
    'total_accrued', coalesce(sum(amount) FILTER (WHERE amount > 0), 0),
    'withdrawn_total', coalesce(abs(sum(amount) FILTER (WHERE amount < 0 AND type = 'withdrawal')), 0),
    'bonus_part', coalesce(sum(amount) FILTER (WHERE type IN ('bonus', 'referral_bonus', 'transfer_in')), 0),
    'mining_part', coalesce(sum(amount) FILTER (WHERE type IN ('mining', 'referral')), 0),
    'current_balance', coalesce(sum(amount), 0),
    'total_spent', coalesce(abs(sum(amount) FILTER (WHERE amount < 0)), 0)
  ) INTO res
  FROM public.balance_ledger
  WHERE user_id = _user_id;

  RETURN coalesce(res, '{"total_accrued":0,"withdrawn_total":0,"bonus_part":0,"mining_part":0,"current_balance":0,"total_spent":0}'::jsonb);
END;
$$;
