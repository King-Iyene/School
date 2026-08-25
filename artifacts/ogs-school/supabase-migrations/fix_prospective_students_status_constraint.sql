-- Fix prospective_students status check constraint.
-- This version first normalises any rows with unrecognised status values
-- so the new constraint can be applied without errors.

-- Step 1: drop the old (too-restrictive) constraint
ALTER TABLE prospective_students
  DROP CONSTRAINT IF EXISTS prospective_students_status_check;

-- Step 2: see what unexpected values exist (informational – safe to run)
-- SELECT DISTINCT status FROM prospective_students;

-- Step 3: reset any rows whose status is not in the new allowed list
--   (NULL or anything not listed below) → 'pending'
UPDATE prospective_students
SET status = 'pending'
WHERE status IS NULL
   OR status NOT IN (
        'pending',
        'exam_invited',
        'exam_scheduled',
        'exam_done',
        'interview_scheduled',
        'interview_done',
        'admitted',
        'rejected'
      );

-- Step 4: add the corrected constraint
ALTER TABLE prospective_students
  ADD CONSTRAINT prospective_students_status_check
  CHECK (status IN (
    'pending',
    'exam_invited',
    'exam_scheduled',
    'exam_done',
    'interview_scheduled',
    'interview_done',
    'admitted',
    'rejected'
  ));
