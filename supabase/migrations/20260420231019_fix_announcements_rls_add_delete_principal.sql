/*
  # Fix Announcements RLS — Add DELETE, include principal role

  ## Changes
  1. DROP and recreate INSERT policy to include 'principal'
  2. DROP and recreate UPDATE policy to include 'principal' and add WITH CHECK
  3. CREATE new DELETE policy for authors + super_admin/admin/principal
*/

-- Fix INSERT: add principal
DROP POLICY IF EXISTS "Staff can create announcements" ON announcements;
CREATE POLICY "Staff can create announcements"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY(ARRAY['teacher','super_admin','admin','principal'])
    )
  );

-- Fix UPDATE: add principal, add WITH CHECK
DROP POLICY IF EXISTS "Authors and admins can update announcements" ON announcements;
CREATE POLICY "Authors and admins can update announcements"
  ON announcements FOR UPDATE
  TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY(ARRAY['super_admin','admin','principal'])
    )
  )
  WITH CHECK (
    author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY(ARRAY['super_admin','admin','principal'])
    )
  );

-- Add DELETE policy (was missing entirely)
DROP POLICY IF EXISTS "Authors and admins can delete announcements" ON announcements;
CREATE POLICY "Authors and admins can delete announcements"
  ON announcements FOR DELETE
  TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY(ARRAY['super_admin','admin','principal'])
    )
  );
