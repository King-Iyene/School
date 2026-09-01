/*
  # Remove Computer Science from Senior Secondary (SS1-SS3) only

  1. Context
    - Some SSS students currently have Computer Science grades and the subject is linked
      to SSS classes via `class_subjects`.
    - Computer Science should only apply to Junior Secondary (JSS1-JSS3).

  2. Changes
    - Delete rows in `grades` for subject Computer Science where the student's class
      level is SS1, SS2, or SS3.
    - Delete rows in `class_subjects` linking Computer Science to any SS1/SS2/SS3 class.

  3. Safety
    - Targets ONLY senior secondary (SS1/SS2/SS3). Junior secondary data is untouched.
    - The subject row itself is preserved so JSS classes keep using it.
*/

DELETE FROM grades g
USING students s, classes c
WHERE g.student_id = s.id
  AND s.class_id = c.id
  AND g.subject_id = 'de0e9791-e6eb-4001-a56a-5834ab2ec856'
  AND c.level IN ('SS1','SS2','SS3');

DELETE FROM class_subjects cs
USING classes c
WHERE cs.class_id = c.id
  AND cs.subject_id = 'de0e9791-e6eb-4001-a56a-5834ab2ec856'
  AND c.level IN ('SS1','SS2','SS3');
