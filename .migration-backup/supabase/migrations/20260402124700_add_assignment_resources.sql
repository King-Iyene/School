-- Add source_url and file_url to assignments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignments' AND column_name = 'source_url'
  ) THEN
    ALTER TABLE assignments ADD COLUMN source_url text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignments' AND column_name = 'file_url'
  ) THEN
    ALTER TABLE assignments ADD COLUMN file_url text DEFAULT '';
  END IF;
END $$;
