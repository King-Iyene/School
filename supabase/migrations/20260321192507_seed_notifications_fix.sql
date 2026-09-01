/*
  # Fix notifications seed - correct type values: info, warning, success, error
*/

DO $$
DECLARE
  v_school uuid := (SELECT id FROM schools LIMIT 1);
  v_admin uuid := (SELECT id FROM profiles WHERE email = 'admin@okrika.edu.ng' LIMIT 1);
  v_teacher uuid := (SELECT id FROM profiles WHERE email = 'teacher@okrika.edu.ng' LIMIT 1);
  v_student uuid := (SELECT id FROM profiles WHERE email = 'student@okrika.edu.ng' LIMIT 1);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_teacher AND title = 'Exam Schedule Published') THEN
    INSERT INTO notifications(user_id, school_id, title, message, type, is_read, sender_id) VALUES (v_teacher, v_school, 'Exam Schedule Published', 'The first term examination schedule has been published.', 'info', false, v_admin);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_teacher AND title = 'Staff Meeting Reminder') THEN
    INSERT INTO notifications(user_id, school_id, title, message, type, is_read, sender_id) VALUES (v_teacher, v_school, 'Staff Meeting Reminder', 'Mandatory staff meeting on March 25 at 9:00 AM', 'info', false, v_admin);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_student AND title = 'Exam Coming Up') THEN
    INSERT INTO notifications(user_id, school_id, title, message, type, is_read, sender_id) VALUES (v_student, v_school, 'Exam Coming Up', 'First term examinations begin April 14. Prepare accordingly.', 'info', false, v_admin);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_student AND title = 'Homework Due Tomorrow') THEN
    INSERT INTO notifications(user_id, school_id, title, message, type, is_read, sender_id) VALUES (v_student, v_school, 'Homework Due Tomorrow', 'Your Biology homework (Cell Structure Diagram) is due tomorrow.', 'warning', true, v_teacher);
  END IF;
END $$;
