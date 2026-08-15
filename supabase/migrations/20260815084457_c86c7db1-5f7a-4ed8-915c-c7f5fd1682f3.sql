-- Allow authenticated users to upload to app-releases
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow authenticated uploads to app-releases'
    ) THEN
        CREATE POLICY "Allow authenticated uploads to app-releases" ON storage.objects
        FOR INSERT TO authenticated WITH CHECK (bucket_id = 'app-releases');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow public downloads from app-releases'
    ) THEN
        CREATE POLICY "Allow public downloads from app-releases" ON storage.objects
        FOR SELECT TO public USING (bucket_id = 'app-releases');
    END IF;
END $$;