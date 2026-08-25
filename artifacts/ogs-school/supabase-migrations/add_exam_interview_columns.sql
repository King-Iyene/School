-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- Adds exam and interview tracking columns to prospective_students

ALTER TABLE prospective_students
  ADD COLUMN IF NOT EXISTS exam_date        date,
  ADD COLUMN IF NOT EXISTS exam_score       numeric,
  ADD COLUMN IF NOT EXISTS exam_max_score   numeric DEFAULT 100,
  ADD COLUMN IF NOT EXISTS exam_notes       text,
  ADD COLUMN IF NOT EXISTS interview_date   date,
  ADD COLUMN IF NOT EXISTS interview_notes  text,
  ADD COLUMN IF NOT EXISTS interview_outcome text; -- 'pass' | 'fail' | 'deferred'
