/*
  # Add Principal Role

  ## Summary
  Adds 'principal' as a new role option in the profiles table.

  ## Changes
  1. Modified Tables
    - `profiles`
      - Drops the existing role CHECK constraint
      - Re-adds it with 'principal' included
      - Also adds 'admin' which was missing from the DB constraint despite being in the TypeScript type

  ## Notes
  - Safe non-destructive change — existing rows are unaffected
  - Principal role sits between teacher and admin: can be assigned to classes/subjects
    like a teacher, but also has administrative management privileges
*/

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'principal', 'teacher', 'student', 'parent', 'accountant'));
