/*
  # Content, Student Management & Notice Board Tables

  ## New Tables

  ### Content
  - `study_materials` - Study files per class/subject
  - `syllabus_items` - Syllabus uploads per class/subject/term
  - `other_downloads` - General downloadable content
  - `homework_records` - Homework assignments with evaluation

  ### Student Management
  - `student_categories` - Student type categories
  - `student_groups` - Student groupings
  - `student_group_members` - Group membership
  - `student_promotions` - Promotion records
  - `disabled_students` - Inactive/disabled student records

  ### Notice Board
  - `notice_board_items` - School notices

  ## Security
  RLS enabled on all tables with school_id scoping.
*/

-- Study Materials
CREATE TABLE IF NOT EXISTS study_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  file_url text,
  content_type text DEFAULT 'document' CHECK (content_type IN ('document', 'pdf', 'video', 'link', 'image', 'other')),
  available_for text[] DEFAULT ARRAY['students', 'teachers'],
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view study materials"
  ON study_materials FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin and teacher can insert study materials"
  ON study_materials FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin and teacher can update study materials"
  ON study_materials FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin and teacher can delete study materials"
  ON study_materials FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

-- Syllabus Items
CREATE TABLE IF NOT EXISTS syllabus_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE CASCADE,
  term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text,
  file_url text,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE syllabus_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view syllabus"
  ON syllabus_items FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin and teacher can insert syllabus"
  ON syllabus_items FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin and teacher can update syllabus"
  ON syllabus_items FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin and teacher can delete syllabus"
  ON syllabus_items FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

-- Other Downloads
CREATE TABLE IF NOT EXISTS other_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_url text,
  available_for text DEFAULT 'all' CHECK (available_for IN ('all', 'teachers', 'students', 'parents')),
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE other_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view other downloads"
  ON other_downloads FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert other downloads"
  ON other_downloads FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update other downloads"
  ON other_downloads FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete other downloads"
  ON other_downloads FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Homework Records
CREATE TABLE IF NOT EXISTS homework_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  homework_date date NOT NULL,
  submission_date date NOT NULL,
  marks integer DEFAULT 0,
  attachment_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE homework_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view homework"
  ON homework_records FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin and teacher can insert homework"
  ON homework_records FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin and teacher can update homework"
  ON homework_records FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin and teacher can delete homework"
  ON homework_records FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

-- Homework Submissions (student evaluation)
CREATE TABLE IF NOT EXISTS homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id uuid REFERENCES homework_records(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'evaluated')),
  marks_obtained integer,
  feedback text,
  submitted_at timestamptz,
  evaluated_at timestamptz,
  UNIQUE(homework_id, student_id)
);
ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view homework submissions"
  ON homework_submissions FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Students can insert own submissions"
  ON homework_submissions FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() OR get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Update homework submissions"
  ON homework_submissions FOR UPDATE TO authenticated
  USING (student_id = auth.uid() OR get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (student_id = auth.uid() OR get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Admin can delete submissions"
  ON homework_submissions FOR DELETE TO authenticated
  USING (get_my_role() IN ('super_admin', 'teacher'));

-- Student Categories
CREATE TABLE IF NOT EXISTS student_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE student_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view student categories"
  ON student_categories FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert student categories"
  ON student_categories FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update student categories"
  ON student_categories FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete student categories"
  ON student_categories FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Student Groups
CREATE TABLE IF NOT EXISTS student_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE student_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view student groups"
  ON student_groups FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert student groups"
  ON student_groups FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update student groups"
  ON student_groups FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete student groups"
  ON student_groups FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Student Group Members
CREATE TABLE IF NOT EXISTS student_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES student_groups(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, student_id)
);
ALTER TABLE student_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view group members"
  ON student_group_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM student_groups WHERE id = group_id AND school_id = get_my_school_id()));
CREATE POLICY "Super admin can manage group members"
  ON student_group_members FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete group members"
  ON student_group_members FOR DELETE TO authenticated
  USING (get_my_role() = 'super_admin');

-- Student Promotions
CREATE TABLE IF NOT EXISTS student_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  from_class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  to_class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  from_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  to_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  result text DEFAULT 'pass' CHECK (result IN ('pass', 'fail', 'repeat')),
  promoted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE student_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view student promotions"
  ON student_promotions FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert student promotions"
  ON student_promotions FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete student promotions"
  ON student_promotions FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Disabled Students
CREATE TABLE IF NOT EXISTS disabled_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reason text,
  disabled_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  disabled_at timestamptz DEFAULT now(),
  reactivated_at timestamptz,
  is_disabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id)
);
ALTER TABLE disabled_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view disabled students"
  ON disabled_students FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert disabled students"
  ON disabled_students FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update disabled students"
  ON disabled_students FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete disabled students"
  ON disabled_students FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Notice Board Items
CREATE TABLE IF NOT EXISTS notice_board_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  notice_date date DEFAULT CURRENT_DATE,
  published_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  attachment_url text,
  target_roles text[] DEFAULT ARRAY['all'],
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE notice_board_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view notice board"
  ON notice_board_items FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin and teacher can insert notices"
  ON notice_board_items FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin and teacher can update notices"
  ON notice_board_items FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin can delete notices"
  ON notice_board_items FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

-- Add category_id and group_id to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN category_id uuid REFERENCES student_categories(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'basic_salary'
  ) THEN
    ALTER TABLE profiles ADD COLUMN basic_salary numeric(12,2) DEFAULT 0;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_study_materials_class ON study_materials(class_id);
CREATE INDEX IF NOT EXISTS idx_homework_records_class ON homework_records(class_id);
CREATE INDEX IF NOT EXISTS idx_notice_board_school ON notice_board_items(school_id, notice_date);
