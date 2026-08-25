-- Migration to fix student_enrollments foreign key mismatch
-- student_enrollments currently references profiles(id), but should reference students(id)

-- 1. Drop existing foreign key
ALTER TABLE public.student_enrollments
  DROP CONSTRAINT IF EXISTS student_enrollments_student_id_fkey;

-- 2. Clean up any orphans (enrollments where student_id is not in students table)
-- Note: In this system, student IDs in the students table are designed to match profile IDs 
-- for those with logins, but since we are using a standalone students table, we must 
-- ensure referential integrity with that table specifically.
DELETE FROM public.student_enrollments 
WHERE student_id NOT IN (SELECT id FROM public.students);

-- 3. Add new foreign key pointing to students(id)
ALTER TABLE public.student_enrollments
  ADD CONSTRAINT student_enrollments_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
