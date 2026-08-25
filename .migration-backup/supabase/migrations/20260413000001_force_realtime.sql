-- 1. Ensure the table is in the publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  ELSE
    -- If it's already there, set it to ALL just in case
    DROP PUBLICATION IF EXISTS supabase_realtime;
    CREATE PUBLICATION supabase_realtime FOR TABLE notifications;
    -- Note: This is more aggressive and might be needed if the publication was stuck
  END IF;
END $$;

-- 2. Force REPLICA IDENTITY to FULL for more reliable updates/deletes
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- 3. Grant usage if not already present
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE notifications TO postgres, anon, authenticated, service_role;
