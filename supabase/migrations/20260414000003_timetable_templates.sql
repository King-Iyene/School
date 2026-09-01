-- Timetable Templates tables
CREATE TABLE IF NOT EXISTS timetable_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS timetable_template_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES timetable_templates(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  room text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE timetable_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_template_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view templates"
  ON timetable_templates FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can manage templates"
  ON timetable_templates FOR ALL TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "School members can view template entries"
  ON timetable_template_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM timetable_templates WHERE id = template_id AND school_id = get_my_school_id()));

CREATE POLICY "Admins can manage template entries"
  ON timetable_template_entries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM timetable_templates WHERE id = template_id AND school_id = get_my_school_id()));
