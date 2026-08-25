-- Trigger for Assignment Submissions -> Notify Teachers
CREATE OR REPLACE FUNCTION public.handle_submission_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_student_name TEXT;
  v_teacher_id UUID;
  v_assignment_title TEXT;
  v_school_id UUID;
BEGIN
  -- 1. Get student name and school_id
  SELECT first_name || ' ' || last_name, school_id 
  INTO v_student_name, v_school_id
  FROM public.profiles WHERE id = NEW.student_id;

  -- 2. Get teacher_id and assignment title
  SELECT teacher_id, title 
  INTO v_teacher_id, v_assignment_title
  FROM public.assignments WHERE id = NEW.assignment_id;

  -- 3. Create notification for teacher if applicable
  -- Only notify if it's a student submission (status = 'submitted')
  -- This avoids notifying the teacher when they themselves grade it
  IF NEW.status = 'submitted' AND v_teacher_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      school_id,
      sender_id,
      user_id,
      title,
      message,
      type,
      notification_type,
      target_type,
      metadata
    ) VALUES (
      v_school_id,
      NEW.student_id,
      v_teacher_id,
      CASE WHEN TG_OP = 'INSERT' THEN 'New Assignment Submission' ELSE 'Assignment Submission Updated' END,
      v_student_name || ' has ' || CASE WHEN TG_OP = 'INSERT' THEN 'submitted' ELSE 'updated their' END || ' work for "' || v_assignment_title || '".',
      'info',
      'assignment',
      'individual',
      jsonb_build_object(
        'assignment_id', NEW.assignment_id, 
        'submission_id', NEW.id, 
        'student_id', NEW.student_id,
        'action', 'view_submission'
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply Trigger
DROP TRIGGER IF EXISTS on_assignment_submission ON assignment_submissions;
CREATE TRIGGER on_assignment_submission
  AFTER INSERT OR UPDATE ON assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_submission_notification();

-- 5. Force REST Cache Reload
NOTIFY pgrst, 'reload schema';
