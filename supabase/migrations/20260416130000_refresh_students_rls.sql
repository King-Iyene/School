-- Re-apply RLS policies for students table to ensure they are properly registered
-- and notify PostgREST to reload the schema.

-- 1. Ensure students table has all necessary columns
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Drop and recreate Update policy
DROP POLICY IF EXISTS "Admins can update students" ON public.students;
CREATE POLICY "Admins can update students"
  ON public.students FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
      AND profiles.school_id = public.students.school_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
      AND profiles.school_id = public.students.school_id
    )
  );

-- 3. Ensure RLS is enabled
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 4. Force schema reload
NOTIFY pgrst, 'reload schema';
