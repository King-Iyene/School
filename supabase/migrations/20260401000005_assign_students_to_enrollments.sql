/*
  # Formalize Student Enrollments 
  Legacy students were seated locally to classes but isolated entirely from the `student_enrollments` registry used by Advanced Academic tracking features (Grades, Attendance).
  Automatically loop over all non-enrolled students and securely lock them into the active term/year using their legacy `class_id`.
*/

DO $$
DECLARE
  student_rec RECORD;
  active_year_id uuid;
  active_term_id uuid;
BEGIN
  -- We assume there is precisely one active year and term per school.
  -- For safety, we will grab the first mapped current year/term of context
  SELECT id INTO active_year_id FROM public.academic_years WHERE is_current = true LIMIT 1;
  SELECT id INTO active_term_id FROM public.terms WHERE is_current = true LIMIT 1;

  -- Verify active records exist before bulk processing
  IF active_year_id IS NULL THEN
     RAISE NOTICE 'No active academic year found. Cannot auto-enroll.';
     RETURN;
  END IF;

  -- Iterate all legacy core students who HAVE a class but DO NOT exist securely inside the strict enrollment tracker yet.
  FOR student_rec IN
    SELECT s.id as student_id, s.class_id as assigned_class_id, s.school_id
    FROM public.students s
    WHERE s.class_id IS NOT NULL 
    AND NOT EXISTS (
      SELECT 1 FROM public.student_enrollments se 
      WHERE se.student_id = s.id AND se.status = 'active'
    )
  LOOP
    INSERT INTO public.student_enrollments (
      student_id,
      class_id,
      academic_year_id,
      term_id,
      enrollment_date,
      status
    ) VALUES (
      student_rec.student_id,
      student_rec.assigned_class_id,
      active_year_id,
      active_term_id,
      NOW(),
      'active'
    );
  END LOOP;
END $$;
