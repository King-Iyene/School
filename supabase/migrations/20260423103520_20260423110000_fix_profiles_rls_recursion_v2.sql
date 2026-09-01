/*
  # Fix Profiles RLS Infinite Recursion (urgent hotfix)

  ## Problem
  The migration 20260423095741 introduced a policy "Admins and principal can view all school profiles"
  that queries the profiles table from within a profiles RLS policy, causing infinite recursion
  (PostgreSQL error 42P17). This breaks all logins because AuthContext fetches the profile on startup.

  ## Fix
  Replace the recursive policy with one that uses the existing SECURITY DEFINER helper functions
  get_my_role() and get_my_school_id(), which bypass RLS and avoid recursion.

  All other policies from the previous migration are unaffected.
*/

-- Drop the recursive policy introduced in the last migration
DROP POLICY IF EXISTS "Admins and principal can view all school profiles" ON profiles;

-- Re-create it using security definer helpers (no recursion)
CREATE POLICY "Admins and principal can view all school profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (
      get_my_role() IN ('super_admin', 'admin', 'principal')
      AND get_my_school_id() = profiles.school_id
    )
  );
