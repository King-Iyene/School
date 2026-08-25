-- ============================================================
-- FORCE Restoration migration: Re-add RLS policies for Timetable & Periods
-- ============================================================

-- 1. Ensure RLS is enabled
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_week_days ENABLE ROW LEVEL SECURITY;

-- 2. Time Slots Policies
DROP POLICY IF EXISTS "School members can view time_slots" ON time_slots;
CREATE POLICY "School members can view time_slots" ON time_slots FOR SELECT TO authenticated USING (school_id = get_my_school_id());

DROP POLICY IF EXISTS "Super admin can insert time_slots" ON time_slots;
CREATE POLICY "Super admin can insert time_slots" ON time_slots FOR INSERT TO authenticated WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Super admin can update time_slots" ON time_slots;
CREATE POLICY "Super admin can update time_slots" ON time_slots FOR UPDATE TO authenticated USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Super admin can delete time_slots" ON time_slots;
CREATE POLICY "Super admin can delete time_slots" ON time_slots FOR DELETE TO authenticated USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- 3. Class Routines Policies
DROP POLICY IF EXISTS "School members can view class routines" ON class_routines;
CREATE POLICY "School members can view class routines" ON class_routines FOR SELECT TO authenticated USING (school_id = get_my_school_id());

DROP POLICY IF EXISTS "Super admin and teacher can insert class routines" ON class_routines;
CREATE POLICY "Super admin and teacher can insert class routines" ON class_routines FOR INSERT TO authenticated WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

DROP POLICY IF EXISTS "Super admin and teacher can update class routines" ON class_routines;
CREATE POLICY "Super admin and teacher can update class routines" ON class_routines FOR UPDATE TO authenticated USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

DROP POLICY IF EXISTS "Super admin can delete class routines" ON class_routines;
CREATE POLICY "Super admin can delete class routines" ON class_routines FOR DELETE TO authenticated USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

-- 4. Week Days Policies
DROP POLICY IF EXISTS "School members can view school_week_days" ON school_week_days;
CREATE POLICY "School members can view school_week_days" ON school_week_days FOR SELECT TO authenticated USING (school_id = get_my_school_id());

DROP POLICY IF EXISTS "Super admin can insert school_week_days" ON school_week_days;
CREATE POLICY "Super admin can insert school_week_days" ON school_week_days FOR INSERT TO authenticated WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Super admin can update school_week_days" ON school_week_days;
CREATE POLICY "Super admin can update school_week_days" ON school_week_days FOR UPDATE TO authenticated USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Super admin can delete school_week_days" ON school_week_days;
CREATE POLICY "Super admin can delete school_week_days" ON school_week_days FOR DELETE TO authenticated USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
