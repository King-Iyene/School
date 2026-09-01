/*
  # Extend Notifications and Create Todo Items

  ## Changes
  - Add school_id, sender_id, target_type, target_role, notification_type columns to existing notifications table
  - Create todo_items table for dashboard to-do list
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'school_id') THEN
    ALTER TABLE notifications ADD COLUMN school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'sender_id') THEN
    ALTER TABLE notifications ADD COLUMN sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'target_type') THEN
    ALTER TABLE notifications ADD COLUMN target_type text DEFAULT 'all';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'target_role') THEN
    ALTER TABLE notifications ADD COLUMN target_role text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'notification_type') THEN
    ALTER TABLE notifications ADD COLUMN notification_type text DEFAULT 'general';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS todo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  completed boolean DEFAULT false,
  due_date date,
  priority text DEFAULT 'normal',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own todos"
  ON todo_items FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own todos"
  ON todo_items FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own todos"
  ON todo_items FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own todos"
  ON todo_items FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
