/*
  # Triggers, Functions, and Seed Data

  ## Changes
  1. Auto-create profile trigger on auth.users insert
  2. Grade calculation function
  3. Seed initial data for Okrika Grammar School
     - Default subjects
     - Sample classes
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION calculate_grade(total numeric)
RETURNS text AS $$
BEGIN
  IF total >= 75 THEN RETURN 'A1';
  ELSIF total >= 70 THEN RETURN 'B2';
  ELSIF total >= 65 THEN RETURN 'B3';
  ELSIF total >= 60 THEN RETURN 'C4';
  ELSIF total >= 55 THEN RETURN 'C5';
  ELSIF total >= 50 THEN RETURN 'C6';
  ELSIF total >= 45 THEN RETURN 'D7';
  ELSIF total >= 40 THEN RETURN 'E8';
  ELSE RETURN 'F9';
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  school_id_var uuid;
  year_id_var uuid;
  term_id_var uuid;
BEGIN
  SELECT id INTO school_id_var FROM schools WHERE name = 'Okrika Grammar School' LIMIT 1;

  IF school_id_var IS NOT NULL THEN
    INSERT INTO academic_years (school_id, name, start_date, end_date, is_current)
    VALUES (school_id_var, '2024/2025', '2024-09-01', '2025-07-31', true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO year_id_var;

    IF year_id_var IS NULL THEN
      SELECT id INTO year_id_var FROM academic_years WHERE school_id = school_id_var AND name = '2024/2025' LIMIT 1;
    END IF;

    IF year_id_var IS NOT NULL THEN
      INSERT INTO terms (academic_year_id, school_id, name, start_date, end_date, is_current)
      VALUES
        (year_id_var, school_id_var, 'First Term', '2024-09-09', '2024-12-20', false),
        (year_id_var, school_id_var, 'Second Term', '2025-01-13', '2025-04-11', true),
        (year_id_var, school_id_var, 'Third Term', '2025-04-28', '2025-07-25', false)
      ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO subjects (school_id, name, code, category)
    VALUES
      (school_id_var, 'English Language', 'ENG', 'core'),
      (school_id_var, 'Mathematics', 'MATH', 'core'),
      (school_id_var, 'Biology', 'BIO', 'core'),
      (school_id_var, 'Chemistry', 'CHEM', 'core'),
      (school_id_var, 'Physics', 'PHY', 'core'),
      (school_id_var, 'Further Mathematics', 'F-MATH', 'elective'),
      (school_id_var, 'Agricultural Science', 'AGRIC', 'core'),
      (school_id_var, 'Civic Education', 'CIV', 'core'),
      (school_id_var, 'Economics', 'ECON', 'elective'),
      (school_id_var, 'Government', 'GOVT', 'elective'),
      (school_id_var, 'Literature in English', 'LIT', 'elective'),
      (school_id_var, 'Geography', 'GEO', 'elective'),
      (school_id_var, 'Commerce', 'COM', 'elective'),
      (school_id_var, 'Accounts', 'ACC', 'elective'),
      (school_id_var, 'Computer Science', 'COMP', 'core'),
      (school_id_var, 'Physical Education', 'P.E', 'core'),
      (school_id_var, 'Christian Religious Studies', 'CRS', 'core'),
      (school_id_var, 'Islamic Religious Studies', 'IRS', 'elective'),
      (school_id_var, 'Fine Arts', 'ART', 'elective'),
      (school_id_var, 'Music', 'MUS', 'elective')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
