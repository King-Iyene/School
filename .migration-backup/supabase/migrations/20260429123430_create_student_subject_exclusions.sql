/*
  # Student subject exclusions

  1. New Table
    - student_subject_exclusions: tracks students who do NOT offer a specific subject
      for a given academic year (optionally per term). Exclusions prevent the subject
      from showing on the student's result card and from counting toward totals.

  2. Columns
    - id, school_id, student_id, subject_id, class_id, academic_year_id, term_id (nullable)
    - reason (text, optional), created_by, created_at

  3. Unique key
    - (student_id, subject_id, academic_year_id, COALESCE(term_id, '00000000-0000-0000-0000-000000000000'))

  4. Security
    - RLS enabled
    - Authenticated users who belong to the school can read exclusions
    - Admin/principal/teacher can insert/update/delete exclusions
*/

CREATE TABLE IF NOT EXISTS student_subject_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  term_id uuid REFERENCES terms(id) ON DELETE CASCADE,
  reason text DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sse_unique_year
  ON student_subject_exclusions (student_id, subject_id, academic_year_id)
  WHERE term_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sse_unique_term
  ON student_subject_exclusions (student_id, subject_id, academic_year_id, term_id)
  WHERE term_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sse_class_idx ON student_subject_exclusions (class_id, academic_year_id);
CREATE INDEX IF NOT EXISTS sse_student_idx ON student_subject_exclusions (student_id);

ALTER TABLE student_subject_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sse_select_school_members"
  ON student_subject_exclusions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.school_id = student_subject_exclusions.school_id
    )
  );

CREATE POLICY "sse_insert_staff"
  ON student_subject_exclusions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.school_id = student_subject_exclusions.school_id
        AND p.role IN ('super_admin','admin','principal','teacher')
    )
  );

CREATE POLICY "sse_update_staff"
  ON student_subject_exclusions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.school_id = student_subject_exclusions.school_id
        AND p.role IN ('super_admin','admin','principal','teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.school_id = student_subject_exclusions.school_id
        AND p.role IN ('super_admin','admin','principal','teacher')
    )
  );

CREATE POLICY "sse_delete_staff"
  ON student_subject_exclusions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.school_id = student_subject_exclusions.school_id
        AND p.role IN ('super_admin','admin','principal','teacher')
    )
  );
