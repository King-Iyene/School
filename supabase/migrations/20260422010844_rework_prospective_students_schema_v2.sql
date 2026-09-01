/*
  # Rework prospective_students schema (v2)

  ## Changes
  1. Drop old status check constraint, add new one: pending | admitted | rejected
  2. Migrate old pre-admission statuses → pending
  3. Add missing fields matching Student Admission form
  4. Update gender check to include 'other'
  5. Change status default to 'pending'
*/

-- Drop old constraints
ALTER TABLE prospective_students DROP CONSTRAINT IF EXISTS prospective_students_status_check;
ALTER TABLE prospective_students DROP CONSTRAINT IF EXISTS prospective_students_gender_check;

-- No longer migration pre-admission statuses to 'pending' to avoid data loss
-- Data migration handled by later scripts

-- Add new simplified check constraints
ALTER TABLE prospective_students
  ADD CONSTRAINT prospective_students_status_check
    CHECK (status = ANY (ARRAY['pending', 'pending_payment', 'paid', 'exam_scheduled', 'admitted', 'rejected']));

ALTER TABLE prospective_students
  ADD CONSTRAINT prospective_students_gender_check
    CHECK (gender = ANY (ARRAY['male', 'female', 'other']));

-- Change status default
ALTER TABLE prospective_students ALTER COLUMN status SET DEFAULT 'pending';

-- Add missing fields (idempotent with IF NOT EXISTS)
ALTER TABLE prospective_students
  ADD COLUMN IF NOT EXISTS blood_group      text,
  ADD COLUMN IF NOT EXISTS religion         text,
  ADD COLUMN IF NOT EXISTS nationality      text DEFAULT 'Nigerian',
  ADD COLUMN IF NOT EXISTS phone            text DEFAULT '',
  ADD COLUMN IF NOT EXISTS city             text DEFAULT '',
  ADD COLUMN IF NOT EXISTS lga              text DEFAULT '',
  ADD COLUMN IF NOT EXISTS class_id         uuid REFERENCES classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS section_id       uuid REFERENCES sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS roll_number      text,
  ADD COLUMN IF NOT EXISTS admission_number text;
