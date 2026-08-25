-- Migration to enhance notifications and add automated triggers

-- 1. Add new columns to notifications table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'target_class_id') THEN
    ALTER TABLE notifications ADD COLUMN target_class_id uuid REFERENCES classes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'scheduled_at') THEN
    ALTER TABLE notifications ADD COLUMN scheduled_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'attachments') THEN
    ALTER TABLE notifications ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'metadata') THEN
    ALTER TABLE notifications ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2. Create storage bucket for notification attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('notification-attachments', 'notification-attachments', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for notification-attachments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read notification attachments' AND tablename = 'objects') THEN
    CREATE POLICY "Public read notification attachments"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'notification-attachments');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users upload notification attachments' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users upload notification attachments"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'notification-attachments');
  END IF;
END $$;

-- 4. Bulk notification helper function
CREATE OR REPLACE FUNCTION public.create_notification_bulk(
  p_school_id UUID,
  p_sender_id UUID,
  p_recipient_ids UUID[],
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_notification_type TEXT DEFAULT 'general',
  p_target_type TEXT DEFAULT 'individual',
  p_target_role TEXT DEFAULT NULL,
  p_target_class_id UUID DEFAULT NULL,
  p_scheduled_at TIMESTAMPTZ DEFAULT NULL,
  p_attachments JSONB DEFAULT '[]'::jsonb,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.notifications (
    school_id, sender_id, user_id, title, message, type, notification_type, 
    target_type, target_role, target_class_id, scheduled_at, attachments, metadata
  )
  SELECT 
    p_school_id, p_sender_id, r_id, p_title, p_message, p_type, p_notification_type,
    p_target_type, p_target_role, p_target_class_id, p_scheduled_at, p_attachments, p_metadata
  FROM unnest(p_recipient_ids) AS r_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Automated Triggers

-- Trigger for Attendance (Absent) -> Notify Parents
CREATE OR REPLACE FUNCTION public.handle_attendance_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_student_name TEXT;
  v_school_id UUID;
  v_parent_ids UUID[];
BEGIN
  IF NEW.status = 'absent' THEN
    -- Get student name and school_id
    SELECT first_name || ' ' || last_name, school_id 
    INTO v_student_name, v_school_id
    FROM profiles WHERE id = NEW.student_id;

    -- Get parent IDs
    SELECT array_agg(parent_id) INTO v_parent_ids
    FROM parent_student_links WHERE student_id = NEW.student_id;

    IF v_parent_ids IS NOT NULL AND array_length(v_parent_ids, 1) > 0 THEN
      PERFORM public.create_notification_bulk(
        v_school_id,
        NEW.recorded_by,
        v_parent_ids,
        'Attendance Alert: Absent',
        v_student_name || ' was marked absent today.',
        'warning',
        'alert',
        'individual',
        'parent',
        NEW.class_id,
        NULL,
        '[]'::jsonb,
        jsonb_build_object('student_id', NEW.student_id, 'attendance_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_attendance_absent ON attendance;
CREATE TRIGGER on_attendance_absent
  AFTER INSERT OR UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_attendance_notification();

-- Trigger for Grades (Published) -> Notify Students
CREATE OR REPLACE FUNCTION public.handle_grade_published_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_student_ids UUID[];
  v_class_name TEXT;
  v_sender_id UUID;
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status <> 'published') THEN
    -- Get student IDs in the class
    SELECT array_agg(student_id) INTO v_student_ids
    FROM student_enrollments 
    WHERE class_id = NEW.class_id AND status = 'active';

    -- Get class name
    SELECT name INTO v_class_name FROM classes WHERE id = NEW.class_id;

    IF v_student_ids IS NOT NULL AND array_length(v_student_ids, 1) > 0 THEN
      PERFORM public.create_notification_bulk(
        NEW.school_id,
        NEW.compiled_by,
        v_student_ids,
        'Result Published',
        'The results for ' || v_class_name || ' for the current term have been published.',
        'success',
        'exam',
        'role',
        'student',
        NEW.class_id,
        NULL,
        '[]'::jsonb,
        jsonb_build_object('compilation_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_result_published ON result_compilations;
CREATE TRIGGER on_result_published
  AFTER UPDATE ON result_compilations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_grade_published_notification();

-- Trigger for Assignments -> Notify Students
CREATE OR REPLACE FUNCTION public.handle_assignment_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_student_ids UUID[];
  v_school_id UUID;
BEGIN
  -- Get school_id
  SELECT school_id INTO v_school_id FROM profiles WHERE id = NEW.teacher_id;

  -- Get student IDs in the class
  SELECT array_agg(student_id) INTO v_student_ids
  FROM student_enrollments 
  WHERE class_id = NEW.class_id AND status = 'active';

  IF v_student_ids IS NOT NULL AND array_length(v_student_ids, 1) > 0 THEN
    PERFORM public.create_notification_bulk(
      v_school_id,
      NEW.teacher_id,
      v_student_ids,
      'New Assignment: ' || NEW.title,
      'A new assignment titled "' || NEW.title || '" has been posted.',
      'info',
      'assignment',
      'role',
      'student',
      NEW.class_id,
      NULL,
      '[]'::jsonb,
      jsonb_build_object('assignment_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_assignment_created ON assignments;
CREATE TRIGGER on_assignment_created
  AFTER INSERT ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_assignment_notification();
