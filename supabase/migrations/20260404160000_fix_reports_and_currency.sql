-- 1. Unify fees_collections student_id with students table
-- This is critical for reports that join with students table (unified registry)
ALTER TABLE public.fees_collections 
  DROP CONSTRAINT IF EXISTS fees_collections_student_id_fkey;

-- Add new foreign key pointing to students table
ALTER TABLE public.fees_collections
  ADD CONSTRAINT fees_collections_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 2. Ensure amount_paid column exists in fees_collections for consistency with reports
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fees_collections' AND column_name = 'amount_paid'
  ) THEN
    ALTER TABLE public.fees_collections ADD COLUMN amount_paid numeric(12,2);
  END IF;
END $$;

-- Sync amount to amount_paid if null
UPDATE public.fees_collections SET amount_paid = amount WHERE amount_paid IS NULL;

-- 3. Update RLS policies to use optimized subquery pattern
-- This resolves issues where "everything is not working" due to RLS failures

-- fees_collections
DROP POLICY IF EXISTS "School members can view fees collections" ON public.fees_collections;
CREATE POLICY "School members can view fees collections" ON public.fees_collections
  FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()));

-- income_records
DROP POLICY IF EXISTS "School members can view income records" ON public.income_records;
CREATE POLICY "School members can view income records" ON public.income_records
  FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()));

-- expense_records
DROP POLICY IF EXISTS "School members can view expense records" ON public.expense_records;
CREATE POLICY "School members can view expense records" ON public.expense_records
  FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()));

-- student_fines
-- Ensure table exists and has RLS
DO $$ 
BEGIN 
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_fines') THEN
    ALTER TABLE public.student_fines ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "School members can view student_fines" ON public.student_fines;
    CREATE POLICY "School members can view student_fines" ON public.student_fines
      FOR SELECT TO authenticated
      USING (school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
