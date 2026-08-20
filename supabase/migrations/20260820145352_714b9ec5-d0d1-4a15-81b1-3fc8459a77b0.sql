-- Reverse the 300৳ re-verify bonus for the 4 users whose 10th re-verify was
-- completed AFTER the offer window ended.
DO $$
DECLARE
  r record;
  v_uids bigint[] := ARRAY[6649, 5286, 1945, 1657];
  v_ref numeric;
BEGIN
  -- 1) UID 6649 placed a withdrawal right after receiving the bonus; reject it
  --    and put the money back so the reversal can be applied cleanly.
  FOR r IN
    SELECT w.id, w.user_id, w.amount
      FROM public.withdrawals w
      JOIN public.profiles p ON p.id = w.user_id
     WHERE p.uid_seq = ANY(v_uids)
       AND w.status = 'pending'
       AND w.created_at >= '2026-08-20 14:30:00+00'
  LOOP
    UPDATE public.withdrawals
       SET status = 'rejected',
           reject_reason = 'অফার শেষ হওয়ার পর ভুলবশত যোগ হওয়া ৩০০৳ বোনাস ফিরিয়ে নেওয়া হয়েছে — অনুগ্রহ করে আবার রিকোয়েস্ট দিন।',
           processed_at = now(),
           admin_note = 'auto-reject: reverify bonus reversal'
     WHERE id = r.id;

    UPDATE public.mining_state
       SET withdrawn_amount = greatest(coalesce(withdrawn_amount,0) - r.amount, 0)
     WHERE user_id = r.user_id;
  END LOOP;

  -- 2) Take back the 300৳ and remove it from the earnings history
  FOR r IN
    SELECT p.id, p.uid_seq FROM public.profiles p WHERE p.uid_seq = ANY(v_uids)
  LOOP
    PERFORM set_config('app.balance_change_source', 'reverify_bonus_reversal', true);

    UPDATE public.mining_state
       SET accrued_amount = greatest(coalesce(accrued_amount,0) - 300, 0),
           bonus_amount   = greatest(coalesce(bonus_amount,0)   - 300, 0)
     WHERE user_id = r.id;

    DELETE FROM public.balance_ledger
     WHERE user_id = r.id
       AND type = 'bonus'
       AND metadata->>'note' = 'offer 300 backfill';

    UPDATE public.profiles SET bonus_reverify_claimed = false WHERE id = r.id;

    INSERT INTO public.user_notices (user_id, title, body, metadata)
    VALUES (r.id, 'ℹ️ ৩০০৳ বোনাস সমন্বয় করা হয়েছে',
      'দুঃখিত — ৩০০৳ রি-ভেরিফাই বোনাস অফারটি শেষ হওয়ার পর আপনার ১০ম রি-ভেরিফাই সম্পন্ন হয়েছে, তাই ভুলবশত যোগ হওয়া ৩০০৳ ফিরিয়ে নেওয়া হয়েছে। অফার আবার চালু হলে নতুন করে যোগ্য হলে বোনাস পাবেন। আপনার মাইনিং ও ১০৳ স্লট বোনাস আগের মতোই ঠিক আছে 💙',
      jsonb_build_object('severity','warning','url','/home'));
  END LOOP;
END $$;