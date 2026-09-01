/*
  # Relax NOT NULL constraints on prospective_students

  When admins add prospects manually, not all fields may be available upfront.
  These constraints were designed for the public online form (which requires them),
  but the internal admin form should be more flexible.

  Makes the following fields nullable:
  - date_of_birth, gender, address, state_of_origin
  - current_school, guardian_name, guardian_phone, guardian_email
  - guardian_occupation, guardian_relationship, emergency_contact
  - student_type (keep default 'day')
  - medical_conditions (keep default '')

  Keeps NOT NULL: first_name, last_name, school_id
*/

ALTER TABLE prospective_students
  ALTER COLUMN date_of_birth     DROP NOT NULL,
  ALTER COLUMN gender            DROP NOT NULL,
  ALTER COLUMN address           DROP NOT NULL,
  ALTER COLUMN state_of_origin   DROP NOT NULL,
  ALTER COLUMN current_school    DROP NOT NULL,
  ALTER COLUMN guardian_name     DROP NOT NULL,
  ALTER COLUMN guardian_phone    DROP NOT NULL,
  ALTER COLUMN guardian_email    DROP NOT NULL,
  ALTER COLUMN guardian_occupation   DROP NOT NULL,
  ALTER COLUMN guardian_relationship DROP NOT NULL,
  ALTER COLUMN emergency_contact DROP NOT NULL,
  ALTER COLUMN medical_conditions DROP NOT NULL;

-- Also drop the check constraint so empty/null gender passes
ALTER TABLE prospective_students DROP CONSTRAINT IF EXISTS prospective_students_gender_check;
