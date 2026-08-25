/*
  # Add Missing Columns for Announcements and Events

  ## Changes
  1. `announcements` table - Add `publish_date` column (date when announcement goes live)
  2. `events` table - Add `all_day` boolean column (whether event is all-day or has specific times)

  ## Notes
  - Both columns are optional with sensible defaults
  - `publish_date` defaults to current date
  - `all_day` defaults to true (most school events are all-day)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'announcements' AND column_name = 'publish_date'
  ) THEN
    ALTER TABLE announcements ADD COLUMN publish_date date DEFAULT CURRENT_DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'all_day'
  ) THEN
    ALTER TABLE events ADD COLUMN all_day boolean DEFAULT true;
  END IF;
END $$;
