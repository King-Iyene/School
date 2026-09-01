-- Allow public (unauthenticated) users to read school information for branding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'schools' AND schemaname = 'public' 
    AND policyname = 'Public can view schools for branding'
  ) THEN
    CREATE POLICY "Public can view schools for branding"
      ON schools FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;
