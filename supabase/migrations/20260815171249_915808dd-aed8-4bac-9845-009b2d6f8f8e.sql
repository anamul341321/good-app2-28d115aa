CREATE POLICY "Users can view their purchased codes" ON public.card_codes
FOR SELECT TO authenticated USING (used_by = auth.uid());

GRANT SELECT ON public.card_codes TO authenticated;
GRANT SELECT ON public.card_products TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.purchase_card(_user_id uuid, _product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p public.card_products%ROWTYPE;
  v_code public.card_codes%ROWTYPE;
  v_break jsonb;
  v_balance numeric := 0;
  v_debt numeric := 0;
BEGIN
  SELECT * INTO p FROM public.card_products WHERE id = _product_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'কার্ডটি পাওয়া যায়নি');
  END IF;

  PERFORM public.settle_mining(_user_id);

  v_break := public.get_user_balance_breakdown(_user_id);
  v_balance := coalesce((v_break->>'current_balance')::numeric, 0);
  SELECT coalesce(sum(amount), 0) INTO v_debt
    FROM public.user_debts WHERE user_id = _user_id AND status = 'active';
  v_balance := v_balance - v_debt;

  IF v_balance < p.selling_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  SELECT * INTO v_code
    FROM public.card_codes
   WHERE product_id = _product_id AND is_used = false
   ORDER BY created_at
   FOR UPDATE SKIP LOCKED
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'স্টক শেষ');
  END IF;

  UPDATE public.card_codes
     SET is_used = true, used_by = _user_id, used_at = now()
   WHERE id = v_code.id;

  UPDATE public.mining_state
     SET withdrawn_amount = coalesce(withdrawn_amount, 0) + p.selling_price
   WHERE user_id = _user_id;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (_user_id, -p.selling_price, 'card_purchase', v_code.id,
          jsonb_build_object('product_id', p.id, 'name', p.name, 'operator', p.operator, 'card_type', p.card_type));

  RETURN jsonb_build_object('ok', true, 'code', v_code.code, 'name', p.name,
    'price', p.selling_price, 'operator', p.operator, 'card_type', p.card_type, 'amount_label', p.amount_label);
END;
$$;