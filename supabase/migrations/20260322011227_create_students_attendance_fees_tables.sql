/*
  # Create Students, Attendance, and Fee Management Tables

  ## New Tables

  ### students
  Standalone student records table (decoupled from auth users)
  - admission_number: auto-generated unique identifier per school (format: OGS/YEAR/NNN)
  - class_id: links to classes table
  - guardian info: name, phone, email
  - status: active, inactive, graduated, transferred

  ### student_attendance
  Tracks daily attendance per student
  - References students.id (not profiles)
  - Unique constraint: one record per student per date
  - status: present, absent, late

  ### student_fee_payments
  Records fee payments made by/for students
  - References students.id (not profiles)
  - Links to fee_structures for fee type
  - Includes payment method, receipt number

  ## Security
  - RLS enabled on all three tables
  - School-scoped SELECT for all authenticated users
  - INSERT/UPDATE/DELETE restricted to super_admin (students/attendance also allows teacher for attendance)
*/

-- ============ STUDENTS TABLE ============
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  admission_number text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  section text DEFAULT '',
  date_of_birth date,
  gender text DEFAULT '' CHECK (gender IN ('male', 'female', 'other', '')),
  address text DEFAULT '',
  guardian_name text DEFAULT '',
  guardian_phone text DEFAULT '',
  guardian_email text DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'transferred')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (school_id, admission_number)
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view students"
  ON students FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert students"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = 'super_admin'
  );

CREATE POLICY "Admins can update students"
  ON students FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Admins can delete students"
  ON students FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- ============ STUDENT ATTENDANCE TABLE ============
CREATE TABLE IF NOT EXISTS student_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late')),
  recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (student_id, date)
);

ALTER TABLE student_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view student_attendance"
  ON student_attendance FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins and teachers can insert student_attendance"
  ON student_attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() IN ('super_admin', 'teacher')
  );

CREATE POLICY "Admins and teachers can update student_attendance"
  ON student_attendance FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

CREATE POLICY "Admins can delete student_attendance"
  ON student_attendance FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- ============ STUDENT FEE PAYMENTS TABLE ============
CREATE TABLE IF NOT EXISTS student_fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_structure_id uuid REFERENCES fee_structures(id) ON DELETE SET NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'pos', 'online', 'cheque')),
  receipt_number text,
  notes text DEFAULT '',
  recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE student_fee_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view student_fee_payments"
  ON student_fee_payments FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert student_fee_payments"
  ON student_fee_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() IN ('super_admin', 'accountant')
  );

CREATE POLICY "Admins can update student_fee_payments"
  ON student_fee_payments FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can delete student_fee_payments"
  ON student_fee_payments FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'accountant'));
