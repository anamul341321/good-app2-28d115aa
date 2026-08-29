ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text DEFAULT '';
COMMENT ON COLUMN public.profiles.bio IS 'User profile bio / about text';