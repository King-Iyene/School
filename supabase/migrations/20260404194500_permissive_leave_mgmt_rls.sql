-- Comprehensive RLS Fix for Leave Management (Editable by Staff & Admins)
-- This ensures staff can edit/delete their own pending leaves.

-- 1. Correct any naming confusion and simplify policies
DROP POLICY IF EXISTS "Users can update own pending leave" ON public.leave_applications;
DROP POLICY IF EXISTS "Super admin can update leave applications" ON public.leave_applications;
CREATE POLICY "Allow update for owners and admins" ON public.leave_applications
  FOR UPDATE TO authenticated
  USING (
    (staff_id = auth.uid() AND status = 'pending')
    OR get_my_role() IN ('super_admin', 'admin')
  );

DROP POLICY IF EXISTS "Super admin can delete leave applications" ON public.leave_applications;
CREATE POLICY "Allow delete for owners and admins" ON public.leave_applications
  FOR DELETE TO authenticated
  USING (
    (staff_id = auth.uid() AND status = 'pending')
    OR get_my_role() IN ('super_admin', 'admin')
  );

-- 2. Consistency for Insertion (Allow staff to insert their own)
DROP POLICY IF EXISTS "Staff can insert leave applications" ON public.leave_applications;
CREATE POLICY "Allow insert for staff and admins" ON public.leave_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    staff_id = auth.uid() 
    OR get_my_role() IN ('super_admin', 'admin')
  );

NOTIFY pgrst, 'reload schema';
