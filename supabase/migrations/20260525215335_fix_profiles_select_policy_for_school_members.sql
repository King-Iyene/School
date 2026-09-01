/*
  # Fix profiles SELECT policy to allow all school staff to view school profiles

  1. Changes
    - Drops the overly restrictive SELECT policies that only allow super_admin/admin/principal
    - Creates a single clear policy: all authenticated users can view profiles within their school
    - Users can always view their own profile regardless
  
  2. Important notes
    - This fixes the timetable teacher dropdown being empty for non-admin staff
    - All staff (teachers, head_teachers, accountants, etc.) need to see teacher names
    - Data is still scoped to the user's own school via school_id check
*/

-- Drop existing overlapping SELECT policies
DROP POLICY IF EXISTS "Admins and principal can view all school profiles" ON profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Single clear policy: authenticated users can view all profiles in their school
CREATE POLICY "School members can view school profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    OR id = auth.uid()
  );
