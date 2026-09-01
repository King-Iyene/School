/*
  # Fix student_attendance RLS — Form Masters only for teachers

  ## Changes
  1. DROP existing INSERT/UPDATE/DELETE policies
  2. Recreate INSERT — only super_admin/admin/principal OR Form Master of the class
  3. Recreate UPDATE — same restriction
  4. Recreate DELETE — super_admin/admin/principal only
  5. SELECT remains unchanged (all school members can view)

  A "Form Master" is a teacher who either:
    a. Is the class_teacher_id on the classes row, OR
    b. Has a record in class_teachers matching their teacher_id and the class_id
*/

-- Drop old policies
DROP POLICY IF EXISTS "Admins and teachers can insert student_attendance" ON student_attendance;
DROP POLICY IF EXISTS "Admins and teachers can update student_attendance" ON student_attendance;
DROP POLICY IF EXISTS "Admins can delete student_attendance" ON student_attendance;

-- INSERT: admin roles + form masters only
CREATE POLICY "Form masters and admins can insert attendance"
  ON student_attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND (
      get_my_role() = ANY(ARRAY['super_admin','admin','principal'])
      OR (
        get_my_role() = 'teacher'
        AND (
          EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = student_attendance.class_id
              AND classes.class_teacher_id = (SELECT auth.uid())
          )
          OR EXISTS (
            SELECT 1 FROM class_teachers
            WHERE class_teachers.class_id = student_attendance.class_id
              AND class_teachers.teacher_id = (SELECT auth.uid())
          )
        )
      )
    )
  );

-- UPDATE: same restriction
CREATE POLICY "Form masters and admins can update attendance"
  ON student_attendance FOR UPDATE
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND (
      get_my_role() = ANY(ARRAY['super_admin','admin','principal'])
      OR (
        get_my_role() = 'teacher'
        AND (
          EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = student_attendance.class_id
              AND classes.class_teacher_id = (SELECT auth.uid())
          )
          OR EXISTS (
            SELECT 1 FROM class_teachers
            WHERE class_teachers.class_id = student_attendance.class_id
              AND class_teachers.teacher_id = (SELECT auth.uid())
          )
        )
      )
    )
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND (
      get_my_role() = ANY(ARRAY['super_admin','admin','principal'])
      OR (
        get_my_role() = 'teacher'
        AND (
          EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = student_attendance.class_id
              AND classes.class_teacher_id = (SELECT auth.uid())
          )
          OR EXISTS (
            SELECT 1 FROM class_teachers
            WHERE class_teachers.class_id = student_attendance.class_id
              AND class_teachers.teacher_id = (SELECT auth.uid())
          )
        )
      )
    )
  );

-- DELETE: admins/principal only
CREATE POLICY "Admins can delete student_attendance"
  ON student_attendance FOR DELETE
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY(ARRAY['super_admin','admin','principal'])
  );
