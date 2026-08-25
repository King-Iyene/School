/*
  # Create Result Compilations Table

  ## Purpose
  Tracks when a class teacher has compiled and published the final results for their class.
  Subject teachers enter individual subject scores; the class teacher then compiles
  everything into a final broadsheet and publishes it.

  ## New Tables
  - `result_compilations`
    - `id` - Primary key
    - `school_id` - School reference
    - `class_id` - The class being compiled
    - `term_id` - Which term these results are for
    - `academic_year_id` - Which academic year
    - `compiled_by` - The class teacher (profile) who compiled the results
    - `compiled_at` - When the compilation happened
    - `status` - draft | compiled | published
    - `notes` - Optional notes from the class teacher

  ## Security
  - RLS enabled
  - School members can view compilations for their school
  - Only teachers and super_admin can create/update compilations
*/

CREATE TABLE IF NOT EXISTS result_compilations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  compiled_by uuid REFERENCES profiles(id),
  compiled_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'compiled', 'published')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(class_id, term_id, academic_year_id)
);

ALTER TABLE result_compilations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view result compilations"
  ON result_compilations FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Teachers and admins can insert result compilations"
  ON result_compilations FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND (get_my_role() = 'super_admin' OR get_my_role() = 'teacher')
  );

CREATE POLICY "Teachers and admins can update result compilations"
  ON result_compilations FOR UPDATE
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND (get_my_role() = 'super_admin' OR get_my_role() = 'teacher')
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND (get_my_role() = 'super_admin' OR get_my_role() = 'teacher')
  );

CREATE INDEX IF NOT EXISTS idx_result_compilations_class ON result_compilations(class_id);
CREATE INDEX IF NOT EXISTS idx_result_compilations_term ON result_compilations(term_id, academic_year_id);
