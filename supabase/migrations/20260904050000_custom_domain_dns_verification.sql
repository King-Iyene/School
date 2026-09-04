-- ============================================================================
-- Custom domain DNS ownership verification
-- ============================================================================
-- Until now tenant_settings.custom_domain was a plain data field with no
-- proof the tenant (or the platform owner setting it up on their behalf)
-- actually controls that domain's DNS — the value was only ever used for
-- display (falling back to <slug>.schoolos.app) and had no verification
-- pipeline behind it.
--
-- Adds a standard "add this TXT record, then check" ownership flow:
--   - custom_domain_verification_token: a random per-tenant token the admin
--     is asked to publish as a TXT record at _ogs-verify.<domain>
--   - custom_domain_verified: set true once the app confirms (via a public
--     DNS-over-HTTPS lookup, done client-side from /saas-admin — no new
--     backend needed) that the TXT record matches the token
--
-- Changing custom_domain always resets custom_domain_verified back to
-- false, folded into the existing enforce_tenant_settings_feature_gate()
-- trigger (same "one trigger per column, widened as needed" pattern used
-- for the theme/dashboard-layout gate) so a domain can never be shown as
-- verified after being swapped out for a different, unverified one.
alter table tenant_settings add column if not exists custom_domain_verified boolean not null default false;
alter table tenant_settings add column if not exists custom_domain_verification_token text;

update tenant_settings
  set custom_domain_verification_token = encode(gen_random_bytes(16), 'hex')
  where custom_domain_verification_token is null;

alter table tenant_settings alter column custom_domain_verification_token
  set default encode(gen_random_bytes(16), 'hex');
alter table tenant_settings alter column custom_domain_verification_token set not null;

comment on column tenant_settings.custom_domain_verified is
  'True once a DNS TXT lookup at _ogs-verify.<custom_domain> confirmed custom_domain_verification_token. Reset to false whenever custom_domain changes.';
comment on column tenant_settings.custom_domain_verification_token is
  'Random token the tenant publishes as a TXT record at _ogs-verify.<custom_domain> to prove DNS ownership.';

create or replace function enforce_tenant_settings_feature_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.custom_domain is not null
     and new.custom_domain is distinct from old.custom_domain
     and not public.tenant_has_feature(new.tenant_id, 'custom_domain')
     and not public.is_platform_owner_user() then
    raise exception 'Custom domains require the Enterprise plan. Upgrade your plan to set a custom domain.'
      using errcode = 'P0001';
  end if;

  if new.custom_domain is distinct from old.custom_domain then
    new.custom_domain_verified := false;
  end if;

  return new;
end;
$$;

-- Trigger definition (name/columns) is unchanged — only the function body
-- above changed — but re-created here so this migration is self-contained.
drop trigger if exists trg_enforce_tenant_settings_feature_gate on tenant_settings;
create trigger trg_enforce_tenant_settings_feature_gate
  before update of custom_domain on tenant_settings
  for each row execute function enforce_tenant_settings_feature_gate();

-- Expose the two new columns to /saas-admin's tenant overview. Appended as
-- new trailing columns (never reordered/inserted mid-list) — CREATE OR
-- REPLACE VIEW rejects anything else against the prior column list.
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
  t.pending_plan_tier,
  t.next_billing_at,
  t.payment_retry_count,
  t.last_payment_error,
  ts.custom_domain_verified,
  ts.custom_domain_verification_token
from tenants t
left join tenant_settings ts on ts.tenant_id = t.id;
