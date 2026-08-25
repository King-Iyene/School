-- Optimize RLS Policies for HR and Leave Management
-- This migration replaces unreliable function calls with high-performance subqueries
-- and ensures Super Admins have full access to manage HR data.

-- 1. leave_types
DROP POLICY IF EXISTS "School members can view leave types" ON public.leave_types;
CREATE POLICY "School members can view leave types" ON public.leave_types
  FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Super admin can insert leave types" ON public.leave_types;
CREATE POLICY "Super admin can insert leave types" ON public.leave_types
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) 
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Super admin can update leave types" ON public.leave_types;
CREATE POLICY "Super admin can update leave types" ON public.leave_types
  FOR UPDATE TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) 
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Super admin can delete leave types" ON public.leave_types;
CREATE POLICY "Super admin can delete leave types" ON public.leave_types
  FOR DELETE TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) 
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- 2. leave_allocations
DROP POLICY IF EXISTS "School members can view leave allocations" ON public.leave_allocations;
CREATE POLICY "School members can view leave allocations" ON public.leave_allocations
  FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Super admin can manage leave allocations" ON public.leave_allocations;
DROP POLICY IF EXISTS "Super admin can insert leave allocations" ON public.leave_allocations;
CREATE POLICY "Super admin can insert leave allocations" ON public.leave_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) 
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Super admin can update leave allocations" ON public.leave_allocations;
CREATE POLICY "Super admin can update leave allocations" ON public.leave_allocations
  FOR UPDATE TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) 
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Super admin can delete leave allocations" ON public.leave_allocations;
CREATE POLICY "Super admin can delete leave allocations" ON public.leave_allocations
  FOR DELETE TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) 
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- 3. leave_applications (Ensure full CRUD for admins)
DROP POLICY IF EXISTS "Staff can view own leave applications" ON public.leave_applications;
CREATE POLICY "Staff can view own leave applications" ON public.leave_applications
  FOR SELECT TO authenticated
  USING (
    staff_id = auth.uid() 
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Staff can insert leave applications" ON public.leave_applications;
CREATE POLICY "Staff can insert leave applications" ON public.leave_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    staff_id = auth.uid() 
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Super admin can update leave applications" ON public.leave_applications;
CREATE POLICY "Super admin can update leave applications" ON public.leave_applications
  FOR UPDATE TO authenticated
  USING (
    staff_id = auth.uid() 
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Super admin can delete leave applications" ON public.leave_applications;
CREATE POLICY "Super admin can delete leave applications" ON public.leave_applications
  FOR DELETE TO authenticated
  USING (
    staff_id = auth.uid() 
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- 4. staff_hr_details (Ensure full CRUD for admins)
DROP POLICY IF EXISTS "Staff view own HR details" ON public.staff_hr_details;
CREATE POLICY "Staff view own HR details" ON public.staff_hr_details
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid() 
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Admins can manage HR details" ON public.staff_hr_details;
CREATE POLICY "Admins can manage HR details" ON public.staff_hr_details
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

-- 5. staff_attendance_records (Ensure full CRUD for admins)
DROP POLICY IF EXISTS "School members can view staff attendance" ON public.staff_attendance_records;
CREATE POLICY "School members can view staff attendance" ON public.staff_attendance_records
  FOR SELECT TO authenticated
  USING (
    staff_id = auth.uid() 
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "Super admin can insert staff attendance" ON public.staff_attendance_records;
CREATE POLICY "Super admin can insert staff attendance" ON public.staff_attendance_records
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "Super admin can update staff attendance" ON public.staff_attendance_records;
CREATE POLICY "Super admin can update staff attendance" ON public.staff_attendance_records
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "Super admin can delete staff attendance" ON public.staff_attendance_records;
CREATE POLICY "Super admin can delete staff attendance" ON public.staff_attendance_records
  FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');

NOTIFY pgrst, 'reload schema';
