CREATE TABLE public.friend_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friend_links_not_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friend_links_unique_pair UNIQUE (requester_id, addressee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_links TO authenticated;
GRANT ALL ON public.friend_links TO service_role;

ALTER TABLE public.friend_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "See own friend links" ON public.friend_links
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Send friend request" ON public.friend_links
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Receiver responds" ON public.friend_links
  FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

CREATE POLICY "Either side removes" ON public.friend_links
  FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE INDEX friend_links_addressee_idx ON public.friend_links (addressee_id, status);
CREATE INDEX friend_links_requester_idx ON public.friend_links (requester_id, status);