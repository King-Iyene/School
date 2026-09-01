/*
  # System Settings, Dormitory & Library Expansion

  ## New Tables

  ### System Settings
  - `system_settings` - Key-value store for all system configuration (general, email, SMS)
  - `holiday_calendar` - School holidays linked to academic year
  - `weekend_settings` - Per-school weekend day configuration

  ### Dormitory Expansion
  - `room_types` - Room type definitions (Single, Double, Dormitory, etc.)
  - `dormitory_buildings` - Buildings/hostels containing rooms

  ### Library Expansion
  - `book_categories` - Book classification categories
  - `library_members` - Student/staff library membership records

  ## Modified Tables
  - `dormitory_rooms` - Added room_type_id and building_id columns
  - `books` - Added category_id column

  ## Security
  - RLS enabled on all new tables
  - All policies check school ownership via get_my_school_id()
*/

-- System Settings (key-value per school)
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  setting_group text NOT NULL DEFAULT 'general',
  setting_key text NOT NULL,
  setting_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (school_id, setting_key)
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert settings"
  ON system_settings FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

CREATE POLICY "Admins can update settings"
  ON system_settings FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

CREATE POLICY "Admins can delete settings"
  ON system_settings FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

-- Holiday Calendar
CREATE TABLE IF NOT EXISTS holiday_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  name text NOT NULL,
  holiday_date date NOT NULL,
  end_date date,
  description text DEFAULT '',
  holiday_type text DEFAULT 'public',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE holiday_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view holidays"
  ON holiday_calendar FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert holidays"
  ON holiday_calendar FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

CREATE POLICY "Admins can update holidays"
  ON holiday_calendar FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

CREATE POLICY "Admins can delete holidays"
  ON holiday_calendar FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

-- Weekend Settings
CREATE TABLE IF NOT EXISTS weekend_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  created_at timestamptz DEFAULT now(),
  UNIQUE (school_id, day_of_week)
);

ALTER TABLE weekend_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view weekend settings"
  ON weekend_settings FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert weekend settings"
  ON weekend_settings FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

CREATE POLICY "Admins can delete weekend settings"
  ON weekend_settings FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

-- Room Types
CREATE TABLE IF NOT EXISTS room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  capacity integer DEFAULT 1,
  cost_per_term numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view room types"
  ON room_types FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert room types"
  ON room_types FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

CREATE POLICY "Admins can update room types"
  ON room_types FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

CREATE POLICY "Admins can delete room types"
  ON room_types FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

-- Dormitory Buildings
CREATE TABLE IF NOT EXISTS dormitory_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  gender text DEFAULT 'mixed' CHECK (gender IN ('male', 'female', 'mixed')),
  total_capacity integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dormitory_buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view dormitory buildings"
  ON dormitory_buildings FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert dormitory buildings"
  ON dormitory_buildings FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

CREATE POLICY "Admins can update dormitory buildings"
  ON dormitory_buildings FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

CREATE POLICY "Admins can delete dormitory buildings"
  ON dormitory_buildings FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

-- Add columns to dormitory_rooms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dormitory_rooms' AND column_name = 'room_type_id'
  ) THEN
    ALTER TABLE dormitory_rooms ADD COLUMN room_type_id uuid REFERENCES room_types(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dormitory_rooms' AND column_name = 'building_id'
  ) THEN
    ALTER TABLE dormitory_rooms ADD COLUMN building_id uuid REFERENCES dormitory_buildings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Book Categories
CREATE TABLE IF NOT EXISTS book_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE book_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view book categories"
  ON book_categories FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert book categories"
  ON book_categories FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

CREATE POLICY "Admins can update book categories"
  ON book_categories FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

CREATE POLICY "Admins can delete book categories"
  ON book_categories FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));

-- Add category_id to books
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE books ADD COLUMN category_id uuid REFERENCES book_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Library Members
CREATE TABLE IF NOT EXISTS library_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  member_type text DEFAULT 'student' CHECK (member_type IN ('student', 'staff')),
  membership_number text NOT NULL,
  join_date date DEFAULT CURRENT_DATE,
  expiry_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (school_id, membership_number)
);

ALTER TABLE library_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view library members"
  ON library_members FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert library members"
  ON library_members FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

CREATE POLICY "Admins can update library members"
  ON library_members FOR UPDATE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

CREATE POLICY "Admins can delete library members"
  ON library_members FOR DELETE
  TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin'));
