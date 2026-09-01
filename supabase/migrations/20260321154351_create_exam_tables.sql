/*
  # Examination System Tables

  ## New Tables
  - `exam_names` - Examination definitions (Midterm, Final etc.)
  - `grade_scales` - Mark-to-grade conversion scale
  - `exam_setups` - Mark distribution per subject per exam
  - `exam_schedules` - Exam timetable (date/room per subject)
  - `exam_marks` - Student marks per subject per exam
  - `exam_attendance_records` - Student exam attendance
  - `question_groups` - Categories for question bank
  - `question_bank` - Question repository
  - `online_exams` - Online exam sessions
  - `online_exam_questions` - Questions assigned to online exams
  - `online_exam_submissions` - Student submissions/answers

  ## Security
  RLS enabled on all tables with school_id scoping.
*/

-- Exam Names
CREATE TABLE IF NOT EXISTS exam_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE CASCADE,
  term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE exam_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view exam names"
  ON exam_names FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert exam names"
  ON exam_names FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update exam names"
  ON exam_names FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete exam names"
  ON exam_names FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Grade Scales
CREATE TABLE IF NOT EXISTS grade_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  grade_name text NOT NULL,
  min_mark numeric(5,2) NOT NULL,
  max_mark numeric(5,2) NOT NULL,
  grade text NOT NULL,
  gpa numeric(3,2) DEFAULT 0,
  remark text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE grade_scales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view grade scales"
  ON grade_scales FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert grade scales"
  ON grade_scales FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update grade scales"
  ON grade_scales FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete grade scales"
  ON grade_scales FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Exam Setups (mark distribution per subject)
CREATE TABLE IF NOT EXISTS exam_setups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  exam_name_id uuid REFERENCES exam_names(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  full_marks integer DEFAULT 100,
  pass_marks integer DEFAULT 40,
  ca1_marks integer DEFAULT 0,
  ca2_marks integer DEFAULT 0,
  ca3_marks integer DEFAULT 0,
  exam_marks integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(exam_name_id, class_id, subject_id)
);
ALTER TABLE exam_setups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view exam setups"
  ON exam_setups FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin and teacher can insert exam setups"
  ON exam_setups FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin and teacher can update exam setups"
  ON exam_setups FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin can delete exam setups"
  ON exam_setups FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Exam Schedules
CREATE TABLE IF NOT EXISTS exam_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  exam_name_id uuid REFERENCES exam_names(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  exam_date date NOT NULL,
  start_time time,
  end_time time,
  room text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE exam_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view exam schedules"
  ON exam_schedules FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert exam schedules"
  ON exam_schedules FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update exam schedules"
  ON exam_schedules FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete exam schedules"
  ON exam_schedules FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Exam Marks
CREATE TABLE IF NOT EXISTS exam_marks_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  exam_name_id uuid REFERENCES exam_names(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  ca1 numeric(6,2) DEFAULT 0,
  ca2 numeric(6,2) DEFAULT 0,
  ca3 numeric(6,2) DEFAULT 0,
  exam numeric(6,2) DEFAULT 0,
  total numeric(6,2) DEFAULT 0,
  is_absent boolean DEFAULT false,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(exam_name_id, student_id, subject_id)
);
ALTER TABLE exam_marks_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view exam marks"
  ON exam_marks_records FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin and teacher can insert exam marks"
  ON exam_marks_records FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin and teacher can update exam marks"
  ON exam_marks_records FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin can delete exam marks"
  ON exam_marks_records FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Exam Attendance
CREATE TABLE IF NOT EXISTS exam_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  exam_name_id uuid REFERENCES exam_names(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  exam_date date NOT NULL,
  status text DEFAULT 'present' CHECK (status IN ('present', 'absent')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(exam_name_id, student_id, subject_id, exam_date)
);
ALTER TABLE exam_attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view exam attendance"
  ON exam_attendance_records FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin and teacher can insert exam attendance"
  ON exam_attendance_records FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin and teacher can update exam attendance"
  ON exam_attendance_records FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin can delete exam attendance"
  ON exam_attendance_records FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Question Groups
CREATE TABLE IF NOT EXISTS question_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE question_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view question groups"
  ON question_groups FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin and teacher can insert question groups"
  ON question_groups FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin and teacher can update question groups"
  ON question_groups FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin can delete question groups"
  ON question_groups FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

-- Question Bank
CREATE TABLE IF NOT EXISTS question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  question_group_id uuid REFERENCES question_groups(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  question_text text NOT NULL,
  question_type text DEFAULT 'mcq' CHECK (question_type IN ('mcq', 'true_false', 'short_answer', 'essay')),
  options jsonb,
  correct_answer text,
  marks integer DEFAULT 1,
  difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view question bank"
  ON question_bank FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin and teacher can insert question bank"
  ON question_bank FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin and teacher can update question bank"
  ON question_bank FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin can delete question bank"
  ON question_bank FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

-- Online Exams
CREATE TABLE IF NOT EXISTS online_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  exam_name_id uuid REFERENCES exam_names(id) ON DELETE SET NULL,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  start_datetime timestamptz NOT NULL,
  end_datetime timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  total_marks integer DEFAULT 100,
  pass_percentage numeric(5,2) DEFAULT 40,
  instructions text,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE online_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view online exams"
  ON online_exams FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert online exams"
  ON online_exams FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update online exams"
  ON online_exams FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete online exams"
  ON online_exams FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Online Exam Questions
CREATE TABLE IF NOT EXISTS online_exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  online_exam_id uuid REFERENCES online_exams(id) ON DELETE CASCADE,
  question_id uuid REFERENCES question_bank(id) ON DELETE CASCADE,
  sort_order integer DEFAULT 0,
  UNIQUE(online_exam_id, question_id)
);
ALTER TABLE online_exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view online exam questions"
  ON online_exam_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM online_exams WHERE id = online_exam_id AND school_id = get_my_school_id()));
CREATE POLICY "Super admin can manage online exam questions"
  ON online_exam_questions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM online_exams WHERE id = online_exam_id AND school_id = get_my_school_id()) AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update online exam questions"
  ON online_exam_questions FOR UPDATE TO authenticated
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete online exam questions"
  ON online_exam_questions FOR DELETE TO authenticated
  USING (get_my_role() = 'super_admin');

-- Online Exam Submissions
CREATE TABLE IF NOT EXISTS online_exam_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  online_exam_id uuid REFERENCES online_exams(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  answers jsonb DEFAULT '{}',
  score numeric(6,2),
  submitted_at timestamptz,
  status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted', 'graded')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(online_exam_id, student_id)
);
ALTER TABLE online_exam_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own submissions"
  ON online_exam_submissions FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Students can insert own submissions"
  ON online_exam_submissions FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students and admin can update submissions"
  ON online_exam_submissions FOR UPDATE TO authenticated
  USING (student_id = auth.uid() OR get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (student_id = auth.uid() OR get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Admin can delete submissions"
  ON online_exam_submissions FOR DELETE TO authenticated
  USING (get_my_role() = 'super_admin');

-- Seed default grade scale
DO $$
DECLARE v_school_id uuid;
BEGIN
  SELECT id INTO v_school_id FROM schools LIMIT 1;
  IF v_school_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM grade_scales WHERE school_id = v_school_id) THEN
    INSERT INTO grade_scales (school_id, grade_name, min_mark, max_mark, grade, gpa, remark, sort_order) VALUES
      (v_school_id, 'A1', 75, 100, 'A1', 4.0, 'Excellent', 1),
      (v_school_id, 'B2', 70, 74.99, 'B2', 3.5, 'Very Good', 2),
      (v_school_id, 'B3', 65, 69.99, 'B3', 3.0, 'Good', 3),
      (v_school_id, 'C4', 60, 64.99, 'C4', 2.5, 'Credit', 4),
      (v_school_id, 'C5', 55, 59.99, 'C5', 2.0, 'Credit', 5),
      (v_school_id, 'C6', 50, 54.99, 'C6', 1.5, 'Credit', 6),
      (v_school_id, 'D7', 45, 49.99, 'D7', 1.0, 'Pass', 7),
      (v_school_id, 'E8', 40, 44.99, 'E8', 0.5, 'Pass', 8),
      (v_school_id, 'F9', 0, 39.99, 'F9', 0.0, 'Fail', 9);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exam_marks_exam_student ON exam_marks_records(exam_name_id, student_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_exam_class ON exam_schedules(exam_name_id, class_id);
CREATE INDEX IF NOT EXISTS idx_online_exams_class ON online_exams(class_id);
