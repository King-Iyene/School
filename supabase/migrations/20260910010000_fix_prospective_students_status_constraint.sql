/*
  # Widen prospective_students status constraint to match the live pipeline

  ProspectiveStudents.tsx tracks an 8-stage admission pipeline (pending,
  exam_invited, exam_scheduled, exam_done, interview_scheduled,
  interview_done, admitted, rejected), but the constraint added by
  20260424013000_fix_status_constraint.sql only allowed 6 values — missing
  'exam_done' and 'interview_done'. Those two status writes have been
  silently failing ever since (the UI doesn't visibly break because
  effectiveStatus() derives the same stage from exam_score/interview_date/
  interview_outcome instead of trusting this column — but the column itself
  has been stuck at an earlier stage for every application that reached
  either one, which would mislead any report or export reading it
  directly). A previous session had already found and fixed both halves of
  this — as untracked one-off scripts under
  artifacts/ogs-school/supabase-migrations/ — but never folded them into
  the actual tracked migrations, so there was nothing to guarantee either
  one had been run. This consolidates both into one idempotent migration:

  1. Adds the exam/interview tracking columns the pipeline reads and writes
     (add_exam_interview_columns.sql), if they aren't there already.
  2. Widens the status constraint to the full 8-value pipeline
     (fix_prospective_students_status_constraint.sql), keeping
     'pending_payment'/'paid' too in case any historical rows still carry
     them — no current code writes those, so keeping them costs nothing.
  3. Backfills rows stuck at an earlier stage using the same precedence
     ProspectiveStudents.tsx's effectiveStatus() already uses (interview
     outcome > interview date > exam score), now that the column can
     actually hold the real value.
  4. Also folds in add_student_type_column.sql — students.student_type is
     written by this same admit flow (ProspectiveStudents.tsx passes
     student_type into the students insert), so it belongs with the rest
     of this pipeline's schema.
*/

ALTER TABLE prospective_students
  ADD COLUMN IF NOT EXISTS exam_date         date,
  ADD COLUMN IF NOT EXISTS exam_score        numeric,
  ADD COLUMN IF NOT EXISTS exam_max_score    numeric DEFAULT 100,
  ADD COLUMN IF NOT EXISTS exam_notes        text,
  ADD COLUMN IF NOT EXISTS interview_date    date,
  ADD COLUMN IF NOT EXISTS interview_notes   text,
  ADD COLUMN IF NOT EXISTS interview_outcome text; -- 'pass' | 'fail' | 'deferred'

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS student_type text CHECK (student_type IN ('day', 'boarding')) DEFAULT 'day';

ALTER TABLE prospective_students
  DROP CONSTRAINT IF EXISTS prospective_students_status_check;

ALTER TABLE prospective_students
  ADD CONSTRAINT prospective_students_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'pending_payment'::text,
    'paid'::text,
    'exam_invited'::text,
    'exam_scheduled'::text,
    'exam_done'::text,
    'interview_scheduled'::text,
    'interview_done'::text,
    'admitted'::text,
    'rejected'::text
  ]));

UPDATE prospective_students
SET status = 'interview_done'
WHERE status = 'pending' AND interview_outcome IS NOT NULL AND interview_outcome != '';

UPDATE prospective_students
SET status = 'interview_scheduled'
WHERE status = 'pending' AND interview_date IS NOT NULL;

UPDATE prospective_students
SET status = 'exam_done'
WHERE status = 'pending' AND exam_score IS NOT NULL;

NOTIFY pgrst, 'reload schema';
