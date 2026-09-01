/*
  # Update Current Academic Year to 2025/2026

  ## Changes
  - Unmarks 2024/2025 as the current academic year
  - Inserts 2025/2026 academic year (Sept 2025 – July 2026) as the new current year
  - Also adds associated terms for the new academic year

  ## Notes
  - Uses the school_id from the existing 2024/2025 year record so no hardcoded IDs needed
  - Safe to run even if 2025/2026 already exists (uses ON CONFLICT DO NOTHING)
*/

DO $$
DECLARE
  v_school_id uuid;
  v_new_year_id uuid;
BEGIN
  -- Get the school_id from existing academic year
  SELECT school_id INTO v_school_id FROM academic_years LIMIT 1;

  IF v_school_id IS NOT NULL THEN
    -- Mark all existing years as not current
    UPDATE academic_years SET is_current = false WHERE school_id = v_school_id;

    -- Insert 2025/2026 if it doesn't exist
    INSERT INTO academic_years (school_id, name, start_date, end_date, is_current)
    VALUES (v_school_id, '2025/2026', '2025-09-01', '2026-07-31', true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_new_year_id;

    -- If already existed, find it and mark current
    IF v_new_year_id IS NULL THEN
      SELECT id INTO v_new_year_id FROM academic_years 
      WHERE school_id = v_school_id AND name = '2025/2026';
      UPDATE academic_years SET is_current = true WHERE id = v_new_year_id;
    END IF;

    -- Add terms for 2025/2026 if the year was just created
    IF v_new_year_id IS NOT NULL THEN
      -- Mark all existing terms as not current
      UPDATE terms SET is_current = false WHERE school_id = v_school_id;

      -- Insert First Term
      INSERT INTO terms (school_id, academic_year_id, name, start_date, end_date, is_current)
      VALUES (v_school_id, v_new_year_id, 'First Term', '2025-09-08', '2025-12-19', true)
      ON CONFLICT DO NOTHING;

      -- Insert Second Term
      INSERT INTO terms (school_id, academic_year_id, name, start_date, end_date, is_current)
      VALUES (v_school_id, v_new_year_id, 'Second Term', '2026-01-12', '2026-04-03', false)
      ON CONFLICT DO NOTHING;

      -- Insert Third Term
      INSERT INTO terms (school_id, academic_year_id, name, start_date, end_date, is_current)
      VALUES (v_school_id, v_new_year_id, 'Third Term', '2026-04-27', '2026-07-24', false)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
