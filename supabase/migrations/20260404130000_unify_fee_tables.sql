-- Unify fee tables with the students registry
-- This ensures that joins from fee_payments and student_fee_payments to students table work correctly

-- 1. Unify fee_payments
ALTER TABLE public.fee_payments 
  DROP CONSTRAINT IF EXISTS fee_payments_student_id_fkey;

-- Clean orphans (those not in students table)
DELETE FROM public.fee_payments 
WHERE student_id NOT IN (SELECT id FROM public.students);

-- Add new foreign key pointing to students table
ALTER TABLE public.fee_payments
  ADD CONSTRAINT fee_payments_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 2. Unify student_fee_payments (if it exists)
DO $$ 
BEGIN 
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_fee_payments') THEN
    ALTER TABLE public.student_fee_payments 
      DROP CONSTRAINT IF EXISTS student_fee_payments_student_id_fkey;

    -- Clean orphans
    DELETE FROM public.student_fee_payments 
    WHERE student_id NOT IN (SELECT id FROM public.students);

    -- Add new foreign key pointing to students table
    ALTER TABLE public.student_fee_payments
      ADD CONSTRAINT student_fee_payments_student_id_fkey 
      FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Optimize RLS for fees_groups, fees_types, fees_master
-- Using the subquery pattern for performance and reliability

-- fees_groups
DROP POLICY IF EXISTS "School members can view fees groups" ON public.fees_groups;
CREATE POLICY "School members can view fees groups" ON public.fees_groups
  FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM public.profiles WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Super admin can insert fees groups" ON public.fees_groups;
CREATE POLICY "Super admin can insert fees groups" ON public.fees_groups
  FOR INSERT TO authenticated
  WITH CHECK (school_id = (SELECT school_id FROM public.profiles WHERE id = (SELECT auth.uid())) 
  AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) IN ('super_admin', 'accountant'));

-- fees_types
DROP POLICY IF EXISTS "School members can view fees types" ON public.fees_types;
CREATE POLICY "School members can view fees types" ON public.fees_types
  FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM public.profiles WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Super admin can insert fees types" ON public.fees_types;
CREATE POLICY "Super admin can insert fees types" ON public.fees_types
  FOR INSERT TO authenticated
  WITH CHECK (school_id = (SELECT school_id FROM public.profiles WHERE id = (SELECT auth.uid())) 
  AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) IN ('super_admin', 'accountant'));

-- fees_master
DROP POLICY IF EXISTS "School members can view fees master" ON public.fees_master;
CREATE POLICY "School members can view fees master" ON public.fees_master
  FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM public.profiles WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Super admin can insert fees master" ON public.fees_master;
CREATE POLICY "Super admin can insert fees master" ON public.fees_master
  FOR INSERT TO authenticated
  WITH CHECK (school_id = (SELECT school_id FROM public.profiles WHERE id = (SELECT auth.uid())) 
  AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) IN ('super_admin', 'accountant'));

-- 4. Sync fees_collections amount to amount_paid for consistency
-- This ensures that dashboards using either column show the correct data
UPDATE public.fees_collections 
SET amount_paid = amount 
WHERE amount_paid = 0 OR amount_paid IS NULL;

-- 5. Reload PostgREST schema to recognize the new relationships and policies
NOTIFY pgrst, 'reload schema';
