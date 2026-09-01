/*
  # Lesson Plan, Behaviour Records, Assessment Tables

  ## New Tables
  1. lessons - Lesson units per subject/class
  2. topics - Topics within lessons  
  3. lesson_plans - Detailed lesson plans
  4. behaviour_incidents - Incident type definitions
  5. student_behaviour_records - Incidents per student
  6. student_assessments - Marks (exam/test/assignment/classwork/practical/homework)
  7. assessment_weights - Grading weights (Exam=70, Test=20, Assignment/Classwork=10)
*/

CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text DEFAULT '',
  lesson_number integer DEFAULT 1,
  duration_minutes integer DEFAULT 45,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View lessons" ON lessons FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Insert lessons" ON lessons FOR INSERT TO authenticated WITH CHECK (school_id = get_my_school_id());
CREATE POLICY "Update lessons" ON lessons FOR UPDATE TO authenticated USING (school_id = get_my_school_id()) WITH CHECK (school_id = get_my_school_id());
CREATE POLICY "Delete lessons" ON lessons FOR DELETE TO authenticated USING (school_id = get_my_school_id());

CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  overview text DEFAULT '',
  objectives text DEFAULT '',
  resources text DEFAULT '',
  topic_number integer DEFAULT 1,
  duration_minutes integer DEFAULT 20,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View topics" ON topics FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Insert topics" ON topics FOR INSERT TO authenticated WITH CHECK (school_id = get_my_school_id());
CREATE POLICY "Update topics" ON topics FOR UPDATE TO authenticated USING (school_id = get_my_school_id()) WITH CHECK (school_id = get_my_school_id());
CREATE POLICY "Delete topics" ON topics FOR DELETE TO authenticated USING (school_id = get_my_school_id());

CREATE TABLE IF NOT EXISTS lesson_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  plan_date date NOT NULL DEFAULT CURRENT_DATE,
  introduction text DEFAULT '',
  development text DEFAULT '',
  conclusion text DEFAULT '',
  materials text DEFAULT '',
  evaluation text DEFAULT '',
  homework_notes text DEFAULT '',
  notes text DEFAULT '',
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View lesson_plans" ON lesson_plans FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Insert lesson_plans" ON lesson_plans FOR INSERT TO authenticated WITH CHECK (school_id = get_my_school_id());
CREATE POLICY "Update lesson_plans" ON lesson_plans FOR UPDATE TO authenticated USING (school_id = get_my_school_id()) WITH CHECK (school_id = get_my_school_id());
CREATE POLICY "Delete lesson_plans" ON lesson_plans FOR DELETE TO authenticated USING (school_id = get_my_school_id());

CREATE TABLE IF NOT EXISTS behaviour_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  severity text DEFAULT 'minor',
  points_deducted integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE behaviour_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View behaviour_incidents" ON behaviour_incidents FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Insert behaviour_incidents" ON behaviour_incidents FOR INSERT TO authenticated WITH CHECK (school_id = get_my_school_id());
CREATE POLICY "Update behaviour_incidents" ON behaviour_incidents FOR UPDATE TO authenticated USING (school_id = get_my_school_id()) WITH CHECK (school_id = get_my_school_id());
CREATE POLICY "Delete behaviour_incidents" ON behaviour_incidents FOR DELETE TO authenticated USING (school_id = get_my_school_id());

CREATE TABLE IF NOT EXISTS student_behaviour_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES behaviour_incidents(id) ON DELETE SET NULL,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  section_id uuid REFERENCES sections(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  incident_date date DEFAULT CURRENT_DATE,
  description text DEFAULT '',
  action_taken text DEFAULT '',
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE student_behaviour_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View student_behaviour_records" ON student_behaviour_records FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Insert student_behaviour_records" ON student_behaviour_records FOR INSERT TO authenticated WITH CHECK (school_id = get_my_school_id());
CREATE POLICY "Update student_behaviour_records" ON student_behaviour_records FOR UPDATE TO authenticated USING (school_id = get_my_school_id()) WITH CHECK (school_id = get_my_school_id());
CREATE POLICY "Delete student_behaviour_records" ON student_behaviour_records FOR DELETE TO authenticated USING (school_id = get_my_school_id());

CREATE TABLE IF NOT EXISTS student_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  section_id uuid REFERENCES sections(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  exam_name_id uuid REFERENCES exam_names(id) ON DELETE SET NULL,
  assessment_type text NOT NULL DEFAULT 'exam',
  title text NOT NULL DEFAULT '',
  max_marks numeric(6,2) DEFAULT 100,
  obtained_marks numeric(6,2) DEFAULT 0,
  weight_percent numeric(5,2) DEFAULT 70,
  assessment_date date DEFAULT CURRENT_DATE,
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE student_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View student_assessments" ON student_assessments FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Insert student_assessments" ON student_assessments FOR INSERT TO authenticated WITH CHECK (school_id = get_my_school_id());
CREATE POLICY "Update student_assessments" ON student_assessments FOR UPDATE TO authenticated USING (school_id = get_my_school_id()) WITH CHECK (school_id = get_my_school_id());
CREATE POLICY "Delete student_assessments" ON student_assessments FOR DELETE TO authenticated USING (school_id = get_my_school_id());

CREATE TABLE IF NOT EXISTS assessment_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  exam_weight numeric(5,2) DEFAULT 70,
  test_weight numeric(5,2) DEFAULT 20,
  assignment_classwork_weight numeric(5,2) DEFAULT 10,
  total_marks numeric(6,2) DEFAULT 100,
  description text DEFAULT 'Exam 70 + Test 20 + Assignment/Classwork/Practical 10 = 100',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assessment_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View assessment_weights" ON assessment_weights FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Insert assessment_weights" ON assessment_weights FOR INSERT TO authenticated WITH CHECK (school_id = get_my_school_id());
CREATE POLICY "Update assessment_weights" ON assessment_weights FOR UPDATE TO authenticated USING (school_id = get_my_school_id()) WITH CHECK (school_id = get_my_school_id());
