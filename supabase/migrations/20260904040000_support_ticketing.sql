/*
  # Support / helpdesk ticketing

  1. New Tables
    - support_tickets: a tenant's admin-raised support request to the SaaS
      platform team. Scoped by school_id like every other tenant table;
      the platform owner (saas-admin) can see and triage tickets across
      every tenant.
    - support_ticket_messages: the back-and-forth thread on one ticket —
      either side (tenant admin or platform owner) can post a reply.

  2. Columns
    - support_tickets: id, school_id, created_by, subject, category,
      priority, status, created_at, updated_at
    - support_ticket_messages: id, ticket_id, author_id, is_platform_reply,
      message, created_at

  3. Security
    - RLS enabled on both tables
    - A tenant's admin-type staff (super_admin/admin/principal) can create
      and read their own school's tickets and post replies on them
    - The platform owner (is_platform_owner_user()) can read/update/reply
      to every tenant's tickets, for triage in /saas-admin
*/

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('billing', 'technical', 'feature_request', 'general')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_school ON support_tickets(school_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_platform_reply boolean NOT NULL DEFAULT false,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- support_tickets: tenant admins see/manage their own school's tickets;
-- the platform owner sees/manages every tenant's tickets for triage.
CREATE POLICY "support_tickets_select"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (
    public.is_platform_owner_user()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.school_id = support_tickets.school_id
    )
  );

CREATE POLICY "support_tickets_insert"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.school_id = support_tickets.school_id
        AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

CREATE POLICY "support_tickets_update"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_owner_user()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.school_id = support_tickets.school_id
        AND p.role IN ('super_admin', 'admin', 'principal')
    )
  )
  WITH CHECK (
    public.is_platform_owner_user()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.school_id = support_tickets.school_id
        AND p.role IN ('super_admin', 'admin', 'principal')
    )
  );

-- support_ticket_messages: visibility/write access follows the parent
-- ticket's own access rule (join back to support_tickets).
CREATE POLICY "support_ticket_messages_select"
  ON support_ticket_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_ticket_messages.ticket_id
        AND (
          public.is_platform_owner_user()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.school_id = t.school_id
          )
        )
    )
  );

CREATE POLICY "support_ticket_messages_insert"
  ON support_ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_ticket_messages.ticket_id
        AND (
          public.is_platform_owner_user()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.school_id = t.school_id
              AND p.role IN ('super_admin', 'admin', 'principal')
          )
        )
    )
  );

-- Keep support_tickets.updated_at current whenever a new message lands.
CREATE OR REPLACE FUNCTION touch_support_ticket_on_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE support_tickets SET updated_at = now() WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_support_ticket_on_message ON support_ticket_messages;
CREATE TRIGGER trg_touch_support_ticket_on_message
  AFTER INSERT ON support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION touch_support_ticket_on_message();
