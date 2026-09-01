/*
  # Unassign low-scoring subjects from senior secondary students

  1. Rule
    - For any student in SS1, SS2 or SS3 whose total score (CA + Test + Exam) is less than 5
      for a specific subject, we treat that subject as one they do not offer.
    - Insert a row into student_subject_exclusions so the subject will no longer appear
      on their result card.
    - Delete the corresponding grade row and exam_marks_records row so totals, averages
      and positions recompute correctly.

  2. Scope
    - Only grades where classes.level IN ('SS1','SS2','SS3')
    - Totals computed from total_score when present, else ca1+ca3+exam
*/

WITH low_ss AS (
  SELECT g.id AS grade_id,
         g.student_id,
         g.subject_id,
         g.class_id,
         g.academic_year_id,
         g.term_id,
         c.school_id,
         COALESCE(g.total_score, COALESCE(g.ca1_score,0)+COALESCE(g.ca3_score,0)+COALESCE(g.exam_score,0)) AS total
  FROM grades g
  JOIN classes c ON c.id = g.class_id
  WHERE c.level IN ('SS1','SS2','SS3')
)
INSERT INTO student_subject_exclusions (school_id, student_id, subject_id, class_id, academic_year_id, term_id, reason)
SELECT DISTINCT school_id, student_id, subject_id, class_id, academic_year_id, term_id,
       'Auto-unassigned: total score below 5'
FROM low_ss
WHERE total < 5
ON CONFLICT DO NOTHING;

DELETE FROM grades g
USING classes c
WHERE g.class_id = c.id
  AND c.level IN ('SS1','SS2','SS3')
  AND COALESCE(g.total_score, COALESCE(g.ca1_score,0)+COALESCE(g.ca3_score,0)+COALESCE(g.exam_score,0)) < 5;

DELETE FROM exam_marks_records e
USING classes c
WHERE e.class_id = c.id
  AND c.level IN ('SS1','SS2','SS3')
  AND COALESCE(e.total, COALESCE(e.ca1,0)+COALESCE(e.ca3,0)+COALESCE(e.exam,0)) < 5;
