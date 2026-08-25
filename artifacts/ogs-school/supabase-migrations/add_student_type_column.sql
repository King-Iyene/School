-- Add student_type to students table
-- Values: 'day' | 'boarding'  (mirrors prospective_students.student_type)
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS student_type TEXT CHECK (student_type IN ('day', 'boarding')) DEFAULT 'day';
