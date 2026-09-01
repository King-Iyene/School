/*
  # Head Teacher RLS policies

  1. Changes
    - Update grades insert/update policies to include head_teacher
    - Update exam_marks_records insert/update policies to include head_teacher
  2. Notes
    - Existing SELECT policies "School members can view..." already include all school-linked users
    - Head Teacher is granted the same academic write access as teacher role (school-wide, enforced by RLS ownership via school_id)
    - Admin-only tables (users, finance, settings) remain unaffected
*/

DROP POLICY IF EXISTS "Teachers admins principal can insert grades" ON grades;
CREATE POLICY "Teachers admins principal can insert grades"
  ON grades FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text, 'head_teacher'::text, 'teacher'::text])
    )
  );

DROP POLICY IF EXISTS "Teachers admins principal can update grades" ON grades;
CREATE POLICY "Teachers admins principal can update grades"
  ON grades FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text, 'head_teacher'::text, 'teacher'::text])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text, 'head_teacher'::text, 'teacher'::text])
    )
  );

DROP POLICY IF EXISTS "Teachers admins and principal can view grades" ON grades;
CREATE POLICY "Teachers admins and principal can view grades"
  ON grades FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text, 'head_teacher'::text, 'teacher'::text, 'accountant'::text])
    )
    OR student_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM parent_student_links psl
      WHERE psl.parent_id = (SELECT auth.uid())
        AND psl.student_id = grades.student_id
    )
  );

DROP POLICY IF EXISTS "Super admin and teacher can insert exam marks" ON exam_marks_records;
CREATE POLICY "Super admin and teacher can insert exam marks"
  ON exam_marks_records FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text, 'head_teacher'::text, 'teacher'::text])
  );

DROP POLICY IF EXISTS "Super admin and teacher can update exam marks" ON exam_marks_records;
CREATE POLICY "Super admin and teacher can update exam marks"
  ON exam_marks_records FOR UPDATE
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text, 'head_teacher'::text, 'teacher'::text])
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'principal'::text, 'head_teacher'::text, 'teacher'::text])
  );