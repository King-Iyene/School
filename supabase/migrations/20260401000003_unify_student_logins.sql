/*
  # Standardize Student Logins & Fix Fees Collection

  1. Replaces all legacy/random student emails with deterministic proxy emails 
     derived strictly from their admission_number.
  2. Syncs the admission_number into the profiles schema natively so frontend 
     views work correctly.
  3. Appends the missing `amount_paid` column onto fees_collections for dashboard stability.
*/

-- 1. Patch the missing fees_collection column immediately
ALTER TABLE public.fees_collections ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) DEFAULT 0;

-- 2. Execute the dynamic sync script across the user base
DO $$
DECLARE
  student_rec RECORD;
  fresh_email text;
BEGIN
  FOR student_rec IN
    SELECT p.id, s.admission_number, p.email
    FROM public.profiles p
    JOIN public.students s ON s.id = p.id
    WHERE p.role = 'student' AND s.admission_number IS NOT NULL
  LOOP
    -- Build the standardized proxy email format
    fresh_email := lower(student_rec.admission_number) || '@student.okrika.edu.ng';
    
    -- Update local profile cache
    UPDATE public.profiles 
    SET admission_number = student_rec.admission_number, 
        email = fresh_email 
    WHERE id = student_rec.id;
    
    -- Physically alter the Supabase Auth Identity
    UPDATE auth.users 
    SET email = fresh_email 
    WHERE id = student_rec.id;
    
  END LOOP;
END $$;

-- 3. Force REST Cache Reload
NOTIFY pgrst, 'reload schema';
