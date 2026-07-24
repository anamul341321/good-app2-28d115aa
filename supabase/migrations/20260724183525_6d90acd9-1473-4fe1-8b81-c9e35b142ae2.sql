
-- ============ TRANSFERS ============
CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 15),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transfers_sender_idx ON public.transfers(sender_id, created_at DESC);
CREATE INDEX transfers_receiver_idx ON public.transfers(receiver_id, created_at DESC);

GRANT SELECT ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own transfers" ON public.transfers FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "admin read all transfers" ON public.transfers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ RECHARGES ============
CREATE TABLE public.recharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mobile text NOT NULL,
  operator text NOT NULL,
  connection_type text NOT NULL DEFAULT 'prepaid',
  amount numeric NOT NULL CHECK (amount >= 20),
  status text NOT NULL DEFAULT 'pending',
  provider_ref text,
  provider_response jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recharges_user_idx ON public.recharges(user_id, created_at DESC);
CREATE INDEX recharges_status_idx ON public.recharges(status, created_at DESC);

GRANT SELECT ON public.recharges TO authenticated;
GRANT ALL ON public.recharges TO service_role;
ALTER TABLE public.recharges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own recharges" ON public.recharges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "admin read all recharges" ON public.recharges FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ RPC: send balance ============
CREATE OR REPLACE FUNCTION public.send_balance_transfer(
  _sender uuid,
  _target text,     -- UID (numeric) or phone number
  _amount numeric,
  _note text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s_kyc boolean;
  r_id uuid;
  r_kyc boolean;
  s_bal numeric;
  s_debt numeric;
  target_clean text;
  transfer_id uuid;
  s_display text;
  r_display text;
BEGIN
  IF _amount IS NULL OR _amount < 15 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সর্বনিম্ন ১৫৳ পাঠানো যাবে');
  END IF;

  SELECT kyc_verified, display_name INTO s_kyc, s_display FROM public.profiles WHERE id = _sender;
  IF NOT coalesce(s_kyc, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ব্যালেন্স পাঠাতে হলে আগে KYC ভেরিফাই করুন');
  END IF;

  target_clean := trim(coalesce(_target, ''));
  IF target_clean = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UID বা ফোন নম্বর দিন');
  END IF;

  -- try uid_seq (numeric) first
  IF target_clean ~ '^\d+$' THEN
    SELECT id, kyc_verified, display_name INTO r_id, r_kyc, r_display
      FROM public.profiles WHERE uid_seq::text = target_clean LIMIT 1;
  END IF;
  IF r_id IS NULL THEN
    SELECT id, kyc_verified, display_name INTO r_id, r_kyc, r_display
      FROM public.profiles WHERE phone_number = target_clean LIMIT 1;
  END IF;
  IF r_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'এই UID/ফোন নম্বরে কোনো ইউজার পাওয়া যায়নি');
  END IF;
  IF r_id = _sender THEN
    RETURN jsonb_build_object('ok', false, 'error', 'নিজেকে পাঠানো যাবে না');
  END IF;
  IF NOT coalesce(r_kyc, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'রিসিভার KYC ভেরিফাইড নয়');
  END IF;

  -- settle mining first so accrued_amount reflects real-time balance
  PERFORM public.settle_mining(_sender);

  SELECT (coalesce(accrued_amount,0) - coalesce(withdrawn_amount,0)) INTO s_bal
    FROM public.mining_state WHERE user_id = _sender FOR UPDATE;
  SELECT coalesce(sum(amount),0) INTO s_debt FROM public.user_debts WHERE user_id = _sender AND coalesce(cleared,false) = false;
  s_bal := coalesce(s_bal,0) - coalesce(s_debt,0);

  IF s_bal < _amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  -- debit sender via withdrawn_amount, credit receiver via accrued_amount
  UPDATE public.mining_state SET withdrawn_amount = coalesce(withdrawn_amount,0) + _amount WHERE user_id = _sender;
  INSERT INTO public.mining_state (user_id, accrued_amount) VALUES (r_id, _amount)
    ON CONFLICT (user_id) DO UPDATE SET accrued_amount = public.mining_state.accrued_amount + _amount;

  INSERT INTO public.transfers (sender_id, receiver_id, amount, note)
    VALUES (_sender, r_id, _amount, nullif(trim(coalesce(_note,'')), ''))
    RETURNING id INTO transfer_id;

  RETURN jsonb_build_object('ok', true, 'transfer_id', transfer_id,
    'receiver_name', coalesce(r_display, 'ইউজার'), 'amount', _amount);
END;
$$;

REVOKE ALL ON FUNCTION public.send_balance_transfer(uuid, text, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.send_balance_transfer(uuid, text, numeric, text) TO authenticated, service_role;

-- ============ RPC: create recharge (debit balance, pending) ============
CREATE OR REPLACE FUNCTION public.create_recharge_request(
  _user uuid,
  _mobile text,
  _operator text,
  _connection_type text,
  _amount numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s_kyc boolean;
  s_bal numeric;
  s_debt numeric;
  rid uuid;
  mob_clean text;
BEGIN
  IF _amount IS NULL OR _amount < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সর্বনিম্ন ২০৳ রিচার্জ করা যাবে');
  END IF;
  mob_clean := regexp_replace(coalesce(_mobile,''), '\D', '', 'g');
  IF length(mob_clean) < 11 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'সঠিক মোবাইল নম্বর দিন');
  END IF;
  IF _operator NOT IN ('grameenphone','robi','banglalink','airtel','teletalk') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'অপারেটর সিলেক্ট করুন');
  END IF;
  IF _connection_type NOT IN ('prepaid','postpaid') THEN
    _connection_type := 'prepaid';
  END IF;

  SELECT kyc_verified INTO s_kyc FROM public.profiles WHERE id = _user;
  IF NOT coalesce(s_kyc, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'রিচার্জের জন্য KYC ভেরিফাই লাগবে');
  END IF;

  PERFORM public.settle_mining(_user);
  SELECT (coalesce(accrued_amount,0) - coalesce(withdrawn_amount,0)) INTO s_bal
    FROM public.mining_state WHERE user_id = _user FOR UPDATE;
  SELECT coalesce(sum(amount),0) INTO s_debt FROM public.user_debts WHERE user_id = _user AND coalesce(cleared,false) = false;
  s_bal := coalesce(s_bal,0) - coalesce(s_debt,0);
  IF s_bal < _amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই');
  END IF;

  UPDATE public.mining_state SET withdrawn_amount = coalesce(withdrawn_amount,0) + _amount WHERE user_id = _user;

  INSERT INTO public.recharges (user_id, mobile, operator, connection_type, amount, status)
    VALUES (_user, mob_clean, _operator, _connection_type, _amount, 'pending')
    RETURNING id INTO rid;

  RETURN jsonb_build_object('ok', true, 'recharge_id', rid);
END;
$$;

REVOKE ALL ON FUNCTION public.create_recharge_request(uuid, text, text, text, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.create_recharge_request(uuid, text, text, text, numeric) TO authenticated, service_role;

-- ============ RPC: mark recharge result (refunds on failure) ============
CREATE OR REPLACE FUNCTION public.mark_recharge_result(
  _recharge_id uuid,
  _status text,
  _provider_ref text,
  _provider_response jsonb,
  _error text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.recharges%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.recharges WHERE id = _recharge_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF r.status <> 'pending' THEN RETURN; END IF;

  UPDATE public.recharges
    SET status = _status,
        provider_ref = _provider_ref,
        provider_response = _provider_response,
        error_message = _error,
        updated_at = now()
    WHERE id = _recharge_id;

  IF _status = 'failed' THEN
    -- refund
    UPDATE public.mining_state
      SET withdrawn_amount = greatest(0, coalesce(withdrawn_amount,0) - r.amount)
      WHERE user_id = r.user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_recharge_result(uuid, text, text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_recharge_result(uuid, text, text, jsonb, text) TO service_role;
