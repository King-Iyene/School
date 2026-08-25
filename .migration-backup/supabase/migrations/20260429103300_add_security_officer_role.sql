/*
  # Add Security Officer Role

  ## Summary
  Adds 'security_officer' as a new role option in the profiles table.

  ## Changes
  1. Modified Tables
    - `profiles`
      - Drops the existing role CHECK constraint
      - Re-adds it with 'security_officer' included

  ## Notes
  - Safe non-destructive change — existing rows are unaffected
  - The CSO role has access to security-relevant modules only:
    visitor book, complaints, behaviour incidents, dormitory,
    transport, and staff attendance monitoring.
*/

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'super_admin',
    'admin',
    'principal',
    'teacher',
    'student',
    'parent',
    'accountant',
    'security_officer'
  ));
