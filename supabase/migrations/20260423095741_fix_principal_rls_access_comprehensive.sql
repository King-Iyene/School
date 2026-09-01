/*
  # Fix Principal Role RLS Access — Comprehensive

  ## Problem
  The `principal` role was added to the system (April 2026) but was never added to
  SELECT (read) RLS policies on most tables. Principals can navigate the app but RLS
  silently blocks every data query — so teachers enter scores and principals see nothing.

  ## Changes
  Adds `principal` to:
  1. grades — SELECT (was missing), INSERT, UPDATE (ensure consistent)
  2. assignments — SELECT, INSERT, UPDATE for principal
  3. assignment_submissions — SELECT, UPDATE for principal
  4. fee_structures — SELECT, INSERT, UPDATE
  5. fee_payments — SELECT, INSERT, UPDATE
  6. timetable — INSERT, UPDATE
  7. leave_applications — SELECT, INSERT, UPDATE, DELETE (full management)
  8. staff_attendance_records — SELECT already works; INSERT/UPDATE/DELETE fixed
  9. payroll_records — SELECT for principal (currently only own staff)
  10. staff_hr_details — SELECT, INSERT, UPDATE for principal
  11. profiles — SELECT: principal can see all school profiles
  12. parent_student_links — INSERT, UPDATE, DELETE
  13. announcements — INSERT, UPDATE
  14. whatsapp_settings — SELECT, INSERT, UPDATE
  15. notification_triggers — SELECT, INSERT, UPDATE

  ## Safety
  All data is preserved — only policy definitions change.
  Uses DROP POLICY IF EXISTS to avoid errors on policies that may already differ.
*/

-- ============================================================
-- 1. GRADES — Fix SELECT (the critical missing piece)
-- ============================================================
DROP POLICY IF EXISTS "Teachers and admins can view grades" ON grades;
DROP POLICY IF EXISTS "Teachers admins and principal can view grades" ON grades;

CREATE POLICY "Teachers admins and principal can view grades"
  ON grades FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'teacher', 'accountant')
    )
    OR student_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM parent_student_links psl
      WHERE psl.parent_id = (SELECT auth.uid()) AND psl.student_id = grades.student_id
    )
  );

-- Ensure INSERT includes principal
DROP POLICY IF EXISTS "Teachers can insert grades" ON grades;
DROP POLICY IF EXISTS "Teachers admins principal can insert grades" ON grades;

CREATE POLICY "Teachers admins principal can insert grades"
  ON grades FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'teacher')
    )
  );

-- Ensure UPDATE includes principal
DROP POLICY IF EXISTS "Teachers can update grades" ON grades;
DROP POLICY IF EXISTS "Teachers admins principal can update grades" ON grades;

CREATE POLICY "Teachers admins principal can update grades"
  ON grades FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'teacher')
    )
  );

-- ============================================================
-- 2. ASSIGNMENTS — Principal can view and manage
-- ============================================================
DROP POLICY IF EXISTS "Teachers can create assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers admins principal can create assignments" ON assignments;

CREATE POLICY "Teachers admins principal can create assignments"
  ON assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'teacher')
    )
  );

DROP POLICY IF EXISTS "Teachers can update own assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers admins principal can update assignments" ON assignments;

CREATE POLICY "Teachers admins principal can update assignments"
  ON assignments FOR UPDATE
  TO authenticated
  USING (
    teacher_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  )
  WITH CHECK (
    teacher_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

DROP POLICY IF EXISTS "Admins and principal can view all assignments" ON assignments;

CREATE POLICY "Admins and principal can view all assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
    OR teacher_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM class_subjects cs
      WHERE cs.class_id = assignments.class_id AND cs.teacher_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM student_enrollments se
      WHERE se.student_id = (SELECT auth.uid())
      AND se.class_id = assignments.class_id
      AND se.status = 'active'
    )
  );

-- ============================================================
-- 3. ASSIGNMENT SUBMISSIONS — Principal can view/grade
-- ============================================================
DROP POLICY IF EXISTS "Teachers can view submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Teachers admins principal can view submissions" ON assignment_submissions;

CREATE POLICY "Teachers admins principal can view submissions"
  ON assignment_submissions FOR SELECT
  TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'teacher')
    )
  );

DROP POLICY IF EXISTS "Teachers can grade submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Teachers admins principal can grade submissions" ON assignment_submissions;

CREATE POLICY "Teachers admins principal can grade submissions"
  ON assignment_submissions FOR UPDATE
  TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'teacher')
    )
  )
  WITH CHECK (
    student_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'teacher')
    )
  );

-- ============================================================
-- 4. FEE STRUCTURES — Principal can view and manage
-- ============================================================
DROP POLICY IF EXISTS "Accountants can insert fee structures" ON fee_structures;
DROP POLICY IF EXISTS "Accountants admins principal can insert fee structures" ON fee_structures;

CREATE POLICY "Accountants admins principal can insert fee structures"
  ON fee_structures FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'accountant')
    )
  );

DROP POLICY IF EXISTS "Accountants can update fee structures" ON fee_structures;
DROP POLICY IF EXISTS "Accountants admins principal can update fee structures" ON fee_structures;

CREATE POLICY "Accountants admins principal can update fee structures"
  ON fee_structures FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'accountant')
    )
  );

DROP POLICY IF EXISTS "Principal can view fee structures" ON fee_structures;

CREATE POLICY "Principal can view fee structures"
  ON fee_structures FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'accountant', 'teacher')
    )
  );

-- ============================================================
-- 5. FEE PAYMENTS — Principal can view and record
-- ============================================================
DROP POLICY IF EXISTS "Accountants and admins can view all payments" ON fee_payments;
DROP POLICY IF EXISTS "Accountants admins principal can view all payments" ON fee_payments;

CREATE POLICY "Accountants admins principal can view all payments"
  ON fee_payments FOR SELECT
  TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'accountant')
    )
    OR EXISTS (
      SELECT 1 FROM parent_student_links psl
      WHERE psl.parent_id = (SELECT auth.uid()) AND psl.student_id = fee_payments.student_id
    )
  );

DROP POLICY IF EXISTS "Accountants can record payments" ON fee_payments;
DROP POLICY IF EXISTS "Accountants admins principal can record payments" ON fee_payments;

CREATE POLICY "Accountants admins principal can record payments"
  ON fee_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'accountant')
    )
  );

DROP POLICY IF EXISTS "Accountants can update payments" ON fee_payments;
DROP POLICY IF EXISTS "Accountants admins principal can update payments" ON fee_payments;

CREATE POLICY "Accountants admins principal can update payments"
  ON fee_payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'accountant')
    )
  );

-- ============================================================
-- 6. TIMETABLE — Principal can manage
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage timetable insert" ON timetable;
DROP POLICY IF EXISTS "Admins and principal can insert timetable" ON timetable;

CREATE POLICY "Admins and principal can insert timetable"
  ON timetable FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

DROP POLICY IF EXISTS "Admins can manage timetable update" ON timetable;
DROP POLICY IF EXISTS "Admins and principal can update timetable" ON timetable;

CREATE POLICY "Admins and principal can update timetable"
  ON timetable FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

-- ============================================================
-- 7. LEAVE APPLICATIONS — Principal can view and manage
--    (leave_applications uses: id, school_id, staff_id, leave_type_id,
--     from_date, to_date, days, reason, status, approved_by, remarks)
-- ============================================================
DROP POLICY IF EXISTS "Super admin can update leave applications" ON leave_applications;
DROP POLICY IF EXISTS "Super admin can delete leave applications" ON leave_applications;
DROP POLICY IF EXISTS "Allow update for owners and admins" ON leave_applications;
DROP POLICY IF EXISTS "Allow delete for owners and admins" ON leave_applications;
DROP POLICY IF EXISTS "Allow insert for staff and admins" ON leave_applications;
DROP POLICY IF EXISTS "Staff can insert leave applications" ON leave_applications;
DROP POLICY IF EXISTS "Super admins can view all school leave applications" ON leave_applications;
DROP POLICY IF EXISTS "Super admins view all applications" ON leave_applications;
DROP POLICY IF EXISTS "Admins can view all leave applications" ON leave_applications;
DROP POLICY IF EXISTS "Staff can view own leave applications" ON leave_applications;
DROP POLICY IF EXISTS "Admins and principal can view all leave" ON leave_applications;
DROP POLICY IF EXISTS "Admins and principal can update leave applications" ON leave_applications;
DROP POLICY IF EXISTS "Admins and principal can delete leave applications" ON leave_applications;
DROP POLICY IF EXISTS "Staff and admins can insert leave applications" ON leave_applications;

CREATE POLICY "Staff and admins can view leave applications"
  ON leave_applications FOR SELECT
  TO authenticated
  USING (
    staff_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

CREATE POLICY "Staff and admins can insert leave applications"
  ON leave_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    staff_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

CREATE POLICY "Admins and principal can update leave applications"
  ON leave_applications FOR UPDATE
  TO authenticated
  USING (
    staff_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  )
  WITH CHECK (
    staff_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

CREATE POLICY "Admins and principal can delete leave applications"
  ON leave_applications FOR DELETE
  TO authenticated
  USING (
    staff_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

-- ============================================================
-- 8. STAFF ATTENDANCE RECORDS — Principal can fully manage
--    (columns: id, school_id, staff_id, date, status, in_time, out_time, note, created_at, is_locked)
-- ============================================================
DROP POLICY IF EXISTS "School members can view staff attendance" ON staff_attendance_records;
DROP POLICY IF EXISTS "Super admin can insert staff attendance" ON staff_attendance_records;
DROP POLICY IF EXISTS "Super admin can update staff attendance" ON staff_attendance_records;
DROP POLICY IF EXISTS "Super admin can delete staff attendance" ON staff_attendance_records;
DROP POLICY IF EXISTS "Admins and principal can insert staff attendance" ON staff_attendance_records;
DROP POLICY IF EXISTS "Admins and principal can update staff attendance" ON staff_attendance_records;
DROP POLICY IF EXISTS "Admins and principal can delete staff attendance" ON staff_attendance_records;

CREATE POLICY "School members can view staff attendance"
  ON staff_attendance_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.school_id = staff_attendance_records.school_id
    )
  );

CREATE POLICY "Admins and principal can insert staff attendance"
  ON staff_attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

CREATE POLICY "Admins and principal can update staff attendance"
  ON staff_attendance_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

CREATE POLICY "Admins and principal can delete staff attendance"
  ON staff_attendance_records FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

-- ============================================================
-- 9. PAYROLL RECORDS — Principal can view all
--    (columns: id, school_id, staff_id, month, year, ...)
-- ============================================================
DROP POLICY IF EXISTS "Staff can view own payroll" ON payroll_records;
DROP POLICY IF EXISTS "Admins and principal can insert payroll" ON payroll_records;
DROP POLICY IF EXISTS "Admins and principal can update payroll" ON payroll_records;

CREATE POLICY "Staff can view own payroll"
  ON payroll_records FOR SELECT
  TO authenticated
  USING (
    staff_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'accountant')
    )
  );

CREATE POLICY "Admins and principal can insert payroll"
  ON payroll_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'accountant')
    )
  );

CREATE POLICY "Admins and principal can update payroll"
  ON payroll_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'accountant')
    )
  );

-- ============================================================
-- 10. STAFF HR DETAILS — Principal can view and manage
--     (columns use profile_id, not staff_id)
-- ============================================================
DROP POLICY IF EXISTS "Staff view own HR details" ON staff_hr_details;
DROP POLICY IF EXISTS "Admins can manage HR details" ON staff_hr_details;
DROP POLICY IF EXISTS "Admins and principal can manage HR details" ON staff_hr_details;
DROP POLICY IF EXISTS "Admins and principal can update HR details" ON staff_hr_details;

CREATE POLICY "Staff view own HR details"
  ON staff_hr_details FOR SELECT
  TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

CREATE POLICY "Admins and principal can manage HR details"
  ON staff_hr_details FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

CREATE POLICY "Admins and principal can update HR details"
  ON staff_hr_details FOR UPDATE
  TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  )
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

-- ============================================================
-- 11. PROFILES — Principal can see all profiles in their school
-- ============================================================
DROP POLICY IF EXISTS "Super admins can view all profiles in their school" ON profiles;
DROP POLICY IF EXISTS "Super admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins and principal can view all school profiles" ON profiles;

CREATE POLICY "Admins and principal can view all school profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles viewer
      WHERE viewer.id = (SELECT auth.uid())
      AND viewer.role IN ('super_admin', 'admin', 'principal')
      AND viewer.school_id = profiles.school_id
    )
  );

-- ============================================================
-- 12. PARENT STUDENT LINKS — Principal can manage
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert parent links" ON parent_student_links;
DROP POLICY IF EXISTS "Admins can update parent links" ON parent_student_links;
DROP POLICY IF EXISTS "Admins can manage parent links" ON parent_student_links;
DROP POLICY IF EXISTS "Admins and principal can insert parent links" ON parent_student_links;
DROP POLICY IF EXISTS "Admins and principal can update parent links" ON parent_student_links;
DROP POLICY IF EXISTS "Admins and principal can delete parent links" ON parent_student_links;

CREATE POLICY "Admins and principal can insert parent links"
  ON parent_student_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

CREATE POLICY "Admins and principal can update parent links"
  ON parent_student_links FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

CREATE POLICY "Admins and principal can delete parent links"
  ON parent_student_links FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

-- ============================================================
-- 13. ANNOUNCEMENTS — Principal can create/update
--     (columns: id, school_id, author_id, title, content, ...)
-- ============================================================
DROP POLICY IF EXISTS "Staff can create announcements" ON announcements;
DROP POLICY IF EXISTS "Staff admins and principal can create announcements" ON announcements;

CREATE POLICY "Staff admins and principal can create announcements"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal', 'teacher')
    )
  );

DROP POLICY IF EXISTS "Authors and admins can update announcements" ON announcements;
DROP POLICY IF EXISTS "Authors admins and principal can update announcements" ON announcements;

CREATE POLICY "Authors admins and principal can update announcements"
  ON announcements FOR UPDATE
  TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  )
  WITH CHECK (
    author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

-- ============================================================
-- 14. WHATSAPP SETTINGS — Principal can manage
-- ============================================================
DROP POLICY IF EXISTS "Admins can read own school whatsapp settings" ON whatsapp_settings;
DROP POLICY IF EXISTS "Admins can insert whatsapp settings" ON whatsapp_settings;
DROP POLICY IF EXISTS "Admins can update whatsapp settings" ON whatsapp_settings;
DROP POLICY IF EXISTS "Admins and principal can read whatsapp settings" ON whatsapp_settings;
DROP POLICY IF EXISTS "Admins and principal can insert whatsapp settings" ON whatsapp_settings;
DROP POLICY IF EXISTS "Admins and principal can update whatsapp settings" ON whatsapp_settings;

CREATE POLICY "Admins and principal can read whatsapp settings"
  ON whatsapp_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
      AND p.school_id = whatsapp_settings.school_id
    )
  );

CREATE POLICY "Admins and principal can insert whatsapp settings"
  ON whatsapp_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

CREATE POLICY "Admins and principal can update whatsapp settings"
  ON whatsapp_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

-- ============================================================
-- 15. NOTIFICATION TRIGGERS — Principal can manage
-- ============================================================
DROP POLICY IF EXISTS "Admins can read notification triggers" ON notification_triggers;
DROP POLICY IF EXISTS "Admins can insert notification triggers" ON notification_triggers;
DROP POLICY IF EXISTS "Admins can update notification triggers" ON notification_triggers;
DROP POLICY IF EXISTS "Admins and principal can read notification triggers" ON notification_triggers;
DROP POLICY IF EXISTS "Admins and principal can insert notification triggers" ON notification_triggers;
DROP POLICY IF EXISTS "Admins and principal can update notification triggers" ON notification_triggers;

CREATE POLICY "Admins and principal can read notification triggers"
  ON notification_triggers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

CREATE POLICY "Admins and principal can insert notification triggers"
  ON notification_triggers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

CREATE POLICY "Admins and principal can update notification triggers"
  ON notification_triggers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );
