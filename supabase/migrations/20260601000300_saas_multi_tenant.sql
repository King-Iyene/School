-- ============================================================================
-- Multi-Tenant SaaS layer
-- ============================================================================
-- The app already scopes almost every table by `school_id` (schools.id is the
-- de-facto tenant key: profiles, classes, students, grades, fee_payments, etc.
-- all carry it and RLS already restricts reads/writes to "same school_id").
-- Rather than bolt on a second, parallel `tenant_id` column onto those tables
-- (which would fragment the isolation logic across two competing keys and
-- require touching hundreds of existing `.eq('school_id', ...)` call sites),
-- this migration adds a SaaS/billing layer keyed 1:1 on top of `schools`:
--
--   schools           existing per-school profile (name/address/logo/etc.)
--   tenants           NEW — subscription/plan/limits for that school
--   tenant_settings   NEW — SaaS branding + payment gateway config
--
-- `tenants.id` / `tenant_settings.tenant_id` both equal `schools.id`, so
-- "school_id" and "tenant_id" are the same identifier in this schema.
-- ============================================================================

create table if not exists tenants (
  id uuid primary key references schools(id) on delete cascade,
  slug text unique not null,
  plan_tier text not null default 'starter' check (plan_tier in ('starter', 'premium', 'enterprise')),
  student_limit integer, -- 250 (starter) / 1000 (premium) / null = unlimited (enterprise)
  status text not null default 'trial' check (status in ('active', 'suspended', 'trial')),
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tenants_slug on tenants(slug);
create index if not exists idx_tenants_plan_tier on tenants(plan_tier);

create table if not exists tenant_settings (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  school_name text not null default '',
  motto text default '',
  address text default '',
  phone text default '',
  email text default '',
  logo_url text default '',
  primary_color text default '#059669',
  secondary_color text default '#0d9488',
  paystack_public_key text default '',
  custom_domain text,
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_tenant_settings_custom_domain
  on tenant_settings(custom_domain) where custom_domain is not null;

-- Platform-level billing ledger, powers the SaaS admin MRR figure and the
-- onboarding checkout's payment verification step.
create table if not exists tenant_billing_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  plan_tier text not null check (plan_tier in ('starter', 'premium', 'enterprise')),
  amount numeric(12,2) not null,
  currency text not null default 'NGN',
  provider text not null default 'paystack',
  provider_reference text unique not null,
  status text not null default 'success' check (status in ('pending', 'success', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_tenant_billing_events_tenant on tenant_billing_events(tenant_id);

-- Marks a super_admin as the SaaS platform operator (owns /saas-admin) as
-- opposed to a regular school's super_admin (school_id set, no platform
-- access). Distinct from "super_admin with school_id IS NULL", which today
-- means "hasn't finished SchoolSetup yet".
alter table profiles add column if not exists is_platform_owner boolean not null default false;

alter table tenants enable row level security;
alter table tenant_settings enable row level security;
alter table tenant_billing_events enable row level security;

-- Branding must be readable pre-auth (landing page by subdomain, login
-- screen, onboarding plan picker) — none of these columns are secret
-- (paystack_public_key is a publishable key by design).
drop policy if exists "Anyone can read tenant branding" on tenant_settings;
create policy "Anyone can read tenant branding"
  on tenant_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can read tenant plan info" on tenants;
create policy "Anyone can read tenant plan info"
  on tenants for select
  to anon, authenticated
  using (true);

drop policy if exists "Platform owners manage tenants" on tenants;
create policy "Platform owners manage tenants"
  on tenants for all
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_platform_owner))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_platform_owner));

drop policy if exists "School admins manage own tenant_settings" on tenant_settings;
create policy "School admins manage own tenant_settings"
  on tenant_settings for all
  to authenticated
  using (
    tenant_id in (select p.school_id from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin'))
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_platform_owner)
  )
  with check (
    tenant_id in (select p.school_id from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin'))
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_platform_owner)
  );

drop policy if exists "Platform owners read billing events" on tenant_billing_events;
create policy "Platform owners read billing events"
  on tenant_billing_events for select
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_platform_owner));

-- ============================================================================
-- Student-limit enforcement (Starter: 250, Premium: 1000, Enterprise: none)
-- ============================================================================
create or replace function enforce_tenant_student_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if new.school_id is null then
    return new;
  end if;

  select student_limit into v_limit from tenants where id = new.school_id;
  if v_limit is null then
    return new; -- enterprise / no tenant row yet
  end if;

  select count(*) into v_count
  from students
  where school_id = new.school_id
    and (tg_op = 'INSERT' or id <> new.id);

  if v_count >= v_limit then
    raise exception 'Student limit reached for this plan (% students). Upgrade your plan to add more students.', v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_student_limit on students;
create trigger trg_enforce_student_limit
  before insert on students
  for each row execute function enforce_tenant_student_limit();

-- ============================================================================
-- Backfill: every existing school becomes an Enterprise tenant (they already
-- have the full unrestricted feature set live in production today).
-- ============================================================================
insert into tenants (id, slug, plan_tier, student_limit, status)
select
  s.id,
  lower(regexp_replace(coalesce(nullif(s.name, ''), 'school-' || s.id::text), '[^a-zA-Z0-9]+', '-', 'g')),
  'enterprise',
  null,
  'active'
from schools s
on conflict (id) do nothing;

insert into tenant_settings (tenant_id, school_name, motto, address, phone, email, logo_url)
select s.id, s.name, s.motto, s.address, s.phone, s.email, s.logo_url
from schools s
on conflict (tenant_id) do nothing;

-- ============================================================================
-- SaaS admin overview (Total schools / MRR / active students) — see
-- saas-admin dashboard. List prices live in the frontend planFeatures config;
-- kept here only as a fallback default for the MRR calculation.
-- ============================================================================
create or replace view v_tenant_overview as
select
  t.id as tenant_id,
  t.slug,
  t.plan_tier,
  t.student_limit,
  t.status,
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
