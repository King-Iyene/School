/*
  # Restore Missing Profile Columns
  
  ## Summary
  The frontend student admission, attendance, and export flows inherently rely on a unified `profiles` table
  which stores student-specific criteria (admission_date, roll_number, full_name, guardian details, etc).
  The previous backend architecture migrations strictly split these into a distinct `students` table, but
  the frontend was never refactored to match and instead relied on manual un-exported columns.

  This migration explicitly restores those missing columns to the `profiles` schema so the frontend forms can operate exactly as they did before without breaking layout or queries.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blood_group text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS religion text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS roll_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admission_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admission_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_relation text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_email text;

-- Force the API Gateway to instantly register the new profile schema columns
NOTIFY pgrst, 'reload schema';
