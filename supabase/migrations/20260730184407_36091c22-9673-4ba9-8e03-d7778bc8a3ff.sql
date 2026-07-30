UPDATE public.whitelist_runs SET status='done', finished_at=now() WHERE status='running';
UPDATE public.whitelist_runs SET wallets_checked = LEAST(wallets_checked, wallets_total) WHERE wallets_total > 0 AND wallets_checked > wallets_total;
UPDATE public.whitelist_runs SET pending_checked = LEAST(pending_checked, pending_total) WHERE pending_checked > pending_total;