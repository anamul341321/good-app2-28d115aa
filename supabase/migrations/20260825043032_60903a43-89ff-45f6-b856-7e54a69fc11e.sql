CREATE TABLE IF NOT EXISTS public.wallet_onchain_scan (
  wallet_address text PRIMARY KEY,
  nonce integer NOT NULL DEFAULT 0,
  token_out_count integer NOT NULL DEFAULT 0,
  token_in_count integer NOT NULL DEFAULT 0,
  celo_in_external boolean NOT NULL DEFAULT false,
  in_senders jsonb NOT NULL DEFAULT '[]'::jsonb,
  pristine boolean NOT NULL DEFAULT false,
  scanned_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.wallet_onchain_scan TO service_role;
ALTER TABLE public.wallet_onchain_scan ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_wallet_onchain_scan_pristine ON public.wallet_onchain_scan (pristine);
CREATE INDEX IF NOT EXISTS idx_wallet_onchain_scan_scanned_at ON public.wallet_onchain_scan (scanned_at);