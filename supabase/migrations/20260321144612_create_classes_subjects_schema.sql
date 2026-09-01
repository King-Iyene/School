/*
  # Classes, Subjects, and Enrollments Schema

  ## New Tables
  1. `classes` - Class groups (JSS1A, SS2B, etc.)
  2. `subjects` - Subject definitions per school
  3. `class_subjects` - Subjects assigned to classes with teacher
  4. `student_enrollments` - Students enrolled in classes per term
  5. `parent_student_links` - Links parents to their children

  ## Security
  - RLS on all tables with school-scoped access
*/

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  level text NOT NULL CHECK (level IN ('JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3')),
  section text DEFAULT 'A',
  class_teacher_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  capacity integer DEFAULT 40,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view classes"
  ON classes FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY "Admins and teachers can insert classes"
  ON classes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'teacher')
      AND profiles.school_id = classes.school_id
    )
  );

CREATE POLICY "Admins can update classes"
  ON classes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin')
      AND profiles.school_id = classes.school_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin')
      AND profiles.school_id = classes.school_id
    )
  );

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text DEFAULT '',
  category text DEFAULT 'core' CHECK (category IN ('core', 'elective', 'vocational')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view subjects"
  ON subjects FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage subjects insert"
  ON subjects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
      AND profiles.school_id = subjects.school_id
    )
  );

CREATE POLICY "Admins can manage subjects update"
  ON subjects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
      AND profiles.school_id = subjects.school_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
      AND profiles.school_id = subjects.school_id
    )
  );

CREATE TABLE IF NOT EXISTS class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, subject_id)
);

ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view class subjects"
  ON class_subjects FOR SELECT
  TO authenticated
  USING (
    class_id IN (
      SELECT id FROM classes
      WHERE school_id IN (
        SELECT school_id FROM profiles WHERE profiles.id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage class subjects insert"
  ON class_subjects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage class subjects update"
  ON class_subjects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE TABLE IF NOT EXISTS student_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  enrollment_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'graduated', 'suspended')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, class_id, academic_year_id)
);

ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own enrollments"
  ON student_enrollments FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "School members can view enrollments"
  ON student_enrollments FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM profiles
      WHERE school_id IN (
        SELECT school_id FROM profiles p2 WHERE p2.id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage enrollments insert"
  ON student_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'teacher', 'accountant')
    )
  );

CREATE POLICY "Admins can manage enrollments update"
  ON student_enrollments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'accountant')
    )
  );

CREATE TABLE IF NOT EXISTS parent_student_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  relationship text DEFAULT 'parent' CHECK (relationship IN ('parent', 'guardian', 'sibling', 'other')),
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(parent_id, student_id)
);

ALTER TABLE parent_student_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view own links"
  ON parent_student_links FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid() OR student_id = auth.uid());

CREATE POLICY "Admins can manage parent links"
  ON parent_student_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'teacher', 'accountant')
    )
  );

CREATE POLICY "Admins can insert parent links"
  ON parent_student_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'accountant')
    )
  );

CREATE POLICY "Admins can update parent links"
  ON parent_student_links FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'accountant')
    )
  );
