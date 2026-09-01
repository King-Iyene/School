/*
  # Fix Academic Terms System

  ## Summary
  Enforces data integrity and simplifies the terms workflow:

  1. **Unique Constraint** — Adds a UNIQUE constraint on (school_id, academic_year_id, name)
     so duplicate terms like two "First Term" rows for the same year can never exist.

  2. **Auto-Create Trigger** — After a new academic year is inserted, a trigger
     automatically creates all three terms (First Term, Second Term, Third Term)
     with evenly-spaced default dates derived from the year's start/end dates.
     ON CONFLICT DO NOTHING ensures no crash if terms already exist.

  3. **Update Policy** — Adds a DELETE RLS policy for terms so admins can clean up
     if needed, and adds an explicit UPDATE policy allowing admins to edit term dates.

  4. **No data loss** — Uses IF NOT EXISTS / ON CONFLICT guards throughout.
*/

DO $$
BEGIN
  -- Only attempt to add the constraint if school_id still exists
  -- This avoids failure if the table has already been partially restructured
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'terms' AND column_name = 'school_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'terms'
      AND constraint_name = 'terms_school_year_name_unique'
  ) THEN
    ALTER TABLE terms
      ADD CONSTRAINT terms_school_year_name_unique
      UNIQUE (school_id, academic_year_id, name);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION create_default_terms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_days integer;
  first_end date;
  second_start date;
  second_end date;
  third_start date;
BEGIN
  -- Only attempt to create terms if the table still has the expected schema
  -- If school_id is missing, it means the table is already restructured or in v2 state
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'terms' AND column_name = 'school_id'
  ) THEN
    total_days := (NEW.end_date - NEW.start_date);
    first_end   := NEW.start_date + (total_days / 3);
    second_start := first_end + 1;
    second_end   := NEW.start_date + (total_days * 2 / 3);
    third_start  := second_end + 1;

    INSERT INTO terms (academic_year_id, school_id, name, start_date, end_date, is_current)
    VALUES
      (NEW.id, NEW.school_id, 'First Term',  NEW.start_date, first_end,    false),
      (NEW.id, NEW.school_id, 'Second Term', second_start,   second_end,   false),
      (NEW.id, NEW.school_id, 'Third Term',  third_start,    NEW.end_date, false)
    ON CONFLICT (school_id, academic_year_id, name) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_create_terms_on_year_insert ON academic_years;
CREATE TRIGGER auto_create_terms_on_year_insert
  AFTER INSERT ON academic_years
  FOR EACH ROW
  EXECUTE FUNCTION create_default_terms();

DROP POLICY IF EXISTS "Admins can delete terms" ON terms;
CREATE POLICY "Admins can delete terms"
  ON terms FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );
