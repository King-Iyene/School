-- ============================================================================
-- 14-day free trial billing: card-on-file + scheduled trial->paid conversion
-- ============================================================================
-- Onboarding now captures a card (via a small refundable Paystack
-- verification charge) BEFORE the school account is created, so every
-- trial has a reusable card authorization on file. The trial runs for 14
-- days (tenants.trial_ends_at, already created in saas_multi_tenant.sql);
-- a scheduled job charges the plan price via Paystack's charge_authorization
-- endpoint when the trial ends, unless the tenant cancelled first.

alter table tenants add column if not exists paystack_authorization_code text;
alter table tenants add column if not exists paystack_customer_code text;
alter table tenants add column if not exists cancel_at_period_end boolean not null default false;

-- Widen status to include 'canceled' (trial or subscription ended by the
-- tenant / platform owner and not auto-converted to a paid subscription).
alter table tenants drop constraint if exists tenants_status_check;
alter table tenants add constraint tenants_status_check
  check (status in ('active', 'suspended', 'trial', 'canceled'));

comment on column tenants.paystack_authorization_code is
  'Reusable Paystack card authorization captured at signup, used to auto-charge when the trial ends.';
comment on column tenants.cancel_at_period_end is
  'Tenant (or platform owner) requested cancellation — do not auto-charge at trial end; flip to canceled instead.';

-- Refresh the SaaS admin overview to surface trial/cancellation state
-- (never exposes paystack_authorization_code — that stays server-side only).
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
  (select count(*) from profiles p where p.school_id = t.id and p.role <> 'student') as staff_count
from tenants t
left join tenant_settings ts on ts.tenant_id = t.id;
