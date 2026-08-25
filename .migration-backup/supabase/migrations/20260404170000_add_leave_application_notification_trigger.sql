-- Trigger for Leave Applications -> Notify Super Admins
CREATE OR REPLACE FUNCTION public.handle_leave_application_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_staff_name TEXT;
  v_admin_id UUID;
  v_leave_type_name TEXT;
  v_school_id UUID;
BEGIN
  -- 1. Get staff name and school_id
  SELECT first_name || ' ' || last_name, school_id 
  INTO v_staff_name, v_school_id
  FROM public.profiles WHERE id = NEW.staff_id;

  -- 2. Get leave type name
  SELECT name INTO v_leave_type_name
  FROM public.leave_types WHERE id = NEW.leave_type_id;

  -- 3. Notify all Super Admins in the same school
  FOR v_admin_id IN 
    SELECT id FROM public.profiles 
    WHERE school_id = v_school_id AND role = 'super_admin'
  LOOP
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
      NEW.staff_id,
      v_admin_id,
      'New Leave Application',
      v_staff_name || ' has applied for ' || v_leave_type_name || ' from ' || NEW.from_date || ' to ' || NEW.to_date || ' (' || NEW.days || ' days).',
      'info',
      'hr',
      'individual',
      jsonb_build_object(
        'application_id', NEW.id,
        'staff_id', NEW.staff_id,
        'action', 'view_leave_application'
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply Trigger
DROP TRIGGER IF EXISTS on_leave_application ON public.leave_applications;
CREATE TRIGGER on_leave_application
  AFTER INSERT ON public.leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_leave_application_notification();

-- 5. Force REST Cache Reload
NOTIFY pgrst, 'reload schema';
