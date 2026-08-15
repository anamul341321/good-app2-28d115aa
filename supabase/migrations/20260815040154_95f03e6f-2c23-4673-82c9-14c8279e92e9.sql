-- RLS for social_media storage bucket
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'social_media');

CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'social_media' AND auth.uid() = owner);

CREATE POLICY "Allow public read of social media" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'social_media');
