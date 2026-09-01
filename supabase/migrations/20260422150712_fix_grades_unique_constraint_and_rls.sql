/*
  # Fix grades table: unique constraint and RLS policies

  ## Root Cause Summary
  Three bugs in the score entry flow all stem from the same table-level issue
  and one frontend issue. This migration fixes the database side:

  1. The unique constraint on `grades` was (student_id, subject_id, term_id).
     Because terms are global (same term_id reused every academic year), a student's
     score saved in 2026/2027 would silently overwrite their 2025/2026 score for the
     same subject + term. The constraint is expanded to include class_id and
     academic_year_id so each year's data is isolated.

  2. The `principal` role was omitted from the INSERT and UPDATE RLS policies,
     causing all principal saves to fail silently (the UI showed "Saved!" but
     nothing was written to the database).

  ## Changes

  ### Modified Tables
  - `grades`
    - Drop old unique constraint: (student_id, subject_id, term_id)
    - Add new unique constraint: (student_id, subject_id, class_id, term_id, academic_year_id)

  ### Security Changes
  - DROP + RECREATE "Teachers can insert grades" policy → adds 'principal' role
  - DROP + RECREATE "Teachers can update grades" policy → adds 'principal' role

  ### Safety
  - Pre-flight check confirms zero duplicate rows under the new key before
    the constraint is applied — no data loss possible.
  - No columns dropped. No rows deleted.
*/

-- Pre-flight: assert zero duplicates under the new key (will error if any exist)
DO $$
DECLARE
  dup_count INT;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT student_id, subject_id, class_id, term_id, academic_year_id
    FROM grades
    GROUP BY student_id, subject_id, class_id, term_id, academic_year_id
    HAVING COUNT(*) > 1
  ) t;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Duplicate grades rows found under new key — migration aborted. % duplicates.', dup_count;
  END IF;
END $$;

-- Drop old narrow unique constraint
ALTER TABLE grades
  DROP CONSTRAINT IF EXISTS grades_student_id_subject_id_term_id_key;

-- Add correct wide unique constraint (student, subject, class, term, year)
ALTER TABLE grades
  ADD CONSTRAINT grades_unique_student_subject_class_term_year
  UNIQUE (student_id, subject_id, class_id, term_id, academic_year_id);

-- Fix RLS: add principal to INSERT policy
DROP POLICY IF EXISTS "Teachers can insert grades" ON grades;
CREATE POLICY "Teachers can insert grades"
  ON grades
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY(ARRAY['teacher','super_admin','admin','principal'])
    )
  );

-- Fix RLS: add principal to UPDATE policy
DROP POLICY IF EXISTS "Teachers can update grades" ON grades;
CREATE POLICY "Teachers can update grades"
  ON grades
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY(ARRAY['teacher','super_admin','admin','principal'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY(ARRAY['teacher','super_admin','admin','principal'])
    )
  );
