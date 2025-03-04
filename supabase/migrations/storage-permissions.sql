-- Create avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'avatars', 'avatars', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE name = 'avatars'
);

-- Drop existing RLS policies on avatars bucket
BEGIN;
  DROP POLICY IF EXISTS "Anyone can read avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
COMMIT;

-- Create new RLS policies for avatars bucket
BEGIN;
  -- Allow anyone to read from the avatars bucket
  CREATE POLICY "Anyone can read avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

  -- Allow authenticated users to upload to the avatars bucket
  CREATE POLICY "Authenticated users can upload avatars"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'avatars');

  -- Allow users to update their own avatars
  CREATE POLICY "Users can update their own avatars"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'avatars')
    WITH CHECK (bucket_id = 'avatars');

  -- Allow users to delete their own avatars
  CREATE POLICY "Users can delete their own avatars"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'avatars');
COMMIT;

-- Verify RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Show policies for verification
SELECT * FROM pg_policies WHERE tablename = 'objects'; 