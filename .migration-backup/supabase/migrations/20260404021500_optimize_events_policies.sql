-- Improve events table RLS policies to use helper functions and fix deletion

-- 1. Ensure RLS is enabled
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "School members can view events" ON events;
DROP POLICY IF EXISTS "Admins can create events" ON events;
DROP POLICY IF EXISTS "Admins can update events" ON events;
DROP POLICY IF EXISTS "Authorized roles can delete events" ON events;
DROP POLICY IF EXISTS "Admins can delete events" ON events;

-- 3. Create optimized policies
CREATE POLICY "School members can view events"
  ON events FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('super_admin', 'teacher', 'accountant'));

CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (get_my_role() IN ('super_admin', 'teacher'));

CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (get_my_role() = 'super_admin');
