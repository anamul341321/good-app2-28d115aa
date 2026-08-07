WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
  FROM public.slot_reset_requests
  WHERE status = 'pending'
)
UPDATE public.slot_reset_requests AS requests
SET status = 'cancelled', resolved_at = now()
FROM ranked
WHERE requests.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS slot_reset_requests_one_pending_per_user_idx
ON public.slot_reset_requests (user_id)
WHERE status = 'pending';