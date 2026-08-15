-- Telegram Broadcast Campaigns
CREATE TABLE public.broadcast_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    text TEXT NOT NULL,
    target TEXT NOT NULL, -- 'dm', 'group', 'all'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sending', 'paused', 'completed', 'cancelled'
    total_users INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    last_processed_id UUID,
    error_message TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_campaigns TO authenticated;
GRANT ALL ON public.broadcast_campaigns TO service_role;

ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage campaigns"
ON public.broadcast_campaigns
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Broadcast Logs for granular tracking
CREATE TABLE public.broadcast_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL, -- 'sent', 'failed'
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT ON public.broadcast_logs TO authenticated;
GRANT ALL ON public.broadcast_logs TO service_role;

ALTER TABLE public.broadcast_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view logs"
ON public.broadcast_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
