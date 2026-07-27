REVOKE ALL ON TABLE public.admin_settings FROM anon, authenticated;
GRANT ALL ON TABLE public.admin_settings TO service_role;

DROP POLICY IF EXISTS "No direct client access to admin settings" ON public.admin_settings;
CREATE POLICY "No direct client access to admin settings"
ON public.admin_settings
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE SCHEMA IF NOT EXISTS extensions;