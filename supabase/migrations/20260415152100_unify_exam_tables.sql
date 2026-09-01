-- Step 1: Update exams table check constraint to include 'terminal'
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_exam_type_check;
ALTER TABLE exams ADD CONSTRAINT exams_exam_type_check CHECK (exam_type IN ('terminal', 'midterm', 'final', 'unit-test', 'quarterly', 'annual', 'mock'));

-- Step 2: Update foreign keys in dependent tables to point to 'exams' table instead of 'exam_names'
-- Note: We keep the column names as exam_name_id for now to minimize frontend breakage, but point them to 'exams' table.

-- Exam Marks Records
ALTER TABLE exam_marks_records DROP CONSTRAINT IF EXISTS exam_marks_records_exam_name_id_fkey;
ALTER TABLE exam_marks_records ADD CONSTRAINT exam_marks_records_exam_name_id_fkey FOREIGN KEY (exam_name_id) REFERENCES exams(id) ON DELETE CASCADE;

-- Exam Schedules
ALTER TABLE exam_schedules DROP CONSTRAINT IF EXISTS exam_schedules_exam_name_id_fkey;
ALTER TABLE exam_schedules ADD CONSTRAINT exam_schedules_exam_name_id_fkey FOREIGN KEY (exam_name_id) REFERENCES exams(id) ON DELETE CASCADE;

-- Exam Attendance Records
ALTER TABLE exam_attendance_records DROP CONSTRAINT IF EXISTS exam_attendance_records_exam_name_id_fkey;
ALTER TABLE exam_attendance_records ADD CONSTRAINT exam_attendance_records_exam_name_id_fkey FOREIGN KEY (exam_name_id) REFERENCES exams(id) ON DELETE CASCADE;

-- Online Exams
ALTER TABLE online_exams DROP CONSTRAINT IF EXISTS online_exams_exam_name_id_fkey;
ALTER TABLE online_exams ADD CONSTRAINT online_exams_exam_name_id_fkey FOREIGN KEY (exam_name_id) REFERENCES exams(id) ON DELETE SET NULL;

-- Step 3: Add supervisor_id to exam_schedules
ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
-- Step 4: Add locking mechanism columns
ALTER TABLE exam_marks_records ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE exam_attendance_records ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
