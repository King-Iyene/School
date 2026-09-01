-- Migration to redirect student-related foreign keys to the students table
-- This allows students without login profiles to be correctly enrolled and managed.

-- 1. Update student_enrollments foreign key
ALTER TABLE public.student_enrollments 
  DROP CONSTRAINT IF EXISTS student_enrollments_student_id_fkey;

-- We need to ensure all student_id values exist in public.students
-- If there are orphans in profiles that are missing in students, they should be synced first.
-- But the primary fix is redirecting the FK.

-- Clean orphans first
DELETE FROM public.student_enrollments WHERE student_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.student_enrollments
  ADD CONSTRAINT student_enrollments_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 2. Update parent_student_links foreign key
ALTER TABLE public.parent_student_links
  DROP CONSTRAINT IF EXISTS parent_student_links_student_id_fkey;

-- Clean orphans first
DELETE FROM public.parent_student_links WHERE student_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.parent_student_links
  ADD CONSTRAINT parent_student_links_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 3. Update student_attendance foreign key (if not already correct)
-- (It was already correct in the previous migration, but let's be sure)
ALTER TABLE public.student_attendance
  DROP CONSTRAINT IF EXISTS student_attendance_student_id_fkey;

-- Clean orphans first
DELETE FROM public.student_attendance WHERE student_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.student_attendance
  ADD CONSTRAINT student_attendance_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 4. Update student_fee_payments foreign key
ALTER TABLE public.student_fee_payments
  DROP CONSTRAINT IF EXISTS student_fee_payments_student_id_fkey;

-- Clean orphans first
DELETE FROM public.student_fee_payments WHERE student_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.student_fee_payments
  ADD CONSTRAINT student_fee_payments_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
