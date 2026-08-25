/*
  # Report Card Comments & Class Term Settings

  Adds two tables to support staff comments, signatures, fees and academic
  calendar values that appear on a student's printed term report.

  1. New Tables
    - `report_card_comments`
      - Per (student_id, term_id, academic_year_id)
      - `social_behaviour_remark` text - editable by class/form teacher
      - `form_teacher_comment` text + `form_teacher_signed_by` uuid + `form_teacher_signed_at`
      - `principal_comment` text + `principal_signed_by` uuid + `principal_signed_at`
      - `outstanding_fees_override` numeric (optional override; otherwise
        outstanding is derived from the finance module)

    - `class_term_settings`
      - Per (class_id, term_id, academic_year_id)
      - `next_term_fees` numeric
      - `other_fees` numeric
      - `next_term_begins` date
      - `vacation_date` date

  2. Security
    - RLS enabled on both tables
    - Comments table:
        - SELECT: school members
        - INSERT/UPDATE: super_admin, principal, or the class_teacher of the
          student's class (form teacher). Principal-only fields cannot be
          edited by form teachers (enforced application-side; DB allows
          principal/super_admin to update principal_* fields freely)
    - Class term settings:
        - SELECT: school members
        - INSERT/UPDATE/DELETE: super_admin, principal, accountant
*/

CREATE TABLE IF NOT EXISTS report_card_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  social_behaviour_remark text DEFAULT '',
  form_teacher_comment text DEFAULT '',
  form_teacher_signed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  form_teacher_signed_at timestamptz,
  principal_comment text DEFAULT '',
  principal_signed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  principal_signed_at timestamptz,
  outstanding_fees_override numeric(12,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, term_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_report_card_comments_student
  ON report_card_comments(student_id, term_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_report_card_comments_class
  ON report_card_comments(class_id, term_id, academic_year_id);

ALTER TABLE report_card_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view report card comments"
  ON report_card_comments FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Authorized staff can insert report card comments"
  ON report_card_comments FOR INSERT TO authenticated
  WITH CHECK (
    school_id = get_my_school_id() AND (
      get_my_role() IN ('super_admin', 'principal')
      OR EXISTS (
        SELECT 1 FROM classes c
        WHERE c.id = report_card_comments.class_id
          AND c.class_teacher_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Authorized staff can update report card comments"
  ON report_card_comments FOR UPDATE TO authenticated
  USING (
    school_id = get_my_school_id() AND (
      get_my_role() IN ('super_admin', 'principal')
      OR EXISTS (
        SELECT 1 FROM classes c
        WHERE c.id = report_card_comments.class_id
          AND c.class_teacher_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    school_id = get_my_school_id() AND (
      get_my_role() IN ('super_admin', 'principal')
      OR EXISTS (
        SELECT 1 FROM classes c
        WHERE c.id = report_card_comments.class_id
          AND c.class_teacher_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Super admin and principal can delete report card comments"
  ON report_card_comments FOR DELETE TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() IN ('super_admin', 'principal')
  );


CREATE TABLE IF NOT EXISTS class_term_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  next_term_fees numeric(12,2) DEFAULT 0,
  other_fees numeric(12,2) DEFAULT 0,
  next_term_begins date,
  vacation_date date,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(class_id, term_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_class_term_settings_lookup
  ON class_term_settings(class_id, term_id, academic_year_id);

ALTER TABLE class_term_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view class term settings"
  ON class_term_settings FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());

CREATE POLICY "Admins can insert class term settings"
  ON class_term_settings FOR INSERT TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() IN ('super_admin', 'principal', 'accountant')
  );

CREATE POLICY "Admins can update class term settings"
  ON class_term_settings FOR UPDATE TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() IN ('super_admin', 'principal', 'accountant')
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() IN ('super_admin', 'principal', 'accountant')
  );

CREATE POLICY "Admins can delete class term settings"
  ON class_term_settings FOR DELETE TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() IN ('super_admin', 'principal', 'accountant')
  );
