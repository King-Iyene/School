/*
  # Finance Module Overhaul

  1. Changes to existing tables
    - `fees_master`: Add `term_id` column (uuid, FK to terms)
    - `fee_payments`: Add `term_id`, `total_fee_amount`, `balance_remaining` columns
    - `fees_collections`: Add `term_id` column

  2. New tables
    - `student_debts`: Replaces conceptual "carry forward" with per-term debt tracking
      - `id` (uuid, PK)
      - `school_id` (uuid, FK)
      - `student_id` (uuid, FK to students)
      - `class_id` (uuid, FK to classes)
      - `term_id` (uuid, FK to terms)
      - `academic_year_id` (uuid, FK to academic_years)
      - `amount_owed` (numeric)
      - `reason` (text)
      - `recorded_by` (uuid)
      - `created_at`, `updated_at` (timestamptz)

    - `fee_payment_installments`: Tracks partial payments against a fee obligation
      - `id` (uuid, PK)
      - `fee_payment_id` (uuid, FK to fee_payments)
      - `fees_collection_id` (uuid, FK to fees_collections, nullable)
      - `amount_paid` (numeric)
      - `payment_method` (text)
      - `receipt_number` (text)
      - `payment_date` (date)
      - `notes` (text)
      - `recorded_by` (uuid)
      - `created_at` (timestamptz)

  3. Security
    - RLS enabled on both new tables
    - School members can view records in their school
    - Admin/super_admin/principal can insert/update
    - Only super_admin can delete

  4. Important notes
    - fees_carry_forward table is kept for backward compatibility but student_debts is the new table
    - fee_payments status values expanded: paid, partially_paid, unpaid, pending
*/

-- Add term_id to fees_master
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fees_master' AND column_name = 'term_id'
  ) THEN
    ALTER TABLE fees_master ADD COLUMN term_id uuid REFERENCES terms(id);
  END IF;
END $$;

-- Add term_id to fees_collections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fees_collections' AND column_name = 'term_id'
  ) THEN
    ALTER TABLE fees_collections ADD COLUMN term_id uuid REFERENCES terms(id);
  END IF;
END $$;

-- Add term_id, total_fee_amount, balance_remaining to fee_payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fee_payments' AND column_name = 'term_id'
  ) THEN
    ALTER TABLE fee_payments ADD COLUMN term_id uuid REFERENCES terms(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fee_payments' AND column_name = 'total_fee_amount'
  ) THEN
    ALTER TABLE fee_payments ADD COLUMN total_fee_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fee_payments' AND column_name = 'balance_remaining'
  ) THEN
    ALTER TABLE fee_payments ADD COLUMN balance_remaining numeric DEFAULT 0;
  END IF;
END $$;

-- Create student_debts table
CREATE TABLE IF NOT EXISTS student_debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) NOT NULL,
  student_id uuid REFERENCES students(id) NOT NULL,
  class_id uuid REFERENCES classes(id),
  term_id uuid REFERENCES terms(id) NOT NULL,
  academic_year_id uuid REFERENCES academic_years(id) NOT NULL,
  amount_owed numeric NOT NULL DEFAULT 0,
  reason text DEFAULT '',
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE student_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view student debts"
  ON student_debts FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert student debts"
  ON student_debts FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() IN ('super_admin', 'admin', 'principal', 'accountant')
  );

CREATE POLICY "Admins can update student debts"
  ON student_debts FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'admin', 'principal', 'accountant'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'admin', 'principal', 'accountant'));

CREATE POLICY "Super admin can delete student debts"
  ON student_debts FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Create fee_payment_installments table
CREATE TABLE IF NOT EXISTS fee_payment_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_payment_id uuid REFERENCES fee_payments(id) ON DELETE CASCADE,
  fees_collection_id uuid REFERENCES fees_collections(id) ON DELETE CASCADE,
  amount_paid numeric NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash',
  receipt_number text DEFAULT '',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fee_payment_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view installments"
  ON fee_payment_installments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fee_payments fp
      WHERE fp.id = fee_payment_installments.fee_payment_id
      AND fp.school_id = get_my_school_id()
    )
    OR EXISTS (
      SELECT 1 FROM fees_collections fc
      WHERE fc.id = fee_payment_installments.fees_collection_id
      AND fc.school_id = get_my_school_id()
    )
  );

CREATE POLICY "Admins can insert installments"
  ON fee_payment_installments FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() IN ('super_admin', 'admin', 'principal', 'accountant')
  );

CREATE POLICY "Admins can update installments"
  ON fee_payment_installments FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('super_admin', 'admin', 'principal', 'accountant'))
  WITH CHECK (get_my_role() IN ('super_admin', 'admin', 'principal', 'accountant'));

CREATE POLICY "Super admin can delete installments"
  ON fee_payment_installments FOR DELETE
  TO authenticated
  USING (get_my_role() = 'super_admin');

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_debts_school_id ON student_debts(school_id);
CREATE INDEX IF NOT EXISTS idx_student_debts_student_id ON student_debts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_debts_term_year ON student_debts(term_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_fee_payment_installments_payment ON fee_payment_installments(fee_payment_id);
CREATE INDEX IF NOT EXISTS idx_fee_payment_installments_collection ON fee_payment_installments(fees_collection_id);
CREATE INDEX IF NOT EXISTS idx_fees_master_term ON fees_master(term_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_term ON fee_payments(term_id);
CREATE INDEX IF NOT EXISTS idx_fees_collections_term ON fees_collections(term_id);

-- Add delete policy for fee_payments (super_admin only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fee_payments' AND policyname = 'Super admin can delete fee payments'
  ) THEN
    CREATE POLICY "Super admin can delete fee payments"
      ON fee_payments FOR DELETE
      TO authenticated
      USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
  END IF;
END $$;

-- Add update policy for fee_payments (admin/super_admin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fee_payments' AND policyname = 'Admins can update fee payments'
  ) THEN
    CREATE POLICY "Admins can update fee payments"
      ON fee_payments FOR UPDATE
      TO authenticated
      USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'admin'))
      WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'admin'));
  END IF;
END $$;
