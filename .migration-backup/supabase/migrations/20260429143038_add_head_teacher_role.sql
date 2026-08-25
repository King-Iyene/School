/*
  # Add Head Teacher role

  1. Changes
    - Extend profiles.role check constraint to allow 'head_teacher'
  2. Notes
    - Head Teacher has school-wide data scope for academic modules
    - RLS policies for head_teacher read access added in follow-up
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;

  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role = ANY (ARRAY[
      'super_admin'::text,
      'admin'::text,
      'principal'::text,
      'head_teacher'::text,
      'teacher'::text,
      'student'::text,
      'parent'::text,
      'accountant'::text,
      'security_officer'::text
    ]));
END $$;