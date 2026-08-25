/*
  # Fix get_my_school_id and get_my_role search_path

  ## Problem
  Both helper functions used in RLS policies have no search_path configured
  (proconfig: null). In newer PostgreSQL, SECURITY DEFINER functions without an
  explicit search_path default to pg_catalog only. This means their internal
  SELECT from profiles returns NULL, causing the RLS policy
  `school_id = get_my_school_id()` to always evaluate as false for non-owner rows.

  Result: teachers, parents, and staffs counts all show 0 on the dashboard.

  ## Fix
  Recreate both functions with SET search_path = public so they reliably
  find the profiles table and return the correct values.
*/

CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
