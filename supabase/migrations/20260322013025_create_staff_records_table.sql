/*
  # Create staff_records table

  ## Summary
  Creates a standalone staff records table for managing teaching and non-teaching staff,
  separate from auth.users to allow flexible staff management without requiring login accounts.

  ## New Tables
  - `staff_records`
    - `id` (uuid, primary key)
    - `school_id` (uuid, FK to schools)
    - `staff_id` (text) - auto-generated ID like STF/2026/001
    - `first_name`, `last_name` (text) - staff full name
    - `role` (text) - teacher, accountant, admin, support, etc.
    - `phone`, `email` (text) - contact info
    - `subject` (text) - subject specialty for teachers
    - `basic_salary`, `housing_allowance`, `transport_allowance`, `other_allowances`, `deductions` (numeric) - payroll info
    - `date_joined` (date) - employment start date
    - `status` (text) - active/inactive, defaults to active
    - `created_at`, `updated_at` (timestamptz)

  ## Security
  - RLS enabled on staff_records
  - Super admins and school-scoped users can select their school's staff
  - Only super admins can insert/update/delete staff records
*/

CREATE TABLE IF NOT EXISTS staff_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id text NOT NULL DEFAULT '',
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'teacher',
  phone text DEFAULT '',
  email text DEFAULT '',
  subject text DEFAULT '',
  basic_salary numeric(12,2) DEFAULT 0,
  housing_allowance numeric(12,2) DEFAULT 0,
  transport_allowance numeric(12,2) DEFAULT 0,
  other_allowances numeric(12,2) DEFAULT 0,
  deductions numeric(12,2) DEFAULT 0,
  date_joined date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE staff_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view staff records"
  ON staff_records FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Super admins can insert staff records"
  ON staff_records FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admins can update staff records"
  ON staff_records FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admins can delete staff records"
  ON staff_records FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
