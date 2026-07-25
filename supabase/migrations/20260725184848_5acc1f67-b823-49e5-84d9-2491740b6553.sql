REVOKE ALL ON FUNCTION public.create_recharge_request(uuid, text, text, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_recharge_request(uuid, text, text, text, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.create_recharge_request(uuid, text, text, text, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_recharge_request(uuid, text, text, text, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.mark_recharge_result(uuid, text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_recharge_result(uuid, text, text, jsonb, text) FROM anon;
REVOKE ALL ON FUNCTION public.mark_recharge_result(uuid, text, text, jsonb, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_recharge_result(uuid, text, text, jsonb, text) TO service_role;

REVOKE ALL ON FUNCTION public.send_balance_transfer(uuid, text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_balance_transfer(uuid, text, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public.send_balance_transfer(uuid, text, numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.send_balance_transfer(uuid, text, numeric, text) TO service_role;