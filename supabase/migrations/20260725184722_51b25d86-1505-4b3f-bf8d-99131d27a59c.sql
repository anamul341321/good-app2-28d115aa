WITH invalid_bonus_users AS (
  SELECT
    p.id AS user_id,
    p.uid_seq,
    p.display_name,
    count(DISTINCT t.slot) FILTER (WHERE coalesce(t.reverify_count, 0) > 0)::integer AS unique_reverify_slots
  FROM public.profiles p
  LEFT JOIN public.tasks t ON t.user_id = p.id
  WHERE p.bonus_reverify_claimed = true
  GROUP BY p.id, p.uid_seq, p.display_name
  HAVING count(DISTINCT t.slot) FILTER (WHERE coalesce(t.reverify_count, 0) > 0) < 10
), corrected_balances AS (
  UPDATE public.mining_state ms
  SET accrued_amount = greatest(0, coalesce(ms.accrued_amount, 0) - 400)
  FROM invalid_bonus_users invalid
  WHERE ms.user_id = invalid.user_id
  RETURNING ms.user_id
), reset_claims AS (
  UPDATE public.profiles p
  SET bonus_reverify_claimed = false
  FROM invalid_bonus_users invalid
  WHERE p.id = invalid.user_id
  RETURNING p.id
)
INSERT INTO public.admin_credits (user_id, amount, note)
SELECT
  invalid.user_id,
  -400,
  'Re-verify bonus correction: 10 unique slots পূর্ণ হওয়ার আগে 400৳ যোগ হয়েছিল; completed ' || invalid.unique_reverify_slots || '/10 unique slots.'
FROM invalid_bonus_users invalid
JOIN corrected_balances corrected ON corrected.user_id = invalid.user_id
JOIN reset_claims reset ON reset.id = invalid.user_id;