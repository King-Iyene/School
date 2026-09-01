/*
  # Add DELETE policy for subjects table

  1. Changes
    - Adds a DELETE RLS policy for the `subjects` table
    - Only super_admin users can delete subjects in their school

  2. Reason
    - The subjects table was missing a DELETE policy, causing subject
      deletion to silently fail for all users including super_admin
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subjects' AND policyname = 'Admins can delete subjects'
  ) THEN
    CREATE POLICY "Admins can delete subjects"
      ON subjects
      FOR DELETE
      TO authenticated
      USING (
        school_id = get_my_school_id() AND get_my_role() = 'super_admin'
      );
  END IF;
END $$;
