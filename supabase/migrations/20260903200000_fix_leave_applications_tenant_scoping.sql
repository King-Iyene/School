-- ============================================================================
-- Fix leave_applications RLS: restore admin/principal visibility AND close a
-- cross-tenant leak introduced alongside it.
-- ============================================================================
-- 20260423095741_fix_principal_rls_access_comprehensive.sql replaced the old
-- "Staff can view own leave applications" policy (which only let a
-- `super_admin` view a colleague's request) with one that also allows
-- `admin`/`principal` — but in doing so it dropped the school_id check
-- entirely. The resulting USING/WITH CHECK clauses only verify the caller's
-- *role*, not that the leave_applications row belongs to the caller's own
-- school, so any admin/principal at any tenant could read, insert on behalf
-- of, update, or delete any other school's leave applications. Every other
-- multi-tenant table in this codebase scopes admin/principal access with
-- `p.school_id = <table>.school_id` (see staff_attendance_records' SELECT
-- policy in the same migration for the pattern this restores).
DROP POLICY IF EXISTS "Staff and admins can view leave applications" ON leave_applications;
DROP POLICY IF EXISTS "Staff and admins can insert leave applications" ON leave_applications;
DROP POLICY IF EXISTS "Admins and principal can update leave applications" ON leave_applications;
DROP POLICY IF EXISTS "Admins and principal can delete leave applications" ON leave_applications;

CREATE POLICY "Staff and admins can view leave applications"
  ON leave_applications FOR SELECT
  TO authenticated
  USING (
    staff_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
      AND p.school_id = leave_applications.school_id
    )
  );

-- NOTE: inside these correlated EXISTS subqueries, an unqualified `school_id`
-- resolves to `profiles.school_id` (the subquery's own FROM table shadows
-- the outer INSERT/UPDATE target), not the new row being written — silently
-- turning `p.school_id = school_id` into the tautology `p.school_id =
-- p.school_id`. Every reference to the row being written must be qualified
-- with the target table's own name (`leave_applications.school_id`), which
-- Postgres resolves correctly even though there's no existing row yet on
-- INSERT. Caught by locally simulating a second tenant's admin and
-- confirming an insert/update they shouldn't be able to make was rejected.
CREATE POLICY "Staff and admins can insert leave applications"
  ON leave_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      staff_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = (SELECT auth.uid())
        AND p.school_id = leave_applications.school_id
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
      AND p.school_id = leave_applications.school_id
    )
  );

CREATE POLICY "Admins and principal can update leave applications"
  ON leave_applications FOR UPDATE
  TO authenticated
  USING (
    staff_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
      AND p.school_id = leave_applications.school_id
    )
  )
  WITH CHECK (
    staff_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
      AND p.school_id = leave_applications.school_id
    )
  );

CREATE POLICY "Admins and principal can delete leave applications"
  ON leave_applications FOR DELETE
  TO authenticated
  USING (
    staff_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('super_admin', 'admin', 'principal')
      AND p.school_id = leave_applications.school_id
    )
  );
