-- Migration to add automated fee reminders

-- Create function to process daily fee reminders
CREATE OR REPLACE FUNCTION public.process_daily_fee_reminders()
RETURNS VOID AS $$
DECLARE
  v_fee RECORD;
  v_student_ids UUID[];
BEGIN
  -- Find fee structures due in exactly 3 days
  FOR v_fee IN (
    SELECT * FROM fee_structures 
    WHERE due_date = (CURRENT_DATE + INTERVAL '3 days')::DATE
  ) LOOP
    -- Get active students affected by this fee
    SELECT array_agg(se.student_id) INTO v_student_ids
    FROM student_enrollments se
    JOIN classes c ON se.class_id = c.id
    WHERE se.status = 'active'
      AND (v_fee.class_level = 'all' OR c.level = v_fee.class_level);

    IF v_student_ids IS NOT NULL AND array_length(v_student_ids, 1) > 0 THEN
      PERFORM public.create_notification_bulk(
        v_fee.school_id,
        NULL, -- System notification (sender_id = NULL)
        v_student_ids,
        'Fee Reminder: Due in 3 Days',
        'Reminder: The fee "' || v_fee.name || '" (Amount: ' || v_fee.amount || ') is due on ' || v_fee.due_date || '.',
        'warning',
        'fee',
        'role',
        'student',
        NULL,
        NULL,
        '[]'::jsonb,
        jsonb_build_object('fee_id', v_fee.id)
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Scheduled execution should be configured in the Supabase Dashboard or via pg_cron:
-- SELECT cron.schedule('daily-fee-reminders', '0 8 * * *', 'SELECT public.process_daily_fee_reminders()');
