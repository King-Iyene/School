-- Drop the existing policy
DROP POLICY IF EXISTS "Students in class can view assignments" ON assignments;

-- Create a robust SELECT policy using helper functions
CREATE POLICY "Users can view relevant assignments"
  ON assignments FOR SELECT
  TO authenticated
  USING (
    -- 1. Teachers and admins can view assignments (using helper to bypass profiles RLS)
    get_my_role() IN ('super_admin', 'teacher', 'accountant')
    -- 2. Students can view assignments for their classes
    OR class_id IN (
      SELECT enrollment.class_id FROM student_enrollments enrollment
      WHERE enrollment.student_id = auth.uid()
    )
    -- 3. Ensure teachers can always see their own
    OR teacher_id = auth.uid()
  );
