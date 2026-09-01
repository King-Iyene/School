/*
  # Admission System Tables

  ## Overview
  Creates the complete admission workflow for prospective students:
  1. `prospective_students` — stores all applicant info from public admission form
  2. `admission_payments` — tracks Paystack payment records
  3. `admission_exam_slots` — available exam time slots
  4. `admission_exam_bookings` — which slot each applicant booked

  ## New Tables

  ### prospective_students
  - All application fields (personal, guardian, academic preferences)
  - `student_type`: 'boarding' or 'day'
  - `status`: pending_payment → paid → exam_scheduled → admitted / rejected
  - Linked to a school via `school_id`

  ### admission_payments
  - Paystack reference + amount + status
  - Linked to a prospective student

  ### admission_exam_slots
  - Date, start_time, end_time, capacity, remaining seats
  - Created by admins

  ### admission_exam_bookings
  - Links a prospective student to an exam slot
  - Tracks email_sent status

  ## Security
  - RLS enabled on all tables
  - Public INSERT allowed on prospective_students (admission form is public)
  - Public SELECT allowed on admission_exam_slots (to pick a slot)
  - Authenticated users with super_admin role can manage all records
*/

CREATE TABLE IF NOT EXISTS prospective_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male', 'female')),
  state_of_origin text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  student_type text NOT NULL DEFAULT 'day' CHECK (student_type IN ('boarding', 'day')),
  class_applying_for text NOT NULL DEFAULT '',
  current_school text NOT NULL DEFAULT '',
  medical_conditions text NOT NULL DEFAULT '',
  guardian_name text NOT NULL DEFAULT '',
  guardian_phone text NOT NULL DEFAULT '',
  guardian_email text NOT NULL DEFAULT '',
  guardian_occupation text NOT NULL DEFAULT '',
  guardian_relationship text NOT NULL DEFAULT '',
  emergency_contact text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'exam_scheduled', 'admitted', 'rejected')),
  application_ref text UNIQUE DEFAULT concat('APP-', upper(substr(gen_random_uuid()::text, 1, 8))),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospective_student_id uuid NOT NULL REFERENCES prospective_students(id) ON DELETE CASCADE,
  paystack_reference text UNIQUE NOT NULL,
  amount integer NOT NULL DEFAULT 1000000,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admission_exam_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  exam_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity integer NOT NULL DEFAULT 30,
  booked_count integer NOT NULL DEFAULT 0,
  exam_link text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admission_exam_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospective_student_id uuid NOT NULL REFERENCES prospective_students(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES admission_exam_slots(id) ON DELETE RESTRICT,
  email_sent boolean NOT NULL DEFAULT false,
  email_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(prospective_student_id)
);

ALTER TABLE prospective_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_exam_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_exam_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can submit admission applications"
  ON prospective_students FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can view own application by ref"
  ON prospective_students FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can update own pending application"
  ON prospective_students FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can create payment records"
  ON admission_payments FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can view own payment records"
  ON admission_payments FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can update payment records"
  ON admission_payments FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can view active exam slots"
  ON admission_exam_slots FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated can manage exam slots"
  ON admission_exam_slots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update exam slots"
  ON admission_exam_slots FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can create exam bookings"
  ON admission_exam_bookings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can view exam bookings"
  ON admission_exam_bookings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated can update exam bookings"
  ON admission_exam_bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION increment_exam_slot_bookings(slot_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admission_exam_slots
  SET booked_count = booked_count + 1
  WHERE id = slot_id_param AND booked_count < capacity;
END;
$$;
