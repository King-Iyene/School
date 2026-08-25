/*
  # Restructure Terms: Global 3-Term System (v2)

  ## Summary
  Converts terms to 3 global static records. Creates academic_year_terms pivot table
  for per-year date ranges. Drops all old per-year columns and remaps all FK references.

  ## Key Steps
  1. Drop trigger/function, drop old RLS policies (some depend on school_id)
  2. Make per-year columns nullable
  3. Create academic_year_terms pivot table
  4. Insert 3 global terms with stable UUIDs
  5. Seed academic_year_terms from old data
  6. Remap FK references in all child tables
  7. Delete old per-year term records
  8. Drop per-year columns
  9. Add new simple RLS: all authenticated users can read terms (read-only)
  10. Add RLS for academic_year_terms
*/

-- ============================================================
-- STEP 1: Drop old trigger + function + ALL existing term policies
-- ============================================================
DROP TRIGGER IF EXISTS auto_create_terms_on_year_insert ON academic_years;
DROP FUNCTION IF EXISTS create_default_terms();

DROP POLICY IF EXISTS "School members can view terms" ON terms;
DROP POLICY IF EXISTS "Admins can insert terms" ON terms;
DROP POLICY IF EXISTS "Admins can update terms" ON terms;
DROP POLICY IF EXISTS "Admins can delete terms" ON terms;
DROP POLICY IF EXISTS "Users can view terms" ON terms;
DROP POLICY IF EXISTS "Admins can manage terms" ON terms;
DROP POLICY IF EXISTS "School admins can manage terms" ON terms;
DROP POLICY IF EXISTS "School admins can delete terms" ON terms;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON terms;
DROP POLICY IF EXISTS "All authenticated users can view terms" ON terms;

-- ============================================================
-- STEP 2: Drop old unique constraint, make per-year columns nullable
-- ============================================================
ALTER TABLE terms DROP CONSTRAINT IF EXISTS terms_school_id_academic_year_id_name_key;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='terms' AND column_name='academic_year_id') THEN
    ALTER TABLE terms ALTER COLUMN academic_year_id DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='terms' AND column_name='school_id') THEN
    ALTER TABLE terms ALTER COLUMN school_id DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='terms' AND column_name='start_date') THEN
    ALTER TABLE terms ALTER COLUMN start_date DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='terms' AND column_name='end_date') THEN
    ALTER TABLE terms ALTER COLUMN end_date DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='terms' AND column_name='is_current' AND is_nullable='NO'
  ) THEN
    ALTER TABLE terms ALTER COLUMN is_current DROP NOT NULL;
  END IF;
END $$;

-- ============================================================
-- STEP 3: Create academic_year_terms pivot table
-- ============================================================
CREATE TABLE IF NOT EXISTS academic_year_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  start_date date,
  end_date date,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(academic_year_id, term_id)
);

-- ============================================================
-- STEP 4: Insert 3 global terms with stable fixed UUIDs
-- ============================================================
INSERT INTO terms (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'First Term'),
  ('00000000-0000-0000-0000-000000000002', 'Second Term'),
  ('00000000-0000-0000-0000-000000000003', 'Third Term')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 5: Seed academic_year_terms from existing per-year terms
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='terms' AND column_name='academic_year_id') THEN
    INSERT INTO academic_year_terms (academic_year_id, term_id, start_date, end_date, is_current)
    SELECT
      t.academic_year_id,
      CASE t.name
        WHEN 'First Term'  THEN '00000000-0000-0000-0000-000000000001'::uuid
        WHEN 'Second Term' THEN '00000000-0000-0000-0000-000000000002'::uuid
        WHEN 'Third Term'  THEN '00000000-0000-0000-0000-000000000003'::uuid
      END,
      t.start_date,
      t.end_date,
      COALESCE(t.is_current, false)
    FROM terms t
    WHERE t.academic_year_id IS NOT NULL
    ON CONFLICT (academic_year_id, term_id) DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- STEP 6: Remap FK references to new global term IDs
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='terms' AND column_name='academic_year_id') THEN
    UPDATE student_enrollments se
    SET term_id = (
      CASE t.name
        WHEN 'First Term'  THEN '00000000-0000-0000-0000-000000000001'::uuid
        WHEN 'Second Term' THEN '00000000-0000-0000-0000-000000000002'::uuid
        WHEN 'Third Term'  THEN '00000000-0000-0000-0000-000000000003'::uuid
      END
    )
    FROM terms t
    WHERE se.term_id = t.id
      AND t.academic_year_id IS NOT NULL;

    UPDATE exam_names en
    SET term_id = (
      CASE t.name
        WHEN 'First Term'  THEN '00000000-0000-0000-0000-000000000001'::uuid
        WHEN 'Second Term' THEN '00000000-0000-0000-0000-000000000002'::uuid
        WHEN 'Third Term'  THEN '00000000-0000-0000-0000-000000000003'::uuid
      END
    )
    FROM terms t
    WHERE en.term_id = t.id
      AND t.academic_year_id IS NOT NULL;

    UPDATE result_compilations rc
    SET term_id = (
      CASE t.name
        WHEN 'First Term'  THEN '00000000-0000-0000-0000-000000000001'::uuid
        WHEN 'Second Term' THEN '00000000-0000-0000-0000-000000000002'::uuid
        WHEN 'Third Term'  THEN '00000000-0000-0000-0000-000000000003'::uuid
      END
    )
    FROM terms t
    WHERE rc.term_id = t.id
      AND t.academic_year_id IS NOT NULL;

    UPDATE grades g
    SET term_id = (
      CASE t.name
        WHEN 'First Term'  THEN '00000000-0000-0000-0000-000000000001'::uuid
        WHEN 'Second Term' THEN '00000000-0000-0000-0000-000000000002'::uuid
        WHEN 'Third Term'  THEN '00000000-0000-0000-0000-000000000003'::uuid
      END
    )
    FROM terms t
    WHERE g.term_id = t.id
      AND t.academic_year_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='terms' AND column_name='academic_year_id') THEN
    UPDATE assignments a
    SET term_id = (
      CASE t.name
        WHEN 'First Term'  THEN '00000000-0000-0000-0000-000000000001'::uuid
        WHEN 'Second Term' THEN '00000000-0000-0000-0000-000000000002'::uuid
        WHEN 'Third Term'  THEN '00000000-0000-0000-0000-000000000003'::uuid
      END
    )
    FROM terms t
    WHERE a.term_id = t.id
      AND t.academic_year_id IS NOT NULL;

    UPDATE fee_structures fs
    SET term_id = (
      CASE t.name
        WHEN 'First Term'  THEN '00000000-0000-0000-0000-000000000001'::uuid
        WHEN 'Second Term' THEN '00000000-0000-0000-0000-000000000002'::uuid
        WHEN 'Third Term'  THEN '00000000-0000-0000-0000-000000000003'::uuid
      END
    )
    FROM terms t
    WHERE fs.term_id = t.id
      AND t.academic_year_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='timetable' AND column_name='term_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='terms' AND column_name='academic_year_id'
  ) THEN
    EXECUTE $sql$
      UPDATE timetable tt
      SET term_id = (
        CASE t.name
          WHEN 'First Term'  THEN '00000000-0000-0000-0000-000000000001'::uuid
          WHEN 'Second Term' THEN '00000000-0000-0000-0000-000000000002'::uuid
          WHEN 'Third Term'  THEN '00000000-0000-0000-0000-000000000003'::uuid
        END
      )
      FROM terms t
      WHERE tt.term_id = t.id
        AND t.academic_year_id IS NOT NULL
    $sql$;
  END IF;
END $$;

-- ============================================================
-- STEP 7: Delete old per-year term records
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='terms' AND column_name='academic_year_id') THEN
    DELETE FROM terms WHERE academic_year_id IS NOT NULL;
  END IF;
END $$;

-- ============================================================
-- STEP 8: Drop per-year columns from terms
-- ============================================================
ALTER TABLE terms DROP COLUMN IF EXISTS academic_year_id;
ALTER TABLE terms DROP COLUMN IF EXISTS school_id;
ALTER TABLE terms DROP COLUMN IF EXISTS start_date;
ALTER TABLE terms DROP COLUMN IF EXISTS end_date;
ALTER TABLE terms DROP COLUMN IF EXISTS is_current;

-- ============================================================
-- STEP 9: New RLS for terms — read-only for all authenticated
-- ============================================================
CREATE POLICY "All authenticated users can view terms"
  ON terms FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- STEP 10: RLS for academic_year_terms
-- ============================================================
ALTER TABLE academic_year_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view academic year terms"
  ON academic_year_terms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert academic year terms"
  ON academic_year_terms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can update academic year terms"
  ON academic_year_terms FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete academic year terms"
  ON academic_year_terms FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin')
    )
  );
