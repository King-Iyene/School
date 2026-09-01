-- Migration to add assignee and notifications to todo items

-- 1. Add new columns to todo_items table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'todo_items' AND column_name = 'assigned_to') THEN
    ALTER TABLE todo_items ADD COLUMN assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'todo_items' AND column_name = 'created_by') THEN
    ALTER TABLE todo_items ADD COLUMN created_by uuid REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Backfill created_by with user_id for existing todos
UPDATE todo_items SET created_by = user_id WHERE created_by IS NULL;

-- 3. Update RLS policies for todo_items
DROP POLICY IF EXISTS "Users can view own todos" ON todo_items;
CREATE POLICY "Users can view own or assigned todos"
  ON todo_items FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR assigned_to = auth.uid());

DROP POLICY IF EXISTS "Users can insert own todos" ON todo_items;
CREATE POLICY "Users can insert own todos"
  ON todo_items FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own todos" ON todo_items;
CREATE POLICY "Users can update own or assigned todos"
  ON todo_items FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR assigned_to = auth.uid())
  WITH CHECK (user_id = auth.uid() OR assigned_to = auth.uid());

DROP POLICY IF EXISTS "Users can delete own todos" ON todo_items;
CREATE POLICY "Users can delete own todos"
  ON todo_items FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 4. Trigger function for task assignment notification
CREATE OR REPLACE FUNCTION public.handle_todo_assignment_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_assigner_name TEXT;
  v_title TEXT;
BEGIN
  -- Only notify if assigned_to is set and it's either a new task or the assignment changed
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.assigned_to IS NULL OR OLD.assigned_to <> NEW.assigned_to))) THEN
    -- Get assigner name
    SELECT first_name || ' ' || last_name INTO v_assigner_name
    FROM profiles WHERE id = NEW.user_id;

    -- Create notification for the assignee
    PERFORM public.create_notification_bulk(
      NEW.school_id,
      NEW.user_id,
      ARRAY[NEW.assigned_to],
      'New Task Assigned',
      v_assigner_name || ' assigned a new task to you: ' || NEW.title,
      'info',
      'task',
      'individual',
      NULL,
      NULL,
      NULL,
      '[]'::jsonb,
      jsonb_build_object('todo_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger
DROP TRIGGER IF EXISTS on_todo_assigned ON todo_items;
CREATE TRIGGER on_todo_assigned
  AFTER INSERT OR UPDATE ON todo_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_todo_assignment_notification();
