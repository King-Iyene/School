/*
  # Storage Buckets and Student Documents

  ## Summary
  1. Creates Supabase Storage buckets for profile photos and documents
  2. Sets up storage RLS policies
  3. Creates student_documents table for student file uploads

  ## Storage Buckets
  - `profile-photos` - Public bucket for staff and student profile photos (max 5MB)
  - `staff-documents` - Private bucket for staff CVs, certificates etc (max 20MB)
  - `student-documents` - Private bucket for student records (max 10MB)

  ## New Tables
  - `student_documents` - Tracks uploaded student documents with file URLs

  ## Security
  - Public can read profile photos (for display)
  - Authenticated users can upload to profile-photos bucket
  - Super admins manage all document buckets
  - RLS on student_documents scoped to school
*/

-- ─── Storage buckets ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('profile-photos', 'profile-photos', true, 5242880,
   ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('staff-documents', 'staff-documents', false, 20971520,
   ARRAY['application/pdf','image/jpeg','image/png','application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('student-documents', 'student-documents', false, 10485760,
   ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT (id) DO NOTHING;

-- ─── Storage policies ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Public read profile photos'
  ) THEN
    CREATE POLICY "Public read profile photos"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'profile-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Authenticated users upload profile photos'
  ) THEN
    CREATE POLICY "Authenticated users upload profile photos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'profile-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Authenticated users update profile photos'
  ) THEN
    CREATE POLICY "Authenticated users update profile photos"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'profile-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Authenticated users delete own profile photos'
  ) THEN
    CREATE POLICY "Authenticated users delete own profile photos"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'profile-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Authenticated read staff documents'
  ) THEN
    CREATE POLICY "Authenticated read staff documents"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'staff-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Authenticated upload staff documents'
  ) THEN
    CREATE POLICY "Authenticated upload staff documents"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'staff-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Authenticated delete staff documents'
  ) THEN
    CREATE POLICY "Authenticated delete staff documents"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'staff-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Authenticated manage student documents'
  ) THEN
    CREATE POLICY "Authenticated manage student documents"
      ON storage.objects FOR ALL
      TO authenticated
      USING (bucket_id = 'student-documents')
      WITH CHECK (bucket_id = 'student-documents');
  END IF;
END $$;

-- ─── student_documents table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'other',
  file_name text NOT NULL DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  description text DEFAULT '',
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members view student docs"
  ON student_documents FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Super admins insert student docs"
  ON student_documents FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admins delete student docs"
  ON student_documents FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
