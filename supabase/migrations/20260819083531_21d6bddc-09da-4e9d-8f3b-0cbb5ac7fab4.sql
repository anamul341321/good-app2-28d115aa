-- 1) UID 6032: manual referral bonus was recorded in the ledger but never added to the
--    spendable balance (bonus bucket got +70 while total accrued did not). Fix it.
UPDATE public.mining_state ms
   SET accrued_amount = coalesce(ms.accrued_amount, 0) + 70
  FROM public.profiles p
 WHERE p.id = ms.user_id AND p.uid_seq = 6032;

-- 2) UID 7845 completed 10 whitelisted first verifications but the referrer bonus for
--    UID 7745 was never settled (welcome-bonus settle never ran for that account).
DO $$
DECLARE v_referee uuid; v_referrer uuid;
BEGIN
  SELECT p.id, p.referred_by INTO v_referee, v_referrer
    FROM public.profiles p WHERE p.uid_seq = 7845 AND p.referrer_bonus_paid_at IS NULL;

  IF v_referee IS NOT NULL THEN
    UPDATE public.profiles
       SET bonus_first_verify_claimed = true, referrer_bonus_paid_at = now()
     WHERE id = v_referee;

    IF v_referrer IS NOT NULL AND v_referrer <> v_referee THEN
      PERFORM public.credit_bonus_balance(v_referrer, 70, 'referral_bonus', NULL,
        jsonb_build_object('referee_id', v_referee, 'rate', 70,
                           'note', 'audit backfill - eligibility met but auto-settle missed',
                           'paid_at', now()));
      INSERT INTO public.user_notices (user_id, title, body, metadata)
      VALUES (v_referrer, 'রেফারেল বোনাস যোগ হয়েছে',
              'আপনার একজন রেফার সদস্য ১০টি ভেরিফিকেশন সম্পন্ন করেছিলেন, কিন্তু বোনাসটি স্বয়ংক্রিয়ভাবে যোগ হয়নি। অডিটে ধরা পড়ার পর ৭০৳ রেফারেল বোনাস আপনার মেইন ব্যালেন্সে যোগ করে দেওয়া হয়েছে।',
              jsonb_build_object('severity', 'success', 'source', 'audit_backfill'));
    END IF;
  END IF;
END $$;

-- 3) Ledger/balance reconciliation rows for accounts corrected manually earlier
--    (rejected withdrawals, reversed claims). Keeps admin reports honest.
INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
SELECT ms.user_id,
       round((ms.accrued_amount - ms.withdrawn_amount) - l.s, 2),
       'reconcile',
       jsonb_build_object('note', 'audit reconciliation - manual admin correction not logged')
  FROM public.mining_state ms
  JOIN (SELECT user_id, sum(amount) s FROM public.balance_ledger GROUP BY 1) l
    ON l.user_id = ms.user_id
 WHERE abs((ms.accrued_amount - ms.withdrawn_amount) - l.s) > 1;