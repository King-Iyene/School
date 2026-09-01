/*
  # Create helper functions and exam tables

  ## Summary
  Only the first 5 migrations have been applied. This migration:
  1. Creates the get_my_school_id() and get_my_role() helper functions used by RLS policies
  2. Creates the exams table (referenced by many frontend pages)
  3. Creates the exam_results table
  4. Creates the exam_schedule table

  ## Helper Functions
  - `get_my_school_id()` - returns the school_id for the current authenticated user
  - `get_my_role()` - returns the role for the current authenticated user

  ## New Tables
  - `exams` - main exam management table
  - `exam_results` - per-student per-subject results
  - `exam_schedule` - exam timetable

  ## Security
  RLS enabled on all tables, school-scoped access.
*/

-- Helper functions
CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Exams table
CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  exam_type text DEFAULT 'midterm' CHECK (exam_type IN ('midterm', 'final', 'unit-test', 'quarterly', 'annual')),
  type text DEFAULT 'written' CHECK (type IN ('written', 'online')),
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE CASCADE,
  term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view exams"
  ON exams FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Super admin can insert exams"
  ON exams FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admin can update exams"
  ON exams FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admin can delete exams"
  ON exams FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Exam Results table
CREATE TABLE IF NOT EXISTS exam_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  subject_name text DEFAULT '',
  class_name text DEFAULT '',
  max_marks numeric(6,2) DEFAULT 100,
  obtained_marks numeric(6,2) DEFAULT 0,
  grade text DEFAULT '',
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(exam_id, student_id, subject_id)
);

ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view exam results"
  ON exam_results FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Super admin and teacher can insert exam results"
  ON exam_results FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

CREATE POLICY "Super admin and teacher can update exam results"
  ON exam_results FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

CREATE POLICY "Super admin can delete exam results"
  ON exam_results FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Exam Schedule table
CREATE TABLE IF NOT EXISTS exam_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  subject_name text DEFAULT '',
  exam_date date NOT NULL,
  start_time time,
  end_time time,
  duration integer DEFAULT 0,
  venue text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE exam_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view exam schedule"
  ON exam_schedule FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Super admin can insert exam schedule"
  ON exam_schedule FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admin can update exam schedule"
  ON exam_schedule FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admin can delete exam schedule"
  ON exam_schedule FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exams_school_year ON exams(school_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam_student ON exam_results(exam_id, student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam_subject ON exam_results(exam_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedule_exam ON exam_schedule(exam_id);
