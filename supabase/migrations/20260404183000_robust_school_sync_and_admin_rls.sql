-- Robust School Association Sync & Super Admin visibility fix
-- This migration ensures ALL rows have a school_id and Super Admins can ALWAYS see the data.

-- 1. Ensure a school exists
DO $$ 
DECLARE
  v_school_id UUID;
BEGIN
  -- Get the first school ID
  SELECT id INTO v_school_id FROM public.schools LIMIT 1;

  -- 2. Backfill profiles
  UPDATE public.profiles SET school_id = v_school_id WHERE school_id IS NULL;

  -- 3. Backfill leave_types
  UPDATE public.leave_types SET school_id = v_school_id WHERE school_id IS NULL;

  -- 4. Backfill leave_allocations
  UPDATE public.leave_allocations SET school_id = v_school_id WHERE school_id IS NULL;

  -- 5. Backfill leave_applications
  UPDATE public.leave_applications la 
  SET school_id = COALESCE(la.school_id, (SELECT school_id FROM public.profiles WHERE id = la.staff_id), v_school_id)
  WHERE school_id IS NULL;
END $$;

-- 6. Robust Profiles RLS for Super Admin (Non-recursive)
DROP POLICY IF EXISTS "Super admins can view all profiles in their school" ON public.profiles;
CREATE POLICY "Super admins can view all profiles in their school" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'super_admin' 
    AND school_id = get_my_school_id()
  );

-- 7. Robust Leave Applications RLS for Super Admin
DROP POLICY IF EXISTS "Super admins can view all school leave applications" ON public.leave_applications;
CREATE POLICY "Super admins can view all school leave applications" ON public.leave_applications
  FOR SELECT TO authenticated
  USING (
    staff_id = auth.uid() 
    OR (get_my_role() = 'super_admin' AND (school_id = get_my_school_id() OR school_id IS NULL))
  );

-- 8. Robust Leave Types RLS for Super Admin
DROP POLICY IF EXISTS "School members can view leave types" ON public.leave_types;
CREATE POLICY "School members can view leave types" ON public.leave_types
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    OR get_my_role() = 'super_admin'
  );

NOTIFY pgrst, 'reload schema';
