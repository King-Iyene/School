-- Universal HR Visibility Fix
-- This migration ensures that both 'super_admin' and 'admin' roles can see all data.

-- 1. profiles SELECT policy
DROP POLICY IF EXISTS "Super admins can view all profiles in their school" ON public.profiles;
DROP POLICY IF EXISTS "Super admins view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() 
    OR get_my_role() IN ('super_admin', 'admin')
  );

-- 2. leave_applications SELECT policy
DROP POLICY IF EXISTS "Super admins can view all school leave applications" ON public.leave_applications;
DROP POLICY IF EXISTS "Super admins view all applications" ON public.leave_applications;
CREATE POLICY "Admins can view all leave applications" ON public.leave_applications
  FOR SELECT TO authenticated
  USING (
    staff_id = auth.uid() 
    OR get_my_role() IN ('super_admin', 'admin')
  );

-- 3. leave_types SELECT policy
DROP POLICY IF EXISTS "School members can view leave types" ON public.leave_types;
CREATE POLICY "Admins can view all leave types" ON public.leave_types
  FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('super_admin', 'admin', 'teacher', 'accountant', 'parent', 'student')
  );

NOTIFY pgrst, 'reload schema';
