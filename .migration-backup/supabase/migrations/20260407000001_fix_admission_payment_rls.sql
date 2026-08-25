/*
  # Fix Admission Payment RLS Policies

  Ensures anon users can UPDATE admission_payments and prospective_students
  after a successful Paystack payment callback.

  The original migration defined these policies, but if the DB was not
  fully migrated they may be missing. This migration uses DROP IF EXISTS
  before re-creating to be safe.
*/

-- ─── admission_payments ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public can update payment records" ON admission_payments;

CREATE POLICY "Public can update payment records"
  ON admission_payments FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ─── prospective_students ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public can update own pending application" ON prospective_students;

CREATE POLICY "Public can update own pending application"
  ON prospective_students FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
