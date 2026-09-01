-- Robust HR RLS Fix & Data Backfill
-- 1. Backfill missing school_id for legacy HR data
UPDATE public.leave_types lt
SET school_id = (SELECT school_id FROM public.profiles WHERE role = 'super_admin' LIMIT 1)
WHERE school_id IS NULL;

UPDATE public.leave_allocations la
SET school_id = (SELECT school_id FROM public.profiles WHERE role = 'super_admin' LIMIT 1)
WHERE school_id IS NULL;

UPDATE public.leave_applications la
SET school_id = (SELECT school_id FROM public.profiles WHERE id = la.staff_id)
WHERE school_id IS NULL;

-- 2. Ensure Super Admins can see all profiles in their school
DROP POLICY IF EXISTS "Users in same school can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles in their school" ON public.profiles;
CREATE POLICY "Super admins can view all profiles in their school" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- 3. Relax leave_applications SELECT policy for Super Admin
DROP POLICY IF EXISTS "Staff can view own leave applications" ON public.leave_applications;
CREATE POLICY "Super admins can view all school leave applications" ON public.leave_applications
  FOR SELECT TO authenticated
  USING (
    staff_id = auth.uid() 
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
      AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- 4. Relax leave_types SELECT policy for Super Admin
DROP POLICY IF EXISTS "School members can view leave types" ON public.leave_types;
CREATE POLICY "School members can view leave types" ON public.leave_types
  FOR SELECT TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

NOTIFY pgrst, 'reload schema';
