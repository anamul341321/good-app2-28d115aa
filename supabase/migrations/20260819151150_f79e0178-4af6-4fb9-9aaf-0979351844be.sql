REVOKE EXECUTE ON FUNCTION public.spend_locked_mining(uuid, numeric) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_locked_mining_on_spend() FROM anon, authenticated;