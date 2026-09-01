/*
  # Recalculate subject and overall positions for all classes (2nd Term, 2025/2026)

  1. Changes
    - Recalculates subject_position: rank within each (class, subject, term) by total_score descending
    - Recalculates overall_position: rank within each (class, term) by average total_score descending
    - Updates class_size for all grades in 2nd term
  
  2. Affected tables
    - grades: subject_position, overall_position, class_size columns updated
  
  3. Important notes
    - Applies to ALL classes in 2nd term 2025/2026
    - Uses RANK() for tied scores (tied students get the same position)
*/

-- Step 1: Recalculate subject_position per (class, subject)
WITH subject_ranks AS (
  SELECT 
    g.id,
    RANK() OVER (
      PARTITION BY g.class_id, g.subject_id 
      ORDER BY g.total_score DESC
    ) as new_subject_position
  FROM grades g
  WHERE g.term_id = '00000000-0000-0000-0000-000000000002'
    AND g.academic_year_id = '7bd1d805-7e8e-458a-8570-bf4dd8849824'
    AND g.total_score > 0
)
UPDATE grades
SET subject_position = subject_ranks.new_subject_position
FROM subject_ranks
WHERE grades.id = subject_ranks.id;

-- Step 2: Recalculate overall_position based on average score across all subjects
WITH student_averages AS (
  SELECT 
    student_id,
    class_id,
    AVG(total_score) as avg_score
  FROM grades
  WHERE term_id = '00000000-0000-0000-0000-000000000002'
    AND academic_year_id = '7bd1d805-7e8e-458a-8570-bf4dd8849824'
    AND total_score > 0
  GROUP BY student_id, class_id
),
overall_ranks AS (
  SELECT 
    student_id,
    class_id,
    RANK() OVER (
      PARTITION BY class_id 
      ORDER BY avg_score DESC
    ) as new_overall_position
  FROM student_averages
)
UPDATE grades
SET overall_position = overall_ranks.new_overall_position
FROM overall_ranks
WHERE grades.student_id = overall_ranks.student_id
  AND grades.class_id = overall_ranks.class_id
  AND grades.term_id = '00000000-0000-0000-0000-000000000002'
  AND grades.academic_year_id = '7bd1d805-7e8e-458a-8570-bf4dd8849824';

-- Step 3: Update class_size for each class
WITH class_counts AS (
  SELECT 
    class_id,
    COUNT(DISTINCT student_id) as student_count
  FROM grades
  WHERE term_id = '00000000-0000-0000-0000-000000000002'
    AND academic_year_id = '7bd1d805-7e8e-458a-8570-bf4dd8849824'
    AND total_score > 0
  GROUP BY class_id
)
UPDATE grades
SET class_size = class_counts.student_count
FROM class_counts
WHERE grades.class_id = class_counts.class_id
  AND grades.term_id = '00000000-0000-0000-0000-000000000002'
  AND grades.academic_year_id = '7bd1d805-7e8e-458a-8570-bf4dd8849824';

-- Step 4: Clear positions for zero-score entries
UPDATE grades
SET subject_position = NULL, overall_position = NULL
WHERE term_id = '00000000-0000-0000-0000-000000000002'
  AND academic_year_id = '7bd1d805-7e8e-458a-8570-bf4dd8849824'
  AND total_score = 0;
