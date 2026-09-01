/*
  # Assign Core Subjects to All Classes

  ## Overview
  Ensures all classes have the four mandatory core subjects:
  - Mathematics
  - English Language  
  - Digital Technology
  - Civic Education

  These subjects are inserted for every class that doesn't already have them.
  teacher_id is left NULL — teachers will be assigned via the Assign Subject module.
*/

DO $$
DECLARE
  v_class RECORD;
  v_math_id uuid := (SELECT id FROM subjects WHERE code = 'MATH' LIMIT 1);
  v_eng_id  uuid := (SELECT id FROM subjects WHERE code = 'ENG' LIMIT 1);
  v_dt_id   uuid := (SELECT id FROM subjects WHERE code = 'DIGI' LIMIT 1);
  v_civ_id  uuid := (SELECT id FROM subjects WHERE code = 'CIV' LIMIT 1);
BEGIN
  FOR v_class IN SELECT id FROM classes LOOP
    INSERT INTO class_subjects (class_id, subject_id)
    VALUES
      (v_class.id, v_math_id),
      (v_class.id, v_eng_id),
      (v_class.id, v_dt_id),
      (v_class.id, v_civ_id)
    ON CONFLICT (class_id, subject_id) DO NOTHING;
  END LOOP;
END $$;
