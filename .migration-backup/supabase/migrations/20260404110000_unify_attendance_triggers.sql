-- Migration to unify attendance notifications on the modern student_attendance table

-- 1. Create the notification function for student_attendance
CREATE OR REPLACE FUNCTION public.handle_student_attendance_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_student_name TEXT;
  v_school_id UUID;
  v_parent_ids UUID[];
BEGIN
  -- Only trigger for "absent" status
  IF NEW.status = 'absent' THEN
    -- Get student name and school_id
    SELECT first_name || ' ' || last_name, school_id 
    INTO v_student_name, v_school_id
    FROM students WHERE id = NEW.student_id;

    -- Get parent IDs from the parent_student_links table
    -- (This links parents directly to student records)
    SELECT array_agg(parent_id) INTO v_parent_ids
    FROM parent_student_links WHERE student_id = NEW.student_id;

    IF v_parent_ids IS NOT NULL AND array_length(v_parent_ids, 1) > 0 THEN
      PERFORM public.create_notification_bulk(
        v_school_id,
        COALESCE(NEW.recorded_by, '00000000-0000-0000-0000-000000000000'::uuid), -- System ID if recorder missing
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

-- 2. Drop the trigger from the legacy "attendance" table (optional but cleaner)
DROP TRIGGER IF EXISTS on_attendance_absent ON attendance;

-- 3. Create the trigger on the "student_attendance" table
DROP TRIGGER IF EXISTS on_student_attendance_absent ON student_attendance;
CREATE TRIGGER on_student_attendance_absent
  AFTER INSERT OR UPDATE ON student_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_student_attendance_notification();

-- 4. Ensure RLS policies on student_attendance allow teachers to update
-- (This was usually already handled, but reinforcing it here)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'student_attendance' 
    AND policyname = 'Admins and teachers can insert student_attendance'
  ) THEN
    CREATE POLICY "Admins and teachers can insert student_attendance"
      ON student_attendance FOR INSERT
      TO authenticated
      WITH CHECK (
        school_id = get_my_school_id()
        AND get_my_role() IN ('super_admin', 'teacher')
      );
  END IF;
END $$;
