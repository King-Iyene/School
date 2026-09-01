/*
  # Academic Setup & HR/Leave Tables

  ## New Tables

  ### Academic
  - `sections` - Manage class sections (A, B, C etc.)
  - `classrooms` - Physical rooms with capacity
  - `time_slots` - Class/exam periods with start/end times
  - `subject_teacher_assignments` - Assigns teachers to subjects per class
  - `class_teachers` - Assigns a head teacher to a class
  - `class_routines` - Weekly class timetable slots

  ### HR & Leave
  - `leave_types` - Types of leave (sick, casual, maternity etc.)
  - `leave_allocations` - Per-staff annual leave allocation
  - `leave_applications` - Staff leave requests
  - `staff_attendance_records` - Daily staff attendance
  - `payroll_records` - Monthly payroll per staff member

  ## Security
  - RLS enabled on all tables
  - Policies use get_my_school_id() and get_my_role() to avoid recursion
*/

-- Sections
CREATE TABLE IF NOT EXISTS sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view sections"
  ON sections FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert sections"
  ON sections FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update sections"
  ON sections FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete sections"
  ON sections FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Classrooms
CREATE TABLE IF NOT EXISTS classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  room_no text NOT NULL,
  building text,
  floor text,
  capacity integer DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view classrooms"
  ON classrooms FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert classrooms"
  ON classrooms FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update classrooms"
  ON classrooms FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete classrooms"
  ON classrooms FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Time Slots (periods)
CREATE TABLE IF NOT EXISTS time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  period_name text NOT NULL,
  time_type text DEFAULT 'class' CHECK (time_type IN ('class', 'exam', 'break')),
  start_time time NOT NULL,
  end_time time NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view time_slots"
  ON time_slots FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert time_slots"
  ON time_slots FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update time_slots"
  ON time_slots FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete time_slots"
  ON time_slots FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Subject Teacher Assignments
CREATE TABLE IF NOT EXISTS subject_teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(class_id, subject_id, academic_year_id)
);
ALTER TABLE subject_teacher_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view subject assignments"
  ON subject_teacher_assignments FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert subject assignments"
  ON subject_teacher_assignments FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin can update subject assignments"
  ON subject_teacher_assignments FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete subject assignments"
  ON subject_teacher_assignments FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Class Teachers
CREATE TABLE IF NOT EXISTS class_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(class_id, academic_year_id)
);
ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view class teachers"
  ON class_teachers FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert class teachers"
  ON class_teachers FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update class teachers"
  ON class_teachers FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete class teachers"
  ON class_teachers FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Class Routines (timetable slots)
CREATE TABLE IF NOT EXISTS class_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  time_slot_id uuid REFERENCES time_slots(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(class_id, time_slot_id, day_of_week, academic_year_id)
);
ALTER TABLE class_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view class routines"
  ON class_routines FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin and teacher can insert class routines"
  ON class_routines FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin and teacher can update class routines"
  ON class_routines FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
CREATE POLICY "Super admin can delete class routines"
  ON class_routines FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

-- Leave Types
CREATE TABLE IF NOT EXISTS leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  total_days integer DEFAULT 0,
  is_paid boolean DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view leave types"
  ON leave_types FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can insert leave types"
  ON leave_types FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update leave types"
  ON leave_types FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete leave types"
  ON leave_types FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Leave Allocations (define days per role)
CREATE TABLE IF NOT EXISTS leave_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  role text NOT NULL,
  leave_type_id uuid REFERENCES leave_types(id) ON DELETE CASCADE,
  days_allocated integer DEFAULT 0,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE leave_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view leave allocations"
  ON leave_allocations FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Super admin can manage leave allocations"
  ON leave_allocations FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update leave allocations"
  ON leave_allocations FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete leave allocations"
  ON leave_allocations FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Leave Applications
CREATE TABLE IF NOT EXISTS leave_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  leave_type_id uuid REFERENCES leave_types(id) ON DELETE SET NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  days integer DEFAULT 1,
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view own leave applications"
  ON leave_applications FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND (staff_id = auth.uid() OR get_my_role() = 'super_admin'));
CREATE POLICY "Staff can insert leave applications"
  ON leave_applications FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND staff_id = auth.uid());
CREATE POLICY "Super admin can update leave applications"
  ON leave_applications FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND (staff_id = auth.uid() OR get_my_role() = 'super_admin'))
  WITH CHECK (school_id = get_my_school_id());
CREATE POLICY "Super admin can delete leave applications"
  ON leave_applications FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND (staff_id = auth.uid() OR get_my_role() = 'super_admin'));

-- Staff Attendance Records
CREATE TABLE IF NOT EXISTS staff_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'holiday', 'on_leave')),
  in_time time,
  out_time time,
  note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(staff_id, date)
);
ALTER TABLE staff_attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view staff attendance"
  ON staff_attendance_records FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND (staff_id = auth.uid() OR get_my_role() = 'super_admin'));
CREATE POLICY "Super admin can insert staff attendance"
  ON staff_attendance_records FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update staff attendance"
  ON staff_attendance_records FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete staff attendance"
  ON staff_attendance_records FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Payroll Records
CREATE TABLE IF NOT EXISTS payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL,
  basic_salary numeric(12,2) DEFAULT 0,
  allowances numeric(12,2) DEFAULT 0,
  deductions numeric(12,2) DEFAULT 0,
  net_salary numeric(12,2) DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'paid')),
  payment_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(staff_id, month, year)
);
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view own payroll"
  ON payroll_records FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND (staff_id = auth.uid() OR get_my_role() = 'super_admin'));
CREATE POLICY "Super admin can insert payroll"
  ON payroll_records FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can update payroll"
  ON payroll_records FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
CREATE POLICY "Super admin can delete payroll"
  ON payroll_records FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subject_teacher_assignments_class ON subject_teacher_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_routines_class ON class_routines(class_id);
CREATE INDEX IF NOT EXISTS idx_leave_applications_staff ON leave_applications(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_date ON staff_attendance_records(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_payroll_staff_month ON payroll_records(staff_id, month, year);
