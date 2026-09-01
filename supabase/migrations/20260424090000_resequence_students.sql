/*
  # Re-sequence All Student Admission Numbers
  
  This script re-assigns admission numbers to all students sequentially, starting from 001.
  It updates:
  1. public.students (admission_number)
  2. public.profiles (admission_number, email)
  3. auth.users (email)
  
  IMPORTANT: This will change the login emails for all students.
*/

DO $$
DECLARE
  student_rec RECORD;
  new_admission_number text;
  new_proxy_email text;
  counter integer := 1;
  current_year text := to_char(now(), 'YYYY');
BEGIN
  -- Loop through all existing students, ordered by their current numeric suffix
  FOR student_rec IN
    SELECT 
      s.id,
      s.school_id,
      s.admission_number
    FROM public.students s
    JOIN public.profiles p ON p.id = s.id
    WHERE p.role = 'student'
    ORDER BY 
      -- Sort by year first, then by the numeric part
      split_part(s.admission_number, '-', 2),
      CASE 
        WHEN split_part(s.admission_number, '-', 3) ~ '^[0-9]+$' 
        THEN split_part(s.admission_number, '-', 3)::integer 
        ELSE 0 
      END
  LOOP
    -- Generate the new admission number format: OGS-YYYY-###
    -- Using 3-digit padding for 1-999, and no extra padding for 1000+
    new_admission_number := 'OGS-' || current_year || '-' || lpad(counter::text, 3, '0');
    
    -- Generate the corresponding string-proxy email
    new_proxy_email := lower(new_admission_number) || '@student.okrika.edu.ng';

    -- 1. Update the root students table
    UPDATE public.students 
    SET admission_number = new_admission_number 
    WHERE id = student_rec.id;

    -- 2. Sync the profiles table
    UPDATE public.profiles 
    SET admission_number = new_admission_number, 
        email = new_proxy_email 
    WHERE id = student_rec.id;
    
    -- 3. Update the Supabase Auth Identity
    UPDATE auth.users 
    SET email = new_proxy_email 
    WHERE id = student_rec.id;

    RAISE NOTICE 'Updated student %: % -> %', student_rec.id, student_rec.admission_number, new_admission_number;

    counter := counter + 1;
  END LOOP;
  
  RAISE NOTICE 'Re-sequencing complete. % students updated.', counter - 1;
END $$;
