-- Unified Trigger for Leave Applications
-- Handles: 1. New application -> Notify Admins. 2. Status change -> Notify Staff.

CREATE OR REPLACE FUNCTION public.handle_leave_application_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_staff_name TEXT;
  v_admin_id UUID;
  v_leave_type_name TEXT;
  v_school_id UUID;
BEGIN
  -- 1. Common Data
  SELECT first_name || ' ' || last_name, school_id INTO v_staff_name, v_school_id
  FROM public.profiles WHERE id = NEW.staff_id;

  SELECT name INTO v_leave_type_name FROM public.leave_types WHERE id = NEW.leave_type_id;

  -- 2. CASE: NEW APPLICATION (Notify Admins)
  IF TG_OP = 'INSERT' THEN
    FOR v_admin_id IN SELECT id FROM public.profiles WHERE school_id = v_school_id AND role = 'super_admin'
    LOOP
      INSERT INTO public.notifications (school_id, sender_id, user_id, title, message, type, notification_type, target_type, metadata)
      VALUES (v_school_id, NEW.staff_id, v_admin_id, 'New Leave Application', 
        v_staff_name || ' has applied for ' || v_leave_type_name || ' from ' || NEW.from_date || ' to ' || NEW.to_date || ' (' || NEW.days || ' days).',
        'info', 'hr', 'individual', jsonb_build_object('application_id', NEW.id, 'staff_id', NEW.staff_id, 'action', 'view_leave_application'));
    END LOOP;

  -- 3. CASE: STATUS UPDATE (Notify Staff)
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO public.notifications (
      school_id, sender_id, user_id, title, message, type, notification_type, target_type, metadata
    ) VALUES (
      v_school_id, NEW.approved_by, NEW.staff_id, 
      'Leave Application ' || initcap(NEW.status),
      'Your leave application for ' || v_leave_type_name || ' (' || NEW.from_date || ' to ' || NEW.to_date || ') has been ' || NEW.status || '.',
      CASE WHEN NEW.status = 'approved' THEN 'success' ELSE 'error' END,
      'hr', 'individual',
      jsonb_build_object('application_id', NEW.id, 'status', NEW.status, 'action', 'view_my_leaves')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply Trigger for both INSERT and UPDATE
DROP TRIGGER IF EXISTS on_leave_application ON public.leave_applications;
CREATE TRIGGER on_leave_application
  AFTER INSERT OR UPDATE ON public.leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_leave_application_notification();

NOTIFY pgrst, 'reload schema';
