CREATE OR REPLACE FUNCTION public.get_user_balance_breakdown(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m mining_state%ROWTYPE;
  total_accrued numeric := 0;
  withdrawn_total numeric := 0;
  bonus_part numeric := 0;
  mining_part numeric := 0;
  current_bal numeric := 0;
  v_main_withdrawn numeric := 0;
BEGIN
  SELECT * INTO m FROM public.mining_state WHERE user_id = _user_id;
  
  SELECT coalesce(sum(amount), 0) INTO current_bal
    FROM public.balance_ledger
    WHERE user_id = _user_id;

  withdrawn_total := coalesce(m.withdrawn_amount, 0);
  
  v_main_withdrawn := greatest(withdrawn_total - least(coalesce(m.mining_withdrawn, 0), withdrawn_total), 0);
  bonus_part := greatest(coalesce(m.bonus_amount, 0) - v_main_withdrawn, 0);
  
  bonus_part := least(bonus_part, greatest(current_bal, 0));
  mining_part := greatest(current_bal - bonus_part, 0);

  RETURN jsonb_build_object(
    'current_balance', current_bal,
    'bonus_part', bonus_part,
    'mining_part', mining_part,
    'withdrawn_total', withdrawn_total,
    'total_accrued', coalesce(m.accrued_amount, 0)
  );
END;
$function$;