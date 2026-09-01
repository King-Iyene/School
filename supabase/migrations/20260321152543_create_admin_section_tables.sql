/*
  # Admin Section Tables

  ## New Tables
  1. `admin_setup` - Lookup categories (source, purpose, complaint_type, reference)
  2. `admission_queries` - Admission inquiry records
  3. `admission_followups` - Follow-up entries per admission query
  4. `visitors` - Daily visitor book entries
  5. `complaints` - Complaint records
  6. `postal_receives` - Incoming postal records
  7. `postal_dispatches` - Outgoing postal records
  8. `phone_call_logs` - Phone call log records
  9. `student_certificates` - Certificate templates
  10. `student_id_cards` - ID card templates

  ## Security
  - RLS on all tables, super_admin managed via get_my_role()
*/

-- Admin Setup (lookup categories)
CREATE TABLE IF NOT EXISTS admin_setup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('source', 'purpose', 'complaint_type', 'reference')),
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE admin_setup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view admin setup" ON admin_setup FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Admins can insert admin setup" ON admin_setup FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can update admin setup" ON admin_setup FOR UPDATE TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can delete admin setup" ON admin_setup FOR DELETE TO authenticated USING (get_my_role() = 'super_admin');

-- Admission Queries
CREATE TABLE IF NOT EXISTS admission_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  description text DEFAULT '',
  class_interested text DEFAULT '',
  source text DEFAULT '',
  reference text DEFAULT '',
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'converted', 'closed')),
  next_follow_up_date date,
  date date DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE admission_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view admission queries" ON admission_queries FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Admins can insert admission queries" ON admission_queries FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can update admission queries" ON admission_queries FOR UPDATE TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can delete admission queries" ON admission_queries FOR DELETE TO authenticated USING (get_my_role() = 'super_admin');

-- Admission Follow-ups
CREATE TABLE IF NOT EXISTS admission_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid NOT NULL REFERENCES admission_queries(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  follow_up_date date DEFAULT CURRENT_DATE,
  next_follow_up_date date,
  note text DEFAULT '',
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE admission_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view followups" ON admission_followups FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Admins can insert followups" ON admission_followups FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can delete followups" ON admission_followups FOR DELETE TO authenticated USING (get_my_role() = 'super_admin');

-- Visitor Book
CREATE TABLE IF NOT EXISTS visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  id_card_type text DEFAULT '' CHECK (id_card_type IN ('', 'national_id', 'passport', 'drivers_license', 'voters_card', 'other')),
  id_card_number text DEFAULT '',
  num_of_persons integer DEFAULT 1,
  purpose text DEFAULT '',
  meeting_with text DEFAULT '',
  department text DEFAULT '',
  date date DEFAULT CURRENT_DATE,
  in_time time,
  out_time time,
  note text DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view visitors" ON visitors FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Admins can insert visitors" ON visitors FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can update visitors" ON visitors FOR UPDATE TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can delete visitors" ON visitors FOR DELETE TO authenticated USING (get_my_role() = 'super_admin');

-- Complaints
CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  complainant_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  complaint_type text DEFAULT '',
  complaint_by text DEFAULT 'student' CHECK (complaint_by IN ('student', 'parent', 'teacher', 'staff', 'other')),
  source text DEFAULT '',
  description text NOT NULL DEFAULT '',
  action_taken text DEFAULT '',
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  date date DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view complaints" ON complaints FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Admins can insert complaints" ON complaints FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can update complaints" ON complaints FOR UPDATE TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can delete complaints" ON complaints FOR DELETE TO authenticated USING (get_my_role() = 'super_admin');

-- Postal Receive
CREATE TABLE IF NOT EXISTS postal_receives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  from_title text NOT NULL DEFAULT '',
  reference_no text DEFAULT '',
  address text DEFAULT '',
  note text DEFAULT '',
  to_title text DEFAULT '',
  date date DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE postal_receives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view postal receives" ON postal_receives FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Admins can insert postal receives" ON postal_receives FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can update postal receives" ON postal_receives FOR UPDATE TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can delete postal receives" ON postal_receives FOR DELETE TO authenticated USING (get_my_role() = 'super_admin');

-- Postal Dispatch
CREATE TABLE IF NOT EXISTS postal_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  to_title text NOT NULL DEFAULT '',
  reference_no text DEFAULT '',
  address text DEFAULT '',
  note text DEFAULT '',
  from_title text DEFAULT '',
  date date DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE postal_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view postal dispatches" ON postal_dispatches FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Admins can insert postal dispatches" ON postal_dispatches FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can update postal dispatches" ON postal_dispatches FOR UPDATE TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can delete postal dispatches" ON postal_dispatches FOR DELETE TO authenticated USING (get_my_role() = 'super_admin');

-- Phone Call Log
CREATE TABLE IF NOT EXISTS phone_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  call_type text DEFAULT 'incoming' CHECK (call_type IN ('incoming', 'outgoing')),
  call_duration text DEFAULT '',
  description text DEFAULT '',
  date date DEFAULT CURRENT_DATE,
  next_follow_up_date date,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE phone_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view call logs" ON phone_call_logs FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Admins can insert call logs" ON phone_call_logs FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can update call logs" ON phone_call_logs FOR UPDATE TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can delete call logs" ON phone_call_logs FOR DELETE TO authenticated USING (get_my_role() = 'super_admin');

-- Student Certificates
CREATE TABLE IF NOT EXISTS student_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  header_text text DEFAULT '',
  footer_text text DEFAULT '',
  background_image_url text DEFAULT '',
  title_font_size integer DEFAULT 24,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE student_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view certificates" ON student_certificates FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Admins can insert certificates" ON student_certificates FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can update certificates" ON student_certificates FOR UPDATE TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can delete certificates" ON student_certificates FOR DELETE TO authenticated USING (get_my_role() = 'super_admin');

-- Student ID Cards
CREATE TABLE IF NOT EXISTS student_id_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  logo_url text DEFAULT '',
  designation text DEFAULT '',
  signature_url text DEFAULT '',
  background_color text DEFAULT '#1e3a5f',
  accent_color text DEFAULT '#10b981',
  header_text text DEFAULT '',
  footer_text text DEFAULT '',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE student_id_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members can view id cards" ON student_id_cards FOR SELECT TO authenticated USING (school_id = get_my_school_id());
CREATE POLICY "Admins can insert id cards" ON student_id_cards FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can update id cards" ON student_id_cards FOR UPDATE TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "Admins can delete id cards" ON student_id_cards FOR DELETE TO authenticated USING (get_my_role() = 'super_admin');

-- Seed default admin setup values
DO $$
DECLARE v_school_id uuid;
BEGIN
  SELECT id INTO v_school_id FROM schools WHERE name = 'Okrika Grammar School' LIMIT 1;
  IF v_school_id IS NOT NULL THEN
    INSERT INTO admin_setup (school_id, type, name) VALUES
      (v_school_id, 'source', 'Walk-in'),
      (v_school_id, 'source', 'Phone Call'),
      (v_school_id, 'source', 'Social Media'),
      (v_school_id, 'source', 'Referral'),
      (v_school_id, 'source', 'School Website'),
      (v_school_id, 'purpose', 'Admission Inquiry'),
      (v_school_id, 'purpose', 'Fee Payment'),
      (v_school_id, 'purpose', 'Meeting'),
      (v_school_id, 'purpose', 'Complaint'),
      (v_school_id, 'purpose', 'Document Collection'),
      (v_school_id, 'complaint_type', 'Academic'),
      (v_school_id, 'complaint_type', 'Behavioral'),
      (v_school_id, 'complaint_type', 'Infrastructure'),
      (v_school_id, 'complaint_type', 'Staff'),
      (v_school_id, 'complaint_type', 'Other'),
      (v_school_id, 'reference', 'Parent'),
      (v_school_id, 'reference', 'Alumnus'),
      (v_school_id, 'reference', 'Teacher'),
      (v_school_id, 'reference', 'Online')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
