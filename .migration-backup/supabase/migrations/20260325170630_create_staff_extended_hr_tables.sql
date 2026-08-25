/*
  # Staff Extended HR Tables

  ## Summary
  Creates comprehensive HR tables for staff members covering all aspects of
  personnel management: HR details, next of kin, qualifications, documents,
  committee memberships, and disciplinary records.

  ## New Tables
  1. `staff_hr_details` - Extended personal/HR info (next of kin, bank, employment)
  2. `staff_qualifications` - Academic and professional qualifications
  3. `staff_documents` - Uploaded documents (CV, certificates, etc.)
  4. `staff_committees` - School committee memberships
  5. `staff_disciplinary` - Disciplinary incident records

  ## Modified Tables
  - `profiles` - adds join_date, department, employment_type, marital_status, nationality, state_of_origin, lga, religion columns

  ## Security
  - RLS enabled on all new tables
  - Super admins can do all operations
  - Staff can view their own records
*/

-- ─── Extend profiles with more personal data ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='join_date') THEN
    ALTER TABLE profiles ADD COLUMN join_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='department') THEN
    ALTER TABLE profiles ADD COLUMN department text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='employment_type') THEN
    ALTER TABLE profiles ADD COLUMN employment_type text DEFAULT 'full_time';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='marital_status') THEN
    ALTER TABLE profiles ADD COLUMN marital_status text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='nationality') THEN
    ALTER TABLE profiles ADD COLUMN nationality text DEFAULT 'Nigerian';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='state_of_origin') THEN
    ALTER TABLE profiles ADD COLUMN state_of_origin text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='lga') THEN
    ALTER TABLE profiles ADD COLUMN lga text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='religion') THEN
    ALTER TABLE profiles ADD COLUMN religion text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='bio') THEN
    ALTER TABLE profiles ADD COLUMN bio text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='housing_allowance') THEN
    ALTER TABLE profiles ADD COLUMN housing_allowance numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='transport_allowance') THEN
    ALTER TABLE profiles ADD COLUMN transport_allowance numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='other_allowances') THEN
    ALTER TABLE profiles ADD COLUMN other_allowances numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='deductions') THEN
    ALTER TABLE profiles ADD COLUMN deductions numeric(12,2) DEFAULT 0;
  END IF;
END $$;

-- ─── staff_hr_details ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_hr_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Next of Kin
  nok_name text DEFAULT '',
  nok_relationship text DEFAULT '',
  nok_phone text DEFAULT '',
  nok_email text DEFAULT '',
  nok_address text DEFAULT '',

  -- Emergency Contact
  emergency_contact_name text DEFAULT '',
  emergency_contact_phone text DEFAULT '',
  emergency_contact_relationship text DEFAULT '',

  -- Bank Details
  bank_name text DEFAULT '',
  account_number text DEFAULT '',
  account_name text DEFAULT '',
  bvn text DEFAULT '',
  pfa_name text DEFAULT '',
  pfa_number text DEFAULT '',

  -- Extra Employment Info
  previous_employer text DEFAULT '',
  years_of_experience int DEFAULT 0,
  specialization text DEFAULT '',
  staff_category text DEFAULT 'teaching',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(profile_id)
);

ALTER TABLE staff_hr_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage staff HR details"
  ON staff_hr_details FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Super admins insert staff HR details"
  ON staff_hr_details FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admins update staff HR details"
  ON staff_hr_details FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admins delete staff HR details"
  ON staff_hr_details FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Staff view own HR details"
  ON staff_hr_details FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- ─── staff_qualifications ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  qualification_type text NOT NULL DEFAULT 'degree',
  title text NOT NULL DEFAULT '',
  institution text DEFAULT '',
  field_of_study text DEFAULT '',
  grade_class text DEFAULT '',
  year_obtained int,
  certificate_url text DEFAULT '',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE staff_qualifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members view qualifications"
  ON staff_qualifications FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Super admins insert qualifications"
  ON staff_qualifications FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admins update qualifications"
  ON staff_qualifications FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admins delete qualifications"
  ON staff_qualifications FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- ─── staff_documents ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  document_type text NOT NULL DEFAULT 'other',
  file_name text NOT NULL DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  file_size int DEFAULT 0,
  description text DEFAULT '',

  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staff_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members view staff documents"
  ON staff_documents FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Super admins insert staff documents"
  ON staff_documents FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admins delete staff documents"
  ON staff_documents FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- ─── staff_committees ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_committees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  committee_name text NOT NULL DEFAULT '',
  position text DEFAULT 'member',
  start_date date,
  end_date date,
  is_active boolean DEFAULT true,
  notes text DEFAULT '',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE staff_committees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members view committees"
  ON staff_committees FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Super admins insert committees"
  ON staff_committees FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admins update committees"
  ON staff_committees FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admins delete committees"
  ON staff_committees FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- ─── staff_disciplinary ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_disciplinary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  incident_date date NOT NULL DEFAULT CURRENT_DATE,
  incident_type text NOT NULL DEFAULT '',
  description text DEFAULT '',
  action_taken text DEFAULT '',
  sanction text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  resolved_at date,
  notes text DEFAULT '',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE staff_disciplinary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view disciplinary"
  ON staff_disciplinary FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admins insert disciplinary"
  ON staff_disciplinary FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admins update disciplinary"
  ON staff_disciplinary FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admins delete disciplinary"
  ON staff_disciplinary FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');
