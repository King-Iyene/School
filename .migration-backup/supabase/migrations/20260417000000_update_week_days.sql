-- ============================================================
-- Safe migration: create school_week_days and update class_routines
-- ============================================================

-- 1. Create school_week_days table (safe, idempotent)
CREATE TABLE IF NOT EXISTS school_week_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_weekend boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE school_week_days ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'school_week_days' AND policyname = 'School members can view school_week_days'
  ) THEN
    CREATE POLICY "School members can view school_week_days"
      ON school_week_days FOR SELECT TO authenticated USING (school_id = get_my_school_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'school_week_days' AND policyname = 'Super admin can insert school_week_days'
  ) THEN
    CREATE POLICY "Super admin can insert school_week_days"
      ON school_week_days FOR INSERT TO authenticated
      WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'school_week_days' AND policyname = 'Super admin can update school_week_days'
  ) THEN
    CREATE POLICY "Super admin can update school_week_days"
      ON school_week_days FOR UPDATE TO authenticated
      USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'school_week_days' AND policyname = 'Super admin can delete school_week_days'
  ) THEN
    CREATE POLICY "Super admin can delete school_week_days"
      ON school_week_days FOR DELETE TO authenticated
      USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
  END IF;
END $$;

-- 2. Add week_day_id column to class_routines (safe, idempotent)
ALTER TABLE class_routines
  ADD COLUMN IF NOT EXISTS week_day_id uuid REFERENCES school_week_days(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_break boolean DEFAULT false;

-- 3. Seed default Mon–Fri for existing schools
DO $$
DECLARE
  schoolRec RECORD;
  days TEXT[] := ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  i INTEGER;
BEGIN
  FOR schoolRec IN SELECT id FROM schools LOOP
    -- Only seed if no week days yet
    IF NOT EXISTS (SELECT 1 FROM school_week_days WHERE school_id = schoolRec.id) THEN
      FOR i IN 1..5 LOOP
        INSERT INTO school_week_days (school_id, name, is_weekend, sort_order)
        VALUES (schoolRec.id, days[i], false, i);
      END LOOP;
    END IF;
  END LOOP;
END $$;
