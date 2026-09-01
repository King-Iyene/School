-- Fix user deletion blockers by adding ON DELETE SET NULL to foreign keys that are missing it.

-- 1. result_compilations table
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'result_compilations_compiled_by_fkey'
  ) THEN
    ALTER TABLE result_compilations DROP CONSTRAINT result_compilations_compiled_by_fkey;
  END IF;
END $$;

ALTER TABLE result_compilations 
ADD CONSTRAINT result_compilations_compiled_by_fkey 
FOREIGN KEY (compiled_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Check for any other profiles(id) references that might be missing cascade/set-null
-- (Based on grep search, most others already have ON DELETE SET NULL or CASCADE)
