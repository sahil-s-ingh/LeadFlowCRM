/*
# Create broker-logos storage bucket

1. Storage
- Create a public bucket `broker-logos` for broker logo images.
2. Security
- Storage policies: authenticated users can upload/update/read/delete their own broker logos.
- Files are scoped by user ID folder: `broker-logos/<user_id>/<filename>`.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('broker-logos', 'broker-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own broker logos" ON storage.objects;
CREATE POLICY "Users can upload own broker logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'broker-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Anyone can read broker logos" ON storage.objects;
CREATE POLICY "Anyone can read broker logos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'broker-logos');

DROP POLICY IF EXISTS "Users can update own broker logos" ON storage.objects;
CREATE POLICY "Users can update own broker logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'broker-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'broker-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own broker logos" ON storage.objects;
CREATE POLICY "Users can delete own broker logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'broker-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
