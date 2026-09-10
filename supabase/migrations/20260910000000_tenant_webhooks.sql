/*
  # Outbound webhooks for tenant integrations

  Lets a school register its own HTTPS endpoints and get notified (signed,
  outbound POSTs) when things happen in their account — a new admission, a
  fee payment, a graded online exam — so they can wire the portal into
  Zapier, a custom dashboard, or another system of their own.

  1. New Tables
    - `tenant_webhooks` — one row per endpoint a school has registered:
      url, which event types it's subscribed to, and an HMAC signing
      secret (generated server-side, shown to the admin once).
    - `tenant_webhook_outbox` — an internal, service-role-only queue.
      Triggers on the tables below INSERT a row here the instant a
      qualifying event happens; nothing else writes or reads it directly.
    - `tenant_webhook_deliveries` — a per-endpoint delivery log (status
      code, truncated response body, success) so an admin can see what
      was sent and retry a failed delivery.

  2. Event sources (v1)
    - `online_exam.graded` — an online_exam_attempts row finishes grading.
    - `fee.payment.recorded` — a new row lands in fee_payments (the live
      write path per FeePayments.tsx; the older fees_collections table is
      legacy/display-only and is not a trigger source).
    - `student.admitted` — a prospective_students row's status flips to
      'admitted' (the stable trailing marker of a completed admission,
      per ProspectiveStudents.tsx, even though the full status enum has
      drifted across several earlier migrations).

  3. Security
    - `tenant_webhooks` is managed by super_admin/admin only (same bar as
      custom-domain connection) — it's account-level integration config,
      not a day-to-day staff task.
    - `tenant_webhook_outbox` has RLS enabled with no policies at all, so
      it's reachable only via the service-role client in api-server —
      never directly from the browser, by any role.
    - `tenant_webhook_deliveries` is staff-readable (for the log UI) but
      only ever written by the service-role dispatcher.
*/

-- ── tenant_webhooks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  url text NOT NULL,
  description text DEFAULT '',
  events text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_webhooks_school ON tenant_webhooks(school_id);

ALTER TABLE tenant_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tw_select_admin"
  ON tenant_webhooks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.school_id = tenant_webhooks.school_id
        AND p.role IN ('super_admin','admin')
    )
  );

CREATE POLICY "tw_insert_admin"
  ON tenant_webhooks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.school_id = tenant_webhooks.school_id
        AND p.role IN ('super_admin','admin')
    )
  );

CREATE POLICY "tw_update_admin"
  ON tenant_webhooks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.school_id = tenant_webhooks.school_id
        AND p.role IN ('super_admin','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.school_id = tenant_webhooks.school_id
        AND p.role IN ('super_admin','admin')
    )
  );

CREATE POLICY "tw_delete_admin"
  ON tenant_webhooks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.school_id = tenant_webhooks.school_id
        AND p.role IN ('super_admin','admin')
    )
  );

-- ── tenant_webhook_outbox (service-role only — no policies) ─────────────────
CREATE TABLE IF NOT EXISTS tenant_webhook_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  dispatched_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_tw_outbox_pending ON tenant_webhook_outbox(created_at) WHERE dispatched_at IS NULL;

ALTER TABLE tenant_webhook_outbox ENABLE ROW LEVEL SECURITY;

-- ── tenant_webhook_deliveries ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES tenant_webhooks(id) ON DELETE CASCADE,
  outbox_id uuid REFERENCES tenant_webhook_outbox(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  response_status integer,
  response_body text DEFAULT '',
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tw_deliveries_webhook ON tenant_webhook_deliveries(webhook_id, created_at DESC);

ALTER TABLE tenant_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "twd_select_admin"
  ON tenant_webhook_deliveries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_webhooks w
      JOIN profiles p ON p.id = auth.uid() AND p.school_id = w.school_id
      WHERE w.id = tenant_webhook_deliveries.webhook_id
        AND p.role IN ('super_admin','admin')
    )
  );

-- ── Event source triggers ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enqueue_online_exam_graded_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'graded' AND (OLD.status IS DISTINCT FROM 'graded') THEN
    INSERT INTO tenant_webhook_outbox (school_id, event_type, payload)
    VALUES (
      NEW.school_id,
      'online_exam.graded',
      jsonb_build_object(
        'attempt_id', NEW.id,
        'exam_id', NEW.exam_id,
        'student_id', NEW.student_id,
        'score', NEW.score,
        'total_marks', NEW.total_marks
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_online_exam_graded_webhook ON online_exam_attempts;
CREATE TRIGGER trg_enqueue_online_exam_graded_webhook
  AFTER UPDATE OF status ON online_exam_attempts
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_online_exam_graded_webhook();

CREATE OR REPLACE FUNCTION enqueue_fee_payment_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO tenant_webhook_outbox (school_id, event_type, payload)
  VALUES (
    NEW.school_id,
    'fee.payment.recorded',
    jsonb_build_object(
      'payment_id', NEW.id,
      'student_id', NEW.student_id,
      'amount_paid', NEW.amount_paid,
      'status', NEW.status,
      'payment_date', NEW.payment_date
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_fee_payment_webhook ON fee_payments;
CREATE TRIGGER trg_enqueue_fee_payment_webhook
  AFTER INSERT ON fee_payments
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_fee_payment_webhook();

CREATE OR REPLACE FUNCTION enqueue_student_admitted_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'admitted' AND (OLD.status IS DISTINCT FROM 'admitted') THEN
    INSERT INTO tenant_webhook_outbox (school_id, event_type, payload)
    VALUES (
      NEW.school_id,
      'student.admitted',
      jsonb_build_object('application_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_student_admitted_webhook ON prospective_students;
CREATE TRIGGER trg_enqueue_student_admitted_webhook
  AFTER UPDATE OF status ON prospective_students
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_student_admitted_webhook();

NOTIFY pgrst, 'reload schema';
