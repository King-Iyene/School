-- Migration to unify students table schema with frontend expectations
-- This adds missing columns to the students table that are required for profiles and admission flows.

-- 1. Add missing columns to students table
ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS blood_group text DEFAULT '',
  ADD COLUMN IF NOT EXISTS religion text DEFAULT '',
  ADD COLUMN IF NOT EXISTS nationality text DEFAULT '',
  ADD COLUMN IF NOT EXISTS city text DEFAULT '',
  ADD COLUMN IF NOT EXISTS roll_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS admission_date date,
  ADD COLUMN IF NOT EXISTS phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';

-- 2. Ensure profiles table also has all these columns (for dual-sync)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blood_group text DEFAULT '',
  ADD COLUMN IF NOT EXISTS religion text DEFAULT '',
  ADD COLUMN IF NOT EXISTS nationality text DEFAULT '',
  ADD COLUMN IF NOT EXISTS city text DEFAULT '',
  ADD COLUMN IF NOT EXISTS roll_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS admission_date date,
  ADD COLUMN IF NOT EXISTS admission_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS guardian_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS guardian_relation text DEFAULT '',
  ADD COLUMN IF NOT EXISTS guardian_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS guardian_email text DEFAULT '';

-- 3. Reload schema to notify PostgREST
NOTIFY pgrst, 'reload schema';
