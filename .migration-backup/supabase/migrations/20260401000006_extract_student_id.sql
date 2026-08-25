/*
  # Extract Final Digits for Student ID
  
  Updates the `profiles` table to formally align `student_id` with the final 
  zero-padded digits of the `admission_number` (e.g. OGS-2026-007 -> 007).
  This ensures any existing seeded students flawlessly display 
  the shortened 3-digit number.
*/

DO $$
BEGIN
  -- Isolate the third segment after the hyphens and assign it as the student_id
  UPDATE public.profiles
  SET student_id = split_part(admission_number, '-', 3)
  WHERE role = 'student' AND admission_number LIKE 'OGS-%-%';
END $$;
