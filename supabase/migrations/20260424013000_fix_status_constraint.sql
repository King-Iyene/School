-- Final Fix: Migrate data and sync check constraint

-- 1. Drop existing constraint
ALTER TABLE prospective_students
  DROP CONSTRAINT IF EXISTS prospective_students_status_check;

-- 2. Migrate existing 'pending' statuses to 'pending_payment'
UPDATE prospective_students 
SET status = 'pending_payment' 
WHERE status = 'pending';

-- 3. Add comprehensive constraint
ALTER TABLE prospective_students
  ADD CONSTRAINT prospective_students_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text, 
    'pending_payment'::text, 
    'paid'::text, 
    'exam_scheduled'::text, 
    'admitted'::text, 
    'rejected'::text
  ]));
