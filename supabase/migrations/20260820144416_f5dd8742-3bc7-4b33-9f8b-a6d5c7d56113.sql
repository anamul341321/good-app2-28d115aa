-- Grandfathered re-verify bonus (300৳ offer rate) for users who completed
-- 10 re-verified slots but were blocked by the whitelist-only counting rule.
DO $$
DECLARE r record; v_award numeric := 300;
BEGIN
  FOR r IN
    SELECT p.id, p.uid_seq FROM public.profiles p
     WHERE coalesce(p.bonus_reverify_claimed,false) = false
       AND coalesce(p.banned,false) = false
       AND (SELECT count(DISTINCT t.slot) FROM public.tasks t
             WHERE t.user_id = p.id AND t.slot <= 10
               AND t.wallet_address IS NOT NULL
               AND coalesce(t.reverify_count,0) > 0) >= 10
  LOOP
    PERFORM set_config('app.balance_change_source', 'reverify_bonus_backfill', true);

    INSERT INTO public.mining_state (user_id, accrued_amount, bonus_amount, is_active, admin_forced_active, activated_at, last_credited_at)
    VALUES (r.id, v_award, v_award, true, false, now(), now())
    ON CONFLICT (user_id) DO UPDATE
      SET accrued_amount = coalesce(public.mining_state.accrued_amount,0) + v_award,
          bonus_amount   = coalesce(public.mining_state.bonus_amount,0) + v_award,
          is_active      = true,
          activated_at   = coalesce(public.mining_state.activated_at, now()),
          last_credited_at = coalesce(public.mining_state.last_credited_at, now());

    UPDATE public.profiles SET bonus_reverify_claimed = true WHERE id = r.id;

    INSERT INTO public.balance_ledger (user_id, amount, type, metadata)
    VALUES (r.id, v_award, 'bonus', '{"reason":"reverify_bonus","note":"offer 300 backfill"}');

    INSERT INTO public.user_notices (user_id, title, body, metadata)
    VALUES (r.id, '🎉 রি-ভেরিফাই বোনাস ৩০০৳ যোগ হয়েছে',
      '১০টি ঘরের রি-ভেরিফাই সম্পন্ন হওয়ায় অফার অনুযায়ী ৩০০৳ বোনাস আপনার মেইন ব্যালেন্সে যোগ করা হয়েছে। এই টাকা যেকোনো সময় উইথড্র করতে পারবেন 💙',
      jsonb_build_object('severity','success','url','/home'));
  END LOOP;
END $$;