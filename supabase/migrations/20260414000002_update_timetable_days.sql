-- Update timetable day_of_week constraint to allow Saturday and Sunday
ALTER TABLE timetable DROP CONSTRAINT IF EXISTS timetable_day_of_week_check;
ALTER TABLE timetable ADD CONSTRAINT timetable_day_of_week_check CHECK (day_of_week BETWEEN 1 AND 7);

-- Make subject_id nullable to support special periods like Assembly/Break
ALTER TABLE timetable ALTER COLUMN subject_id DROP NOT NULL;
