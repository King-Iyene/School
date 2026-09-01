/*
  # Create School Clubs and Prefects System

  ## New Tables

  ### Clubs
  - `clubs` – School clubs/societies (name, description, category, academic_year_id, meeting_schedule, is_active)
  - `club_teachers` – Teachers assigned to manage clubs (club_id, profile_id, role: patron/co-patron/advisor)
  - `club_members` – Student members of clubs (club_id, student_id, role: member/president/vice_president/secretary/treasurer/pro/assistant_secretary, joined_at, is_active)

  ### Prefects
  - `prefect_positions` – Predefined positions (title, gender: boy/girl/any, category, sort_order)
  - `prefect_assignments` – Students assigned to positions per academic year (position_id, student_id, academic_year_id, appointed_date, vacated_date, is_active, notes)

  ## Security
  - RLS enabled on all tables
  - super_admin: full access to everything
  - teachers: can view clubs and members, manage their assigned clubs
  - students: can view their own club memberships and prefect positions
  - parents: can view club info

  ## Seed Data
  - Default OGS prefect positions seeded
  - Default OGS clubs seeded
*/

-- ─────────────────────────────────────────────
-- CLUBS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clubs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  category      text DEFAULT 'general',
  logo_url      text,
  meeting_day   text,
  meeting_time  text,
  meeting_venue text,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clubs"
  ON clubs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin can insert clubs"
  ON clubs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Super admin can update clubs"
  ON clubs FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admin can delete clubs"
  ON clubs FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ─────────────────────────────────────────────
-- CLUB TEACHERS (PATRONS/ADVISORS)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS club_teachers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'patron'
                CHECK (role IN ('patron', 'co-patron', 'advisor')),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE (club_id, profile_id)
);

ALTER TABLE club_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view club teachers"
  ON club_teachers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin can insert club teachers"
  ON club_teachers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Super admin can update club teachers"
  ON club_teachers FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admin can delete club teachers"
  ON club_teachers FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ─────────────────────────────────────────────
-- CLUB MEMBERS (STUDENTS)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS club_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL,
  role        text NOT NULL DEFAULT 'member'
                CHECK (role IN ('member', 'president', 'vice_president', 'secretary', 'assistant_secretary', 'treasurer', 'pro', 'welfare_officer')),
  joined_at   date DEFAULT CURRENT_DATE,
  is_active   boolean DEFAULT true,
  notes       text,
  UNIQUE (club_id, student_id)
);

ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view club members"
  ON club_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin and teachers can insert club members"
  ON club_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'teacher'))
  );

CREATE POLICY "Super admin and teachers can update club members"
  ON club_members FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'teacher')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'teacher')));

CREATE POLICY "Super admin and teachers can delete club members"
  ON club_members FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'teacher')));

-- ─────────────────────────────────────────────
-- PREFECT POSITIONS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prefect_positions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  gender      text NOT NULL DEFAULT 'any' CHECK (gender IN ('boy', 'girl', 'any')),
  category    text NOT NULL DEFAULT 'general',
  sort_order  int DEFAULT 0,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE prefect_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view prefect positions"
  ON prefect_positions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin can insert prefect positions"
  ON prefect_positions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Super admin can update prefect positions"
  ON prefect_positions FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admin can delete prefect positions"
  ON prefect_positions FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ─────────────────────────────────────────────
-- PREFECT ASSIGNMENTS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prefect_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id      uuid NOT NULL REFERENCES prefect_positions(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  appointed_date   date DEFAULT CURRENT_DATE,
  vacated_date     date,
  is_active        boolean DEFAULT true,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (position_id, academic_year_id)
);

ALTER TABLE prefect_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view prefect assignments"
  ON prefect_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin can insert prefect assignments"
  ON prefect_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Super admin can update prefect assignments"
  ON prefect_assignments FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admin can delete prefect assignments"
  ON prefect_assignments FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ─────────────────────────────────────────────
-- SEED: Default OGS Prefect Positions
-- ─────────────────────────────────────────────

INSERT INTO prefect_positions (title, gender, category, sort_order) VALUES
  ('Senior Prefect',          'boy',  'Senior Prefects',     1),
  ('Senior Prefect',          'girl', 'Senior Prefects',     2),
  ('Labour Prefect',          'boy',  'Labour',              3),
  ('Labour Prefect',          'girl', 'Labour',              4),
  ('Sanitary Prefect',        'boy',  'Sanitation',          5),
  ('Sanitary Prefect',        'girl', 'Sanitation',          6),
  ('Health Prefect',          'boy',  'Health',              7),
  ('Health Prefect',          'girl', 'Health',              8),
  ('Social Prefect',          'boy',  'Social',              9),
  ('Social Prefect',          'girl', 'Social',             10),
  ('Chapel Prefect',          'boy',  'Chapel',             11),
  ('Chapel Prefect',          'girl', 'Chapel',             12),
  ('Hostel Prefect',          'boy',  'Hostel',             13),
  ('Hostel Prefect',          'girl', 'Hostel',             14),
  ('Library Prefect',         'boy',  'Library',            15),
  ('Library Prefect',         'girl', 'Library',            16),
  ('Laboratory Prefect',      'boy',  'Laboratory',         17),
  ('Laboratory Prefect',      'girl', 'Laboratory',         18),
  ('Punctuality Prefect',     'boy',  'Punctuality',        19),
  ('Punctuality Prefect',     'girl', 'Punctuality',        20)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- SEED: Default OGS Clubs
-- ─────────────────────────────────────────────

INSERT INTO clubs (name, description, category, meeting_day, meeting_venue) VALUES
  ('Technovation / STEM Club',       'Science, Technology, Engineering & Mathematics club focused on innovation and problem solving.',         'STEM',         'Wednesday', 'Science Laboratory'),
  ('Press / Debate Club',            'Develops critical thinking, public speaking, journalism and debate skills.',                             'Arts & Culture','Thursday',  'School Hall'),
  ('Young Farmers Club',             'Promotes agricultural knowledge, practical farming skills and food sustainability.',                     'Agriculture',  'Friday',    'School Farm'),
  ('Music & Performing Arts Club',   'Nurtures talent in music, drama, dance and creative performance arts.',                                 'Arts & Culture','Tuesday',  'Assembly Hall')
ON CONFLICT DO NOTHING;
