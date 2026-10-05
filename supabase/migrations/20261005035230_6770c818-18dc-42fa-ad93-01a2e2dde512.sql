CREATE TABLE public.call_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  peer_uid integer NOT NULL,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, peer_uid)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_contacts TO authenticated;
GRANT ALL ON public.call_contacts TO service_role;
ALTER TABLE public.call_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contacts" ON public.call_contacts FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());