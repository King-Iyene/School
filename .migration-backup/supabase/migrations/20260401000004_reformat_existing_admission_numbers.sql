/*
  # Standardize Legacy Admission Numbers
  
  Loops through all existing students with legacy admission numbers (e.g. OGS100) 
  and converts them rigorously to the requested format: OGS-2026-XXX.
  Automatically bridges the updated identity credentials to Supabase Auth and Profiles 
  so all 300+ students can log in using their new formalized admission number right away.
*/

DO $$
DECLARE
  student_rec RECORD;
  new_admission_number text;
  new_proxy_email text;
  counter integer := 1;
BEGIN
  -- Loop through all existing students sequentially
  FOR student_rec IN
    SELECT s.id
    FROM public.students s
    JOIN public.profiles p ON p.id = s.id
    WHERE p.role = 'student'
    ORDER BY p.last_name, p.first_name
  LOOP
    -- Generate the strict OGS-2026-XXX format using zero-padding
    new_admission_number := 'OGS-2026-' || lpad(counter::text, 3, '0');
    
    -- Generate the corresponding string-proxy email for GoTrue Auth
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
    
    -- 3. Physically alter the Supabase Auth Identity
    UPDATE auth.users 
    SET email = new_proxy_email 
    WHERE id = student_rec.id;

    counter := counter + 1;
  END LOOP;
END $$;
