/*
# Create profile-pics storage bucket

1. Storage
- Create a public bucket `profile-pics` for user profile pictures.
2. Security
- Storage policies: authenticated users can upload/update/read their own profile pics.
- Files are scoped by user ID folder: `profile-pics/<user_id>/<filename>`.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pics', 'profile-pics', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "Users can upload own profile pics" ON storage.objects;
CREATE POLICY "Users can upload own profile pics"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-pics' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read all profile pics (they're public)
DROP POLICY IF EXISTS "Anyone can read profile pics" ON storage.objects;
CREATE POLICY "Anyone can read profile pics"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'profile-pics');

-- Allow authenticated users to update their own profile pics
DROP POLICY IF EXISTS "Users can update own profile pics" ON storage.objects;
CREATE POLICY "Users can update own profile pics"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-pics' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'profile-pics' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own profile pics
DROP POLICY IF EXISTS "Users can delete own profile pics" ON storage.objects;
CREATE POLICY "Users can delete own profile pics"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-pics' AND (storage.foldername(name))[1] = auth.uid()::text);
