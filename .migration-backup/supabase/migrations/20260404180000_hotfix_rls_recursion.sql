-- Hotfix for RLS Infinite Recursion (resolves 500 Internal Server Error)
-- This migration replaces recursive SELECTs on the profiles table with safe SECURITY DEFINER functions.

-- 1. profiles
DROP POLICY IF EXISTS "Super admins can view all profiles in their school" ON public.profiles;
CREATE POLICY "Super admins can view all profiles in their school" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id() 
    AND get_my_role() = 'super_admin'
  );

-- 2. leave_applications
DROP POLICY IF EXISTS "Super admins can view all school leave applications" ON public.leave_applications;
CREATE POLICY "Super admins can view all school leave applications" ON public.leave_applications
  FOR SELECT TO authenticated
  USING (
    staff_id = auth.uid() 
    OR (get_my_role() = 'super_admin' AND school_id = get_my_school_id())
  );

-- 3. leave_types
DROP POLICY IF EXISTS "School members can view leave types" ON public.leave_types;
CREATE POLICY "School members can view leave types" ON public.leave_types
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    OR get_my_role() = 'super_admin'
  );

-- 4. leave_allocations
DROP POLICY IF EXISTS "School members can view leave allocations" ON public.leave_allocations;
CREATE POLICY "School members can view leave allocations" ON public.leave_allocations
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    OR get_my_role() = 'super_admin'
  );

NOTIFY pgrst, 'reload schema';
