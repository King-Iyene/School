/*
  # Fix Infinite Recursion in RLS Policies

  The profiles table policies were querying profiles FROM profiles,
  causing infinite recursion. Fix by using a SECURITY DEFINER function
  that bypasses RLS to look up the current user's school_id.
*/

CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users in same school can view profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Super admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Super admins can insert profiles" ON profiles;

DROP POLICY IF EXISTS "Admins can manage schools insert" ON schools;
DROP POLICY IF EXISTS "Admins can manage schools update" ON schools;

DROP POLICY IF EXISTS "School members can view academic years" ON academic_years;
DROP POLICY IF EXISTS "Admins can insert academic years" ON academic_years;
DROP POLICY IF EXISTS "Admins can update academic years" ON academic_years;

DROP POLICY IF EXISTS "School members can view terms" ON terms;
DROP POLICY IF EXISTS "Admins can insert terms" ON terms;
DROP POLICY IF EXISTS "Admins can update terms" ON terms;

DROP POLICY IF EXISTS "School members can view classes" ON classes;
DROP POLICY IF EXISTS "Admins and teachers can insert classes" ON classes;
DROP POLICY IF EXISTS "Admins can update classes" ON classes;

DROP POLICY IF EXISTS "School members can view subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can manage subjects insert" ON subjects;
DROP POLICY IF EXISTS "Admins can manage subjects update" ON subjects;

DROP POLICY IF EXISTS "School members can view class subjects" ON class_subjects;
DROP POLICY IF EXISTS "Admins can manage class subjects insert" ON class_subjects;
DROP POLICY IF EXISTS "Admins can manage class subjects update" ON class_subjects;

DROP POLICY IF EXISTS "Students can view own enrollments" ON student_enrollments;
DROP POLICY IF EXISTS "School members can view enrollments" ON student_enrollments;
DROP POLICY IF EXISTS "Admins can manage enrollments insert" ON student_enrollments;
DROP POLICY IF EXISTS "Admins can manage enrollments update" ON student_enrollments;

DROP POLICY IF EXISTS "Teachers and admins can view attendance" ON attendance;
DROP POLICY IF EXISTS "School members can view fee structures" ON fee_structures;
DROP POLICY IF EXISTS "School members can view announcements" ON announcements;
DROP POLICY IF EXISTS "School members can view events" ON events;
DROP POLICY IF EXISTS "School members can view timetable" ON timetable;

-- PROFILES policies (no self-referencing)
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users in same school can view profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    school_id IS NOT NULL AND
    school_id = get_my_school_id()
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admins can update any profile"
  ON profiles FOR UPDATE TO authenticated
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- SCHOOLS policies
CREATE POLICY "Admins can insert schools"
  ON schools FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'super_admin');

CREATE POLICY "Admins can update schools"
  ON schools FOR UPDATE TO authenticated
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- ACADEMIC YEARS policies
CREATE POLICY "School members can view academic years"
  ON academic_years FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert academic years"
  ON academic_years FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can update academic years"
  ON academic_years FOR UPDATE TO authenticated
  USING (get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('super_admin', 'accountant'));

-- TERMS policies
CREATE POLICY "School members can view terms"
  ON terms FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert terms"
  ON terms FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('super_admin', 'accountant'));

CREATE POLICY "Admins can update terms"
  ON terms FOR UPDATE TO authenticated
  USING (get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('super_admin', 'accountant'));

-- CLASSES policies
CREATE POLICY "School members can view classes"
  ON classes FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert classes"
  ON classes FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('super_admin', 'teacher'));

CREATE POLICY "Admins can update classes"
  ON classes FOR UPDATE TO authenticated
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- SUBJECTS policies
CREATE POLICY "School members can view subjects"
  ON subjects FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert subjects"
  ON subjects FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'super_admin');

CREATE POLICY "Admins can update subjects"
  ON subjects FOR UPDATE TO authenticated
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- CLASS SUBJECTS policies
CREATE POLICY "School members can view class subjects"
  ON class_subjects FOR SELECT TO authenticated
  USING (
    class_id IN (
      SELECT id FROM classes WHERE school_id = get_my_school_id()
    )
  );

CREATE POLICY "Admins can insert class subjects"
  ON class_subjects FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'super_admin');

CREATE POLICY "Admins can update class subjects"
  ON class_subjects FOR UPDATE TO authenticated
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- STUDENT ENROLLMENTS policies
CREATE POLICY "Students can view own enrollments"
  ON student_enrollments FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Staff can view all enrollments"
  ON student_enrollments FOR SELECT TO authenticated
  USING (get_my_role() IN ('super_admin', 'teacher', 'accountant', 'parent'));

CREATE POLICY "Admins can insert enrollments"
  ON student_enrollments FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('super_admin', 'teacher', 'accountant'));

CREATE POLICY "Admins can update enrollments"
  ON student_enrollments FOR UPDATE TO authenticated
  USING (get_my_role() IN ('super_admin', 'accountant'))
  WITH CHECK (get_my_role() IN ('super_admin', 'accountant'));

-- ATTENDANCE policies
CREATE POLICY "Teachers and admins can view attendance"
  ON attendance FOR SELECT TO authenticated
  USING (get_my_role() IN ('super_admin', 'teacher', 'accountant'));

-- FEE STRUCTURES policies
CREATE POLICY "School members can view fee structures"
  ON fee_structures FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

-- ANNOUNCEMENTS policies
CREATE POLICY "School members can view announcements"
  ON announcements FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

-- EVENTS policies
CREATE POLICY "School members can view events"
  ON events FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

-- TIMETABLE policies
CREATE POLICY "School members can view timetable"
  ON timetable FOR SELECT TO authenticated
  USING (
    class_id IN (
      SELECT id FROM classes WHERE school_id = get_my_school_id()
    )
  );
