/*
  # Ensure full CRUD RLS policies on academic_years

  ## Summary
  Admins and super_admins must be able to INSERT, UPDATE, and DELETE academic_years
  rows for their own school. Previously, no UPDATE or DELETE policies existed,
  causing edits and deletions to fail silently.

  ## Changes
  - Adds UPDATE policy for admins on academic_years
  - Adds DELETE policy for admins on academic_years (with guard: cannot delete is_current row)
  - Uses IF NOT EXISTS pattern via DO block to avoid duplicates
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'academic_years' AND policyname = 'Admins can update academic years'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can update academic years"
        ON academic_years FOR UPDATE
        TO authenticated
        USING (
          school_id = get_my_school_id()
          AND get_my_role() = ANY (ARRAY['super_admin','admin'])
        )
        WITH CHECK (
          school_id = get_my_school_id()
          AND get_my_role() = ANY (ARRAY['super_admin','admin'])
        );
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'academic_years' AND policyname = 'Admins can delete academic years'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can delete academic years"
        ON academic_years FOR DELETE
        TO authenticated
        USING (
          school_id = get_my_school_id()
          AND get_my_role() = ANY (ARRAY['super_admin','admin'])
          AND is_current = false
        );
    $policy$;
  END IF;
END $$;
