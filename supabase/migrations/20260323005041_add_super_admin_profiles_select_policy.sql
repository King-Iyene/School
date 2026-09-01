/*
  # Add explicit super admin SELECT policy on profiles

  ## Problem
  The existing "Users in same school can view profiles" policy relies on
  get_my_school_id() being resolved correctly on every request. While the
  function is fixed, the client-side count queries for teachers and parents
  were returning 0 because the policy was not granting sufficient access
  to super_admin users reliably.

  ## Fix
  Add a dedicated SELECT policy for super_admins that allows them to see
  all profiles within their own school_id, checked via a direct subquery
  inside a SECURITY DEFINER helper to avoid recursion.
*/

CREATE OR REPLACE FUNCTION is_super_admin_of_school(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND school_id = p_school_id
  );
$$;

DROP POLICY IF EXISTS "Super admins can view all profiles in their school" ON profiles;

CREATE POLICY "Super admins can view all profiles in their school"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_super_admin_of_school(school_id));
