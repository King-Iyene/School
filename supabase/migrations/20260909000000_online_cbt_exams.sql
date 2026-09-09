/*
  # Online / CBT exam-taking

  Adds the tables needed for student-facing timed computer-based exams built
  on top of the existing `exams` (type='online') and `question_bank` tables.

  1. New Tables
    - `online_exam_settings` — one row per online exam (exams.id), holding
      CBT-specific config: how many questions to randomly draw from the bank,
      duration, pass mark, shuffle/publish flags.
    - `online_exam_attempts` — one row per student attempt at an online exam.
      `student_id` references `students(id)`, which is kept equal to the
      student's own `auth.uid()`/`profiles.id` for students with a portal
      login (see 20260401000003_unify_student_logins.sql), so RLS can match
      it directly against `auth.uid()`.
    - `online_exam_attempt_questions` — the specific questions drawn for one
      attempt, with the student's answer and (once graded) the marks
      awarded. Marks and option order are snapshotted at draw time so later
      edits to the question bank don't retroactively change a past attempt.

  2. Security
    - All writes to attempts/attempt_questions for students go through the
      api-server (using the service role), which is the only place allowed
      to see `question_bank.correct_answer` while an exam is in progress.
      Students get read-only RLS access to their own attempt rows.
    - Tightens `question_bank` SELECT to staff roles only — it previously
      allowed every authenticated school member (including students) to
      read `correct_answer` directly, which would have made the exam
      trivially defeatable via the network tab.
    - Staff (super_admin/admin/principal/teacher) can read/manage settings
      and grade theory answers directly, matching how question_bank access
      already works for them.

  3. Grading
    - A trigger recomputes the parent attempt's theory/objective/total score
      and flips status to 'graded' once every question in the attempt has a
      non-null `marks_awarded` — fires when staff grade a theory answer.
*/

-- ── Tighten question_bank access ────────────────────────────────────────────
DROP POLICY IF EXISTS "School members can view question bank" ON question_bank;
CREATE POLICY "Staff can view question bank"
  ON question_bank FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() IN ('super_admin', 'admin', 'principal', 'teacher')
  );

-- ── online_exam_settings ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS online_exam_settings (
  exam_id uuid PRIMARY KEY REFERENCES exams(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  difficulty text CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_count integer NOT NULL DEFAULT 20 CHECK (question_count > 0),
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  pass_percentage numeric(5,2) NOT NULL DEFAULT 40,
  shuffle_questions boolean NOT NULL DEFAULT true,
  shuffle_options boolean NOT NULL DEFAULT true,
  show_result_immediately boolean NOT NULL DEFAULT true,
  instructions text DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE online_exam_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oes_select_school_members"
  ON online_exam_settings FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.school_id = online_exam_settings.school_id)
  );

CREATE POLICY "oes_insert_staff"
  ON online_exam_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.school_id = online_exam_settings.school_id
        AND p.role IN ('super_admin','admin','principal','teacher')
    )
  );

CREATE POLICY "oes_update_staff"
  ON online_exam_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.school_id = online_exam_settings.school_id
        AND p.role IN ('super_admin','admin','principal','teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.school_id = online_exam_settings.school_id
        AND p.role IN ('super_admin','admin','principal','teacher')
    )
  );

CREATE POLICY "oes_delete_staff"
  ON online_exam_settings FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.school_id = online_exam_settings.school_id
        AND p.role IN ('super_admin','admin','principal','teacher')
    )
  );

-- ── online_exam_attempts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS online_exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  duration_minutes integer NOT NULL,
  total_marks numeric(8,2) NOT NULL DEFAULT 0,
  objective_score numeric(8,2) NOT NULL DEFAULT 0,
  theory_score numeric(8,2),
  score numeric(8,2),
  time_taken_seconds integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_online_exam_attempts_exam ON online_exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_online_exam_attempts_student ON online_exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_online_exam_attempts_school ON online_exam_attempts(school_id);

ALTER TABLE online_exam_attempts ENABLE ROW LEVEL SECURITY;

-- Students only ever read their own attempts (auth.uid() = students.id for
-- portal logins, see the migration note above). All writes happen through
-- the api-server's service-role client, which enforces publish/window/
-- single-attempt rules before inserting/updating these rows.
CREATE POLICY "oea_select_own_or_staff"
  ON online_exam_attempts FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.school_id = online_exam_attempts.school_id
        AND p.role IN ('super_admin','admin','principal','teacher')
    )
  );

-- ── online_exam_attempt_questions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS online_exam_attempt_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES online_exam_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  question_type text NOT NULL CHECK (question_type IN ('objective', 'theory')),
  option_order jsonb NOT NULL DEFAULT '[]',
  marks numeric(6,2) NOT NULL DEFAULT 1,
  student_answer text DEFAULT '',
  is_correct boolean,
  marks_awarded numeric(6,2),
  answered_at timestamptz,
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_oeaq_attempt ON online_exam_attempt_questions(attempt_id);

ALTER TABLE online_exam_attempt_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oeaq_select_own_or_staff"
  ON online_exam_attempt_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM online_exam_attempts a
      WHERE a.id = online_exam_attempt_questions.attempt_id
        AND (
          a.student_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.school_id = a.school_id
              AND p.role IN ('super_admin','admin','principal','teacher')
          )
        )
    )
  );

-- Staff grade theory answers directly (marks_awarded/is_correct only —
-- everything else about the row is fixed at draw time).
CREATE POLICY "oeaq_update_staff_grading"
  ON online_exam_attempt_questions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM online_exam_attempts a
      JOIN profiles p ON p.id = auth.uid() AND p.school_id = a.school_id
      WHERE a.id = online_exam_attempt_questions.attempt_id
        AND p.role IN ('super_admin','admin','principal','teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM online_exam_attempts a
      JOIN profiles p ON p.id = auth.uid() AND p.school_id = a.school_id
      WHERE a.id = online_exam_attempt_questions.attempt_id
        AND p.role IN ('super_admin','admin','principal','teacher')
    )
  );

-- ── Recompute attempt score/status when theory grading lands ───────────────
CREATE OR REPLACE FUNCTION recompute_online_exam_attempt_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_id uuid := COALESCE(NEW.attempt_id, OLD.attempt_id);
  v_total numeric(8,2);
  v_objective numeric(8,2);
  v_theory numeric(8,2);
  v_ungraded_theory integer;
BEGIN
  SELECT
    COALESCE(SUM(marks_awarded) FILTER (WHERE question_type = 'objective'), 0),
    COALESCE(SUM(marks_awarded) FILTER (WHERE question_type = 'theory'), 0),
    COUNT(*) FILTER (WHERE question_type = 'theory' AND marks_awarded IS NULL)
  INTO v_objective, v_theory, v_ungraded_theory
  FROM online_exam_attempt_questions
  WHERE attempt_id = v_attempt_id;

  v_total := v_objective + v_theory;

  UPDATE online_exam_attempts
  SET objective_score = v_objective,
      theory_score = v_theory,
      score = v_total,
      status = CASE WHEN v_ungraded_theory = 0 THEN 'graded' ELSE status END,
      updated_at = now()
  WHERE id = v_attempt_id AND status IN ('submitted', 'graded');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_online_exam_attempt_score ON online_exam_attempt_questions;
CREATE TRIGGER trg_recompute_online_exam_attempt_score
  AFTER UPDATE OF marks_awarded ON online_exam_attempt_questions
  FOR EACH ROW
  EXECUTE FUNCTION recompute_online_exam_attempt_score();

NOTIFY pgrst, 'reload schema';
