/*
  # Fix Recursive RLS on Profiles Table

  ## Problem
  The "Users in same school can view profiles" SELECT policy uses an inline
  subquery that queries the profiles table from within a profiles policy,
  causing infinite recursion when any authenticated user attempts to read
  their own profile.

  ## Fix
  Drop the recursive policy and replace it with a version that calls the
  existing SECURITY DEFINER function get_my_school_id(), which bypasses RLS
  and breaks the recursion cycle.

  This also ensures the "Super admins can insert profiles" policy uses the
  correct SECURITY DEFINER helper rather than a raw subquery.
*/

DROP POLICY IF EXISTS "Users in same school can view profiles" ON profiles;

CREATE POLICY "Users in same school can view profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    school_id IS NOT NULL AND
    school_id = get_my_school_id()
  );
