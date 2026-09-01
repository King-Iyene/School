/*
  # Move Digital Technology results from 3rd Term to 2nd Term

  1. Changes
    - For students who already have Digital Technology in 2nd term: overwrite their 2nd term scores with 3rd term scores
    - For students who only have Digital Technology in 3rd term: move the record to 2nd term
    - Delete all remaining 3rd term Digital Technology records after merge
  
  2. Affected classes: SSS 1A, SSS 1B, SSS 2A, SSS 2B
  
  3. Important notes
    - Academic year: 2025/2026
    - Subject: Digital Technology (06c3b1a5-24b5-46ee-9e97-d04c9652225f)
    - total_score is a generated column and must not be explicitly set
*/

-- Step 1: Update existing 2nd term records with 3rd term scores
UPDATE grades g2
SET 
  ca1_score = g3.ca1_score,
  ca2_score = g3.ca2_score,
  ca3_score = g3.ca3_score,
  exam_score = g3.exam_score,
  grade = g3.grade,
  remark = g3.remark,
  teacher_id = g3.teacher_id,
  subject_position = NULL,
  overall_position = NULL,
  updated_at = now()
FROM grades g3
WHERE g3.subject_id = '06c3b1a5-24b5-46ee-9e97-d04c9652225f'
  AND g3.term_id = '00000000-0000-0000-0000-000000000003'
  AND g3.academic_year_id = '7bd1d805-7e8e-458a-8570-bf4dd8849824'
  AND g2.student_id = g3.student_id
  AND g2.class_id = g3.class_id
  AND g2.subject_id = g3.subject_id
  AND g2.term_id = '00000000-0000-0000-0000-000000000002'
  AND g2.academic_year_id = g3.academic_year_id;

-- Step 2: Move non-conflict 3rd term records to 2nd term
UPDATE grades
SET 
  term_id = '00000000-0000-0000-0000-000000000002',
  subject_position = NULL,
  overall_position = NULL,
  updated_at = now()
WHERE subject_id = '06c3b1a5-24b5-46ee-9e97-d04c9652225f'
  AND term_id = '00000000-0000-0000-0000-000000000003'
  AND academic_year_id = '7bd1d805-7e8e-458a-8570-bf4dd8849824'
  AND NOT EXISTS (
    SELECT 1 FROM grades g2
    WHERE g2.student_id = grades.student_id
      AND g2.class_id = grades.class_id
      AND g2.subject_id = grades.subject_id
      AND g2.term_id = '00000000-0000-0000-0000-000000000002'
      AND g2.academic_year_id = grades.academic_year_id
  );

-- Step 3: Delete the remaining 3rd term Digital Technology records (already merged in step 1)
DELETE FROM grades
WHERE subject_id = '06c3b1a5-24b5-46ee-9e97-d04c9652225f'
  AND term_id = '00000000-0000-0000-0000-000000000003'
  AND academic_year_id = '7bd1d805-7e8e-458a-8570-bf4dd8849824';
