/*
  # Add cert_type and description columns to student_certificates

  1. Changes to student_certificates
    - `cert_type` (text) - the certificate type: graduation, excellence, participation, merit, custom
    - `description` (text) - description of what the certificate is for
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_certificates' AND column_name = 'cert_type'
  ) THEN
    ALTER TABLE student_certificates ADD COLUMN cert_type text NOT NULL DEFAULT 'custom';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_certificates' AND column_name = 'description'
  ) THEN
    ALTER TABLE student_certificates ADD COLUMN description text DEFAULT '';
  END IF;
END $$;
