-- ============================================================================
-- Subscription lifecycle: renewals, trial reminders, dunning, self-service
-- plan changes and card updates
-- ============================================================================
-- Builds on 20260601000400_saas_trial_billing.sql (card-on-file + trial->paid
-- conversion). That migration only ever handles the ONE conversion event at
-- day 14. This adds what happens after: recurring monthly renewal charges,
-- a reminder before the trial ends, and a short, bounded retry window when a
-- renewal charge fails before the tenant is actually locked out — plus the
-- columns a tenant admin's own self-service plan-change/card-update flow
-- needs (see artifacts/api-server/src/routes/billing.ts).

alter table tenants add column if not exists next_billing_at timestamptz;
alter table tenants add column if not exists pending_plan_tier text
  check (pending_plan_tier is null or pending_plan_tier in ('starter', 'premium', 'enterprise'));
alter table tenants add column if not exists payment_retry_count integer not null default 0;
alter table tenants add column if not exists last_payment_error text;
alter table tenants add column if not exists trial_reminder_sent_at timestamptz;

comment on column tenants.next_billing_at is
  'When the next recurring charge is due. Set on trial->active conversion and advanced ~30 days on each successful renewal charge.';
comment on column tenants.pending_plan_tier is
  'A downgrade requested mid-cycle: the tenant keeps its current (already-paid-for) plan_tier and features until next_billing_at, at which point the renewal cron applies this value and clears it. Upgrades apply immediately instead (see billing.ts) and never set this.';
comment on column tenants.payment_retry_count is
  'Consecutive failed renewal charge attempts. Reset to 0 on any successful charge. A second consecutive failure suspends the tenant (see billing.ts run-cycle).';
comment on column tenants.last_payment_error is
  'Human-readable reason the most recent charge attempt failed (e.g. insufficient funds, invalid/expired card), surfaced on the tenant''s own billing page.';
comment on column tenants.trial_reminder_sent_at is
  'Set the first time the "your trial ends soon" email goes out, so run-cycle sends it exactly once per trial.';

-- 'past_due': a renewal charge failed once and the tenant has a short (few
-- day) grace window before a second failure suspends them — distinct from
-- 'suspended' (blocked now) and 'trial' (never charged yet).
alter table tenants drop constraint if exists tenants_status_check;
alter table tenants add constraint tenants_status_check
  check (status in ('active', 'suspended', 'trial', 'canceled', 'past_due'));

-- Tenant admins can already read plan_tier/status/etc. on their own `tenants`
-- row (the existing "Anyone can read tenant plan info" policy is USING
-- (true)) and the frontend already fetches it in full via TenantContext, so
-- no new read policy is needed there. tenant_billing_events was platform-
-- owner-read-only until now — a tenant's own admin needs to see their own
-- transaction history on the new self-service billing page.
drop policy if exists "Tenant admins read own billing events" on tenant_billing_events;
create policy "Tenant admins read own billing events"
  on tenant_billing_events for select
  to authenticated
  using (
    tenant_id in (select p.school_id from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin'))
  );

-- Keep the SaaS admin overview in sync with the new lifecycle columns so the
-- platform owner can see who's past-due/retrying without opening SQL.
create or replace view v_tenant_overview as
select
  t.id as tenant_id,
  t.slug,
  t.plan_tier,
  t.student_limit,
  t.status,
  t.trial_ends_at,
  t.cancel_at_period_end,
  t.created_at,
  ts.school_name,
  ts.logo_url,
  ts.primary_color,
  ts.secondary_color,
  ts.custom_domain,
  (select count(*) from students st where st.school_id = t.id) as student_count,
  (select count(*) from profiles p where p.school_id = t.id and p.role <> 'student') as staff_count,
  -- appended (not interleaved) so CREATE OR REPLACE VIEW can't fail with
  -- "cannot change name of view column" against the prior version of this
  -- view — Postgres only allows adding new trailing columns, never
  -- reordering or inserting mid-list.
  t.pending_plan_tier,
  t.next_billing_at,
  t.payment_retry_count,
  t.last_payment_error
from tenants t
left join tenant_settings ts on ts.tenant_id = t.id;
