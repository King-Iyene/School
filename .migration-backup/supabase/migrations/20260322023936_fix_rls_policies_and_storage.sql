/*
  # Fix RLS Security Issues and Create Storage Bucket

  ## Security Fixes
  1. `schools` table - Replace overly permissive SELECT policy (USING true) with one scoped to the user's own school
  2. `weekend_settings` - Add missing UPDATE policy for admins
  3. `admission_followups` - Add missing UPDATE policy for admins
  4. `fees_carry_forward` - Add missing UPDATE policy for admins/accountants
  5. `student_group_members` - Add missing UPDATE policy for super_admins
  6. `student_promotions` - Add missing UPDATE policy for super_admins

  ## Storage
  - Create `school-logos` public storage bucket for school logo images
  - Add storage policies: super_admins can upload/delete, everyone can view

  ## Notes
  - All policies use get_my_school_id() and get_my_role() helper functions
  - SchoolSetup page creates a school before a school_id is set, so we keep
    a fallback for that special insert case on schools table
*/

-- ============================================================
-- Fix schools SELECT policy (was USING (true) = too permissive)
-- ============================================================
DROP POLICY IF EXISTS "Anyone authenticated can view schools" ON schools;

CREATE POLICY "Users can view own school"
  ON schools FOR SELECT
  TO authenticated
  USING (id = get_my_school_id() OR get_my_school_id() IS NULL);

-- ============================================================
-- Add missing UPDATE policy for weekend_settings
-- ============================================================
CREATE POLICY "Admins can update weekend settings"
  ON weekend_settings FOR UPDATE
  TO authenticated
  USING ((school_id = get_my_school_id()) AND (get_my_role() = 'super_admin'))
  WITH CHECK ((school_id = get_my_school_id()) AND (get_my_role() = 'super_admin'));

-- ============================================================
-- Add missing UPDATE policy for admission_followups
-- ============================================================
CREATE POLICY "Admins can update followups"
  ON admission_followups FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- ============================================================
-- Add missing UPDATE policy for fees_carry_forward
-- ============================================================
CREATE POLICY "Admins can update fees carry forward"
  ON fees_carry_forward FOR UPDATE
  TO authenticated
  USING ((school_id = get_my_school_id()) AND (get_my_role() = ANY (ARRAY['super_admin', 'accountant'])))
  WITH CHECK ((school_id = get_my_school_id()) AND (get_my_role() = ANY (ARRAY['super_admin', 'accountant'])));

-- ============================================================
-- Add missing UPDATE policy for student_group_members
-- ============================================================
CREATE POLICY "Super admin can update group members"
  ON student_group_members FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- ============================================================
-- Add missing UPDATE policy for student_promotions
-- ============================================================
CREATE POLICY "Super admin can update student promotions"
  ON student_promotions FOR UPDATE
  TO authenticated
  USING ((school_id = get_my_school_id()) AND (get_my_role() = 'super_admin'))
  WITH CHECK ((school_id = get_my_school_id()) AND (get_my_role() = 'super_admin'));

-- ============================================================
-- Create school-logos storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'school-logos',
  'school-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: super_admins can upload logos
CREATE POLICY "Super admins can upload school logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'school-logos'
    AND get_my_role() = 'super_admin'
  );

-- Storage policy: anyone authenticated can view logos
CREATE POLICY "Anyone can view school logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'school-logos');

-- Storage policy: super_admins can update logos
CREATE POLICY "Super admins can update school logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'school-logos' AND get_my_role() = 'super_admin')
  WITH CHECK (bucket_id = 'school-logos' AND get_my_role() = 'super_admin');

-- Storage policy: super_admins can delete logos
CREATE POLICY "Super admins can delete school logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'school-logos' AND get_my_role() = 'super_admin');
