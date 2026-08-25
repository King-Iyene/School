/*
  # Add DELETE policy for classes table

  ## Problem
  The classes table was missing a DELETE policy, causing delete operations 
  to silently fail for all users including super admins.

  ## Changes
  - Add DELETE policy allowing super_admin to delete classes from their school
*/

CREATE POLICY "Admins can delete classes"
  ON classes FOR DELETE
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = 'super_admin'
  );
