/*
  # Add publish_date to announcements table

  ## Summary
  The frontend Announcements UI references a `publish_date` column which didn't exist in the database table schema.
  This migration adds the missing column to prevent errors during announcement creation.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'publish_date'
  ) THEN
    ALTER TABLE announcements ADD COLUMN publish_date date;
  END IF;
END $$;
