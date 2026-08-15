REVOKE EXECUTE ON FUNCTION public.credit_bonus_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_bonus_balance(uuid, numeric, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_card(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_withdrawal_request_atomic(uuid, numeric, numeric, public.wallet_provider, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_mining_earnings(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_balance_breakdown(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_reverify_bonus(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transition_task_whitelist(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_unanswered_calls() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.credit_bonus_balance(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_bonus_balance(uuid, numeric, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_card(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_request_atomic(uuid, numeric, numeric, public.wallet_provider, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_mining_earnings(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_balance_breakdown(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_reverify_bonus(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_task_whitelist(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_unanswered_calls() TO service_role;