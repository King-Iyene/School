-- Create storage bucket for school assets (logos, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('school-assets', 'school-assets', true, 5242880, ARRAY['image/jpeg','image/jpg','image/png','image/svg+xml','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for school-assets
DO $$
BEGIN
  -- Select Policy (Public read)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Public read school assets'
  ) THEN
    CREATE POLICY "Public read school assets"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'school-assets');
  END IF;

  -- Insert Policy (Authenticated users)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Authenticated users upload school assets'
  ) THEN
    CREATE POLICY "Authenticated users upload school assets"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'school-assets');
  END IF;

  -- Update Policy (Authenticated users)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Authenticated users update school assets'
  ) THEN
    CREATE POLICY "Authenticated users update school assets"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'school-assets');
  END IF;

  -- Delete Policy (Authenticated users)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Authenticated users delete school assets'
  ) THEN
    CREATE POLICY "Authenticated users delete school assets"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'school-assets');
  END IF;
END $$;
