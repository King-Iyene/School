-- Migration to redirect remaining student-related foreign keys to the students table
-- This completes the unification of student data across all modules.

-- 1. Update grades foreign key
ALTER TABLE public.grades 
  DROP CONSTRAINT IF EXISTS grades_student_id_fkey;

-- Clean orphans first
DELETE FROM public.grades WHERE student_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.grades
  ADD CONSTRAINT grades_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 2. Update exam_marks_records foreign key
ALTER TABLE public.exam_marks_records
  DROP CONSTRAINT IF EXISTS exam_marks_records_student_id_fkey;

-- Clean orphans first
DELETE FROM public.exam_marks_records WHERE student_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.exam_marks_records
  ADD CONSTRAINT exam_marks_records_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 3. Update student_behaviour_records foreign key
ALTER TABLE public.student_behaviour_records
  DROP CONSTRAINT IF EXISTS student_behaviour_records_student_id_fkey;

-- Clean orphans first
DELETE FROM public.student_behaviour_records WHERE student_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.student_behaviour_records
  ADD CONSTRAINT student_behaviour_records_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 4. Update dormitory_assignments foreign key
ALTER TABLE public.dormitory_assignments
  DROP CONSTRAINT IF EXISTS dormitory_assignments_student_id_fkey;

-- Clean orphans first
DELETE FROM public.dormitory_assignments WHERE student_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.dormitory_assignments
  ADD CONSTRAINT dormitory_assignments_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 5. Update assignment_submissions foreign key
ALTER TABLE public.assignment_submissions
  DROP CONSTRAINT IF EXISTS assignment_submissions_student_id_fkey;

-- Clean orphans first
DELETE FROM public.assignment_submissions WHERE student_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.assignment_submissions
  ADD CONSTRAINT assignment_submissions_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 6. Update exam_results foreign key
ALTER TABLE public.exam_results
  DROP CONSTRAINT IF EXISTS exam_results_student_id_fkey;

-- Clean orphans first
DELETE FROM public.exam_results WHERE student_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.exam_results
  ADD CONSTRAINT exam_results_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 7. Update fees_collections foreign key
ALTER TABLE public.fees_collections
  DROP CONSTRAINT IF EXISTS fees_collections_student_id_fkey;

-- Clean orphans first
DELETE FROM public.fees_collections WHERE student_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.fees_collections
  ADD CONSTRAINT fees_collections_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 8. Update fees_carry_forward foreign key
ALTER TABLE public.fees_carry_forward
  DROP CONSTRAINT IF EXISTS fees_carry_forward_student_id_fkey;

-- Clean orphans first
DELETE FROM public.fees_carry_forward WHERE student_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.fees_carry_forward
  ADD CONSTRAINT fees_carry_forward_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 9. Update book_issues foreign key
ALTER TABLE public.book_issues
  DROP CONSTRAINT IF EXISTS book_issues_member_id_fkey;

-- Clean orphans first
DELETE FROM public.book_issues WHERE member_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.book_issues
  ADD CONSTRAINT book_issues_member_id_fkey 
  FOREIGN KEY (member_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 10. Update transport_assignments foreign key
ALTER TABLE public.transport_assignments
  DROP CONSTRAINT IF EXISTS transport_assignments_student_id_fkey;

-- Clean orphans first
DELETE FROM public.transport_assignments WHERE student_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.transport_assignments
  ADD CONSTRAINT transport_assignments_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 11. Update RLS policies to allow students to view their own records via the students link
-- Note: students.id matches profiles.id for students with logins.

-- Grades RLS
DROP POLICY IF EXISTS "Students can view own grades" ON public.grades;
CREATE POLICY "Students can view own grades"
  ON public.grades FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.parent_student_links 
    WHERE parent_id = auth.uid() AND student_id = public.grades.student_id
  ));

-- Exam Marks RLS
DROP POLICY IF EXISTS "Students can view own marks" ON public.exam_marks_records;
CREATE POLICY "Students can view own marks"
  ON public.exam_marks_records FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.parent_student_links 
    WHERE parent_id = auth.uid() AND student_id = public.exam_marks_records.student_id
  ));

-- Assignment Submissions RLS
DROP POLICY IF EXISTS "Students can view own submissions" ON public.assignment_submissions;
CREATE POLICY "Students can view own submissions"
  ON public.assignment_submissions FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.parent_student_links 
    WHERE parent_id = auth.uid() AND student_id = public.assignment_submissions.student_id
  ));

-- Exam Results RLS
DROP POLICY IF EXISTS "Students can view own results" ON public.exam_results;
CREATE POLICY "Students can view own results"
  ON public.exam_results FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.parent_student_links 
    WHERE parent_id = auth.uid() AND student_id = public.exam_results.student_id
  ));

-- Fees Collections RLS
DROP POLICY IF EXISTS "Students can view own fees" ON public.fees_collections;
CREATE POLICY "Students can view own fees"
  ON public.fees_collections FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.parent_student_links 
    WHERE parent_id = auth.uid() AND student_id = public.fees_collections.student_id
  ));

-- Book Issues RLS
DROP POLICY IF EXISTS "Students can view own book issues" ON public.book_issues;
CREATE POLICY "Students can view own book issues"
  ON public.book_issues FOR SELECT
  TO authenticated
  USING (member_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.parent_student_links 
    WHERE parent_id = auth.uid() AND student_id = public.book_issues.member_id
  ));

NOTIFY pgrst, 'reload schema';
