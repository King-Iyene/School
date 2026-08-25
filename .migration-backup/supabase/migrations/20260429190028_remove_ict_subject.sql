/*
  # Remove ICT Subject and All Related Data

  1. Purpose
    - Remove the "ICT" subject and all rows that reference it across the database.

  2. Affected Tables (rows referencing subject ICT will be deleted)
    - grades
    - class_subjects
    - assignments
    - timetable
    - subject_teacher_assignments
    - exam_setups, exam_schedules, exam_marks_records, exam_attendance_records
    - question_groups, question_bank, online_exams
    - study_materials, syllabus_items, homework_records
    - lessons, student_assessments
    - exam_results, exam_schedule
    - subject_class_assignments, offline_exam_results
    - timetable_template_entries, class_routines
    - student_subject_exclusions
    - Finally, the subjects row itself

  3. Notes
    - Only rows referencing the ICT subject id are removed.
    - No schema changes; existing functionality remains intact.
*/

DO $$
DECLARE
  ict_id uuid;
BEGIN
  SELECT id INTO ict_id FROM subjects WHERE name = 'ICT' AND code = 'ICT' LIMIT 1;

  IF ict_id IS NULL THEN
    RAISE NOTICE 'ICT subject not found; nothing to delete';
    RETURN;
  END IF;

  DELETE FROM grades WHERE subject_id = ict_id;
  DELETE FROM class_subjects WHERE subject_id = ict_id;
  DELETE FROM assignments WHERE subject_id = ict_id;
  DELETE FROM timetable WHERE subject_id = ict_id;
  DELETE FROM subject_teacher_assignments WHERE subject_id = ict_id;
  DELETE FROM exam_setups WHERE subject_id = ict_id;
  DELETE FROM exam_schedules WHERE subject_id = ict_id;
  DELETE FROM exam_marks_records WHERE subject_id = ict_id;
  DELETE FROM exam_attendance_records WHERE subject_id = ict_id;
  DELETE FROM question_groups WHERE subject_id = ict_id;
  DELETE FROM question_bank WHERE subject_id = ict_id;
  DELETE FROM online_exams WHERE subject_id = ict_id;
  DELETE FROM study_materials WHERE subject_id = ict_id;
  DELETE FROM syllabus_items WHERE subject_id = ict_id;
  DELETE FROM homework_records WHERE subject_id = ict_id;
  DELETE FROM lessons WHERE subject_id = ict_id;
  DELETE FROM student_assessments WHERE subject_id = ict_id;
  DELETE FROM exam_results WHERE subject_id = ict_id;
  DELETE FROM exam_schedule WHERE subject_id = ict_id;
  DELETE FROM subject_class_assignments WHERE subject_id = ict_id;
  DELETE FROM offline_exam_results WHERE subject_id = ict_id;
  DELETE FROM timetable_template_entries WHERE subject_id = ict_id;
  DELETE FROM class_routines WHERE subject_id = ict_id;
  DELETE FROM student_subject_exclusions WHERE subject_id = ict_id;

  DELETE FROM subjects WHERE id = ict_id;
END $$;