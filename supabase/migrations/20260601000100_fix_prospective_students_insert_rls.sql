/*
  # Fix: Staff can fully manage prospective students from the admin panel

  ## Problems
  1. INSERT was blocked for authenticated staff when guardian_email was empty —
     the existing policy required guardian_email for ALL users (anon + authenticated),
     but admin staff add applicants manually and may not have the email yet.

  2. DELETE was never granted to staff — no DELETE policy existed on the table,
     so delete attempts silently failed (RLS blocks by default).

  ## Fix
  - Split INSERT into two policies: strict for anon (public form), relaxed for staff.
  - Add an explicit DELETE policy for authenticated staff.
  - SELECT and UPDATE are already covered by the policies applied in
    20260402220010_fix_admission_rls_policies_corrected.sql (USING(true) for
    authenticated), so those are left untouched.

  ## Run this in Supabase → SQL Editor
*/

-- ── INSERT: drop the old combined policy ───────────────────────────────────
DROP POLICY IF EXISTS "Public can submit admission applications" ON prospective_students;

-- ── INSERT 1/2: Anon / public admission form ────────────────────────────────
-- Keeps the guardian-email requirement so every self-submitted application is
-- traceable without an account.
CREATE POLICY "Anon can submit admission applications"
  ON prospective_students
  FOR INSERT
  TO anon
  WITH CHECK (
    guardian_email IS NOT NULL AND
    guardian_email != ''       AND
    first_name     IS NOT NULL AND
    last_name      IS NOT NULL
  );

-- ── INSERT 2/2: Authenticated staff / admin ─────────────────────────────────
-- Staff add applicants through the admin panel; guardian email is optional
-- at data-entry time. We only require the student's name and that the row is
-- assigned to the same school as the logged-in user.
CREATE POLICY "Staff can add prospective students"
  ON prospective_students
  FOR INSERT
  TO authenticated
  WITH CHECK (
    first_name IS NOT NULL AND
    last_name  IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id        = (SELECT auth.uid())
        AND profiles.school_id = prospective_students.school_id
        AND profiles.role IN ('super_admin', 'admin', 'teacher', 'accountant')
    )
  );

-- ── DELETE: staff can remove prospective student records ────────────────────
-- No DELETE policy existed before; RLS blocks by default, so deletes silently
-- did nothing. This grants DELETE to authenticated staff/admin only.
CREATE POLICY "Staff can delete prospective students"
  ON prospective_students
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id        = (SELECT auth.uid())
        AND profiles.school_id = prospective_students.school_id
        AND profiles.role IN ('super_admin', 'admin', 'teacher', 'accountant')
    )
  );
