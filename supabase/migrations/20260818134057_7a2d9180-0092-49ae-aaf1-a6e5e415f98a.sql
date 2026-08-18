DO $$
DECLARE
  u uuid := '3de69ade-82f5-4779-a549-b3407b8d1c05';
  w uuid := '2d638826-1ed0-4731-8001-c22e45edd405';
  v_gross numeric := 530;
  v_mining_part numeric := 7.41;
  v_dup numeric := 178.66;
BEGIN
  -- 1) Reject the pending withdrawal
  UPDATE public.withdrawals
     SET status = 'rejected',
         processed_at = now(),
         reject_reason = 'ডাবল ক্রেডিট সংশোধনের কারণে বাতিল — সঠিক ব্যালেন্স ফেরত দেওয়া হয়েছে, আবার উইথড্র দিন',
         admin_note = coalesce(admin_note,'') || ' | auto-reject: duplicate slot claim correction'
   WHERE id = w AND user_id = u AND status = 'pending';

  -- 2) Refund the gross amount that was held for this withdrawal
  PERFORM set_config('app.balance_change_source', 'withdrawal_reject_refund', true);
  UPDATE public.mining_state
     SET withdrawn_amount = greatest(coalesce(withdrawn_amount,0) - v_gross, 0),
         mining_withdrawn = greatest(coalesce(mining_withdrawn,0) - v_mining_part, 0)
   WHERE user_id = u;

  INSERT INTO public.balance_ledger (user_id, amount, type, source_id, metadata)
  VALUES (u, v_gross, 'withdrawal_refund', w,
          jsonb_build_object('reason','rejected_duplicate_correction','gross',v_gross,'mining_part',v_mining_part));

  -- 3) Remove the duplicated credit from the total balance (previous fix only
  --    reduced the main/bonus part, the total was still inflated)
  PERFORM set_config('app.balance_change_source', 'duplicate_claim_reversal_apply', true);
  UPDATE public.mining_state
     SET accrued_amount = greatest(coalesce(accrued_amount,0) - v_dup, 0)
   WHERE user_id = u;

  INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
  VALUES (u, -v_dup, 'adjustment',
          jsonb_build_object('reason','duplicate_slot_claim_reversal_applied','slots',5));

  -- 4) Notice for the user
  INSERT INTO public.user_notices (user_id, title, body, metadata)
  VALUES (
    u,
    'আপনার উইথড্র বাতিল ও ব্যালেন্স সংশোধন',
    'প্রিয় ইউজার, সিস্টেমের একটি কারিগরি ভুলে আপনার ৫টি ঘরের ক্লেইম দুইবার হিসাব হয়ে গিয়েছিল, ফলে ১৭৮.৬৬৳ বাড়তি ব্যালেন্স যোগ হয়েছিল। তাই আপনার ৪৭৭৳ (মোট ৫৩০৳) উইথড্র রিকোয়েস্টটি বাতিল করা হয়েছে এবং টাকা আপনার ব্যালেন্সে ফেরত দেওয়া হয়েছে। বাড়তি ১৭৮.৬৬৳ কেটে নেওয়া হয়েছে — আপনার প্রকৃত/বৈধ টাকা সম্পূর্ণ অটুট আছে। এখন আপনি আপনার সঠিক ব্যালেন্স থেকে আবার উইথড্র রিকোয়েস্ট দিতে পারবেন। অসুবিধার জন্য আন্তরিক দুঃখিত।',
    jsonb_build_object('severity','info','type','balance_correction','withdrawal_id',w,'deducted',v_dup)
  );
END $$;