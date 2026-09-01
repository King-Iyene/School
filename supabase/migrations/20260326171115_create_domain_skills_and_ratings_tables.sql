/*
  # Create Domain Skills and Ratings Tables

  ## Summary
  Adds support for rating students in Affective Domain (behaviours like attentiveness,
  honesty, neatness, etc.) and Psychomotor Domain (practical skills like creativity,
  dancing, music, etc.) using a 1–5 scale (Fair, Normal, Good, Very Good, Excellent).

  ## New Tables

  ### domain_skill_definitions
  Stores the list of skills/behaviours for each domain.
  - `id` (uuid, PK)
  - `school_id` (uuid, FK schools)
  - `domain` (text) - 'affective' or 'psychomotor'
  - `name` (text) - e.g. 'Attentiveness', 'Creativity'
  - `sort_order` (integer)
  - `is_active` (boolean)
  - `created_at`, `updated_at`

  ### student_domain_ratings
  Stores per-student per-skill ratings per term/exam period.
  - `id` (uuid, PK)
  - `school_id` (uuid, FK schools)
  - `student_id` (uuid, FK profiles)
  - `class_id` (uuid, FK classes)
  - `skill_id` (uuid, FK domain_skill_definitions)
  - `academic_year_id` (uuid, FK academic_years)
  - `term_id` (uuid, FK terms, nullable)
  - `rating` (integer 1-5)
  - `rated_by` (uuid, FK profiles)
  - `created_at`, `updated_at`

  ## Security
  - RLS enabled on both tables
  - All school members can read
  - Super admin and teacher can manage
*/

-- Domain Skill Definitions
CREATE TABLE IF NOT EXISTS domain_skill_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  domain text NOT NULL CHECK (domain IN ('affective', 'psychomotor')),
  name text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE domain_skill_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view domain skills"
  ON domain_skill_definitions FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Super admin can insert domain skills"
  ON domain_skill_definitions FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admin can update domain skills"
  ON domain_skill_definitions FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin')
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

CREATE POLICY "Super admin can delete domain skills"
  ON domain_skill_definitions FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Student Domain Ratings
CREATE TABLE IF NOT EXISTS student_domain_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  skill_id uuid REFERENCES domain_skill_definitions(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE CASCADE,
  term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  rated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, skill_id, academic_year_id, term_id)
);

ALTER TABLE student_domain_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view domain ratings"
  ON student_domain_ratings FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Super admin and teacher can insert domain ratings"
  ON student_domain_ratings FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

CREATE POLICY "Super admin and teacher can update domain ratings"
  ON student_domain_ratings FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'))
  WITH CHECK (school_id = get_my_school_id() AND get_my_role() IN ('super_admin', 'teacher'));

CREATE POLICY "Super admin can delete domain ratings"
  ON student_domain_ratings FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND get_my_role() = 'super_admin');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_domain_skills_school_domain ON domain_skill_definitions(school_id, domain);
CREATE INDEX IF NOT EXISTS idx_domain_ratings_student ON student_domain_ratings(student_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_domain_ratings_class ON student_domain_ratings(class_id, academic_year_id);

-- Seed default affective domain skills for existing schools
DO $$
DECLARE v_school_id uuid;
BEGIN
  SELECT id INTO v_school_id FROM schools LIMIT 1;
  IF v_school_id IS NOT NULL THEN
    INSERT INTO domain_skill_definitions (school_id, domain, name, sort_order) VALUES
      (v_school_id, 'affective', 'Attentiveness', 1),
      (v_school_id, 'affective', 'Honesty', 2),
      (v_school_id, 'affective', 'Neatness', 3),
      (v_school_id, 'affective', 'Perseverance', 4),
      (v_school_id, 'affective', 'Politeness', 5),
      (v_school_id, 'affective', 'Punctuality', 6),
      (v_school_id, 'affective', 'Reliability', 7),
      (v_school_id, 'affective', 'Self-control', 8),
      (v_school_id, 'affective', 'Cooperation', 9),
      (v_school_id, 'psychomotor', 'Content Writing', 1),
      (v_school_id, 'psychomotor', 'Creativity', 2),
      (v_school_id, 'psychomotor', 'Religious Norms', 3),
      (v_school_id, 'psychomotor', 'Dancing', 4),
      (v_school_id, 'psychomotor', 'Music', 5),
      (v_school_id, 'psychomotor', 'Indoor Games', 6),
      (v_school_id, 'psychomotor', 'Outdoor Games', 7)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
