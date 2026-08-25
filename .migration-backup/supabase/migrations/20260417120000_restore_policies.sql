-- ============================================================
-- Restoration migration: Re-add RLS policies for Timetable & Periods
-- ============================================================

-- 1. Ensure RLS is enabled
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_week_days ENABLE ROW LEVEL SECURITY;

-- 2. Time Slots Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'time_slots' AND policyname = 'School members can view time_slots') THEN
    CREATE POLICY "School members can view time_slots" ON time_slots FOR SELECT TO authenticated USING (school_id = get_my_school_id());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'time_slots' AND policyname = 'Super admin can insert time_slots') THEN
    CREATE POLICY "Super admin can insert time_slots" ON time_slots FOR INSERT TO authenticated WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'time_slots' AND policyname = 'Super admin can update time_slots') THEN
    CREATE POLICY "Super admin can update time_slots" ON time_slots FOR UPDATE TO authenticated USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'time_slots' AND policyname = 'Super admin can delete time_slots') THEN
    CREATE POLICY "Super admin can delete time_slots" ON time_slots FOR DELETE TO authenticated USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
  END IF;
END $$;

-- 3. Class Routines Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'class_routines' AND policyname = 'School members can view class routines') THEN
    CREATE POLICY "School members can view class routines" ON class_routines FOR SELECT TO authenticated USING (school_id = get_my_school_id());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'class_routines' AND policyname = 'Super admin and teacher can insert class routines') THEN
    CREATE POLICY "Super admin and teacher can insert class routines" ON class_routines FOR INSERT TO authenticated WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'class_routines' AND policyname = 'Super admin and teacher can update class routines') THEN
    CREATE POLICY "Super admin and teacher can update class routines" ON class_routines FOR UPDATE TO authenticated USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'class_routines' AND policyname = 'Super admin can delete class routines') THEN
    CREATE POLICY "Super admin can delete class routines" ON class_routines FOR DELETE TO authenticated USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));
  END IF;
END $$;

-- 4. Week Days Policies (redundancy check)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'school_week_days' AND policyname = 'School members can view school_week_days') THEN
    CREATE POLICY "School members can view school_week_days" ON school_week_days FOR SELECT TO authenticated USING (school_id = get_my_school_id());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'school_week_days' AND policyname = 'Super admin can insert school_week_days') THEN
    CREATE POLICY "Super admin can insert school_week_days" ON school_week_days FOR INSERT TO authenticated WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'school_week_days' AND policyname = 'Super admin can update school_week_days') THEN
    CREATE POLICY "Super admin can update school_week_days" ON school_week_days FOR UPDATE TO authenticated USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'school_week_days' AND policyname = 'Super admin can delete school_week_days') THEN
    CREATE POLICY "Super admin can delete school_week_days" ON school_week_days FOR DELETE TO authenticated USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
  END IF;
END $$;
