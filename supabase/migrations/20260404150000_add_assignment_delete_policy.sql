-- Add missing DELETE policy for assignments table
-- This allows teachers and super admins to delete assignments

DROP POLICY IF EXISTS "Teachers can delete own assignments" ON public.assignments;
CREATE POLICY "Teachers can delete own assignments"
  ON assignments FOR DELETE
  TO authenticated
  USING (
    teacher_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Also add a policy for assignment_submissions to ensure they can be viewed/managed
-- (Usually handled by CASCADE, but good to have explicit SELECT/DELETE if needed)

-- Force postgrest reload
NOTIFY pgrst, 'reload schema';
