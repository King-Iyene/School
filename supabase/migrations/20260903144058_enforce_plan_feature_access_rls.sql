-- ============================================================================
-- Server-side enforcement of plan-tier feature access
-- ============================================================================
-- Until now, "what does my plan unlock" was enforced only in the React app
-- (src/lib/planFeatures.ts, src/components/layout/navConfig.ts, FeatureGuard).
-- That's real UI enforcement, but it's not a security boundary: a Starter or
-- Premium tenant admin who calls the Supabase REST/PostgREST API directly
-- (bypassing the app entirely) hits plain school_id-scoped RLS on every
-- feature table underneath, which says nothing about plan_tier. This
-- migration adds that missing layer.
--
-- Design:
--   * `tenant_has_feature(school_id, feature)` mirrors PLAN_FEATURES in
--     src/lib/planFeatures.ts exactly. If either file changes which plan
--     unlocks a feature, the other must be updated to match — there is no
--     shared source of truth between the JS app and this SQL.
--   * Every gated table gets one additional RESTRICTIVE policy (never a
--     replacement of its existing policies). A RESTRICTIVE policy is ANDed
--     with whatever PERMISSIVE policies already exist, so this can only
--     narrow access further — it cannot loosen or break any existing
--     school_id/role logic already in place.
--   * The generic loop below only touches a table if it can see a
--     `school_id` column on it via information_schema — this repo has a
--     handful of tables (requisitions, staff_assessments, departments,
--     committees, committee_members, hod_reports,
--     staff_accommodation_assignments, asset_categories, asset_locations,
--     asset_rooms, assets) that are queried by the app but were never
--     created through a tracked migration (created directly against the
--     database at some point), so their live schema can't be confirmed from
--     this codebase. Rather than guess column names against a live
--     production database, those are left for a manual follow-up migration
--     once their real schema is confirmed — the loop RAISEs a NOTICE naming
--     each one it skips so that's visible in the `supabase db push` output.
--   * `campus_security` and `multi_branch` don't gate a table — they gate
--     whether the security_officer / diocesan_official *role* can exist at
--     all on a tenant's profiles (mirrors the client's whole-role nav
--     fallback in navConfig.ts). Enforced with a trigger, same pattern as
--     the existing student-limit trigger below.
--   * `custom_domain` / `white_labeling` gate the one column that matters
--     (tenant_settings.custom_domain) via trigger, since Postgres RLS can't
--     express a column-level check directly.
--   * `bulk_printing` has no table of its own — every /bulk-print/* page
--     only re-reads data already gated elsewhere (or ungated core data like
--     students/classes) to render a print sheet. Nothing to add here.
-- ============================================================================

create or replace function public.plan_rank(p_plan text)
returns int
language sql
immutable
as $$
  select case p_plan
    when 'starter' then 0
    when 'premium' then 1
    when 'enterprise' then 2
    else 0
  end;
$$;

-- Mirrors PLAN_FEATURES / minimumPlanFor() in src/lib/planFeatures.ts.
create or replace function public.feature_min_plan(p_feature text)
returns text
language sql
immutable
as $$
  select case p_feature
    when 'core_academics' then 'starter'
    when 'student_directory' then 'starter'
    when 'attendance' then 'starter'
    when 'report_cards' then 'starter'
    when 'parent_student_portal' then 'starter'
    when 'payment_gateway_collections' then 'premium'
    when 'cbt_engine' then 'premium'
    when 'lesson_plan_workflow' then 'premium'
    when 'library_inventory_store' then 'premium'
    when 'bulk_printing' then 'premium'
    when 'sms_email_broadcasts' then 'premium'
    when 'hr_payroll' then 'enterprise'
    when 'financial_accounting' then 'enterprise'
    when 'dormitory' then 'enterprise'
    when 'transport' then 'enterprise'
    when 'campus_security' then 'enterprise'
    when 'multi_branch' then 'enterprise'
    when 'white_labeling' then 'enterprise'
    when 'custom_domain' then 'enterprise'
    else 'enterprise'
  end;
$$;

-- Fails open (returns true) when the tenant row doesn't exist yet, matching
-- both isFeatureEnabledForPlan()'s client-side "no tenant resolved" fallback
-- and enforce_tenant_student_limit()'s existing "no tenant row yet" case
-- below — a school mid-provisioning is never locked out of its own data.
create or replace function public.tenant_has_feature(p_school_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.plan_rank(t.plan_tier) >= public.plan_rank(public.feature_min_plan(p_feature))
     from tenants t where t.id = p_school_id),
    true
  );
$$;

create or replace function public.is_platform_owner_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p where p.id = auth.uid() and p.is_platform_owner
  );
$$;

-- ============================================================================
-- Generic pass: one RESTRICTIVE "for all" policy per (table, feature), only
-- where a school_id column is actually present.
-- ============================================================================
do $$
declare
  g record;
  gates jsonb := '[
    {"tbl":"payroll_records",              "feature":"hr_payroll"},
    {"tbl":"leave_types",                  "feature":"hr_payroll"},
    {"tbl":"leave_allocations",            "feature":"hr_payroll"},
    {"tbl":"leave_applications",           "feature":"hr_payroll"},
    {"tbl":"staff_attendance_records",     "feature":"hr_payroll"},
    {"tbl":"requisitions",                 "feature":"hr_payroll"},
    {"tbl":"staff_assessments",            "feature":"hr_payroll"},
    {"tbl":"staff_accommodation_assignments","feature":"hr_payroll"},
    {"tbl":"hod_reports",                  "feature":"hr_payroll"},
    {"tbl":"departments",                  "feature":"hr_payroll"},
    {"tbl":"committees",                   "feature":"hr_payroll"},
    {"tbl":"committee_members",            "feature":"hr_payroll"},

    {"tbl":"income_records",               "feature":"financial_accounting"},
    {"tbl":"expense_records",              "feature":"financial_accounting"},
    {"tbl":"bank_accounts",                "feature":"financial_accounting"},
    {"tbl":"chart_of_accounts",            "feature":"financial_accounting"},

    {"tbl":"fees_groups",                  "feature":"payment_gateway_collections"},
    {"tbl":"fees_types",                   "feature":"payment_gateway_collections"},
    {"tbl":"fees_master",                  "feature":"payment_gateway_collections"},
    {"tbl":"fees_discounts",               "feature":"payment_gateway_collections"},
    {"tbl":"fees_collections",             "feature":"payment_gateway_collections"},
    {"tbl":"payment_methods_list",         "feature":"payment_gateway_collections"},
    {"tbl":"student_debts",                "feature":"payment_gateway_collections"},
    {"tbl":"fee_structures",               "feature":"payment_gateway_collections"},
    {"tbl":"fee_payments",                 "feature":"payment_gateway_collections"},
    {"tbl":"student_fee_payments",         "feature":"payment_gateway_collections"},

    {"tbl":"room_types",                   "feature":"dormitory"},

    {"tbl":"book_categories",              "feature":"library_inventory_store"},
    {"tbl":"inventory_items",              "feature":"library_inventory_store"},
    {"tbl":"item_issues",                  "feature":"library_inventory_store"},
    {"tbl":"store_categories",             "feature":"library_inventory_store"},
    {"tbl":"store_products",               "feature":"library_inventory_store"},
    {"tbl":"store_orders",                 "feature":"library_inventory_store"},
    {"tbl":"asset_categories",             "feature":"library_inventory_store"},
    {"tbl":"asset_locations",              "feature":"library_inventory_store"},
    {"tbl":"asset_rooms",                  "feature":"library_inventory_store"},
    {"tbl":"assets",                       "feature":"library_inventory_store"},

    {"tbl":"question_bank",                "feature":"cbt_engine"},
    {"tbl":"question_groups",              "feature":"cbt_engine"},
    {"tbl":"online_exams",                 "feature":"cbt_engine"},

    {"tbl":"lessons",                      "feature":"lesson_plan_workflow"},
    {"tbl":"topics",                       "feature":"lesson_plan_workflow"},
    {"tbl":"lesson_plans",                 "feature":"lesson_plan_workflow"},

    {"tbl":"messages",                     "feature":"sms_email_broadcasts"},
    {"tbl":"whatsapp_logs",                "feature":"sms_email_broadcasts"},
    {"tbl":"whatsapp_settings",            "feature":"sms_email_broadcasts"},
    {"tbl":"notification_triggers",        "feature":"sms_email_broadcasts"}
  ]'::jsonb;
begin
  for g in select * from jsonb_to_recordset(gates) as x(tbl text, feature text)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = g.tbl and column_name = 'school_id'
    ) then
      execute format('alter table public.%I enable row level security', g.tbl);
      execute format('drop policy if exists %I on public.%I', 'plan_gate_' || g.tbl, g.tbl);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated ' ||
        'using (public.tenant_has_feature(school_id, %L) or public.is_platform_owner_user()) ' ||
        'with check (public.tenant_has_feature(school_id, %L) or public.is_platform_owner_user())',
        'plan_gate_' || g.tbl, g.tbl, g.feature, g.feature
      );
      raise notice 'plan-feature gate: applied % on table %', g.feature, g.tbl;
    else
      raise notice 'plan-feature gate: SKIPPED % — no school_id column found (unverified/untracked schema, needs manual follow-up)', g.tbl;
    end if;
  end loop;
end $$;

-- ============================================================================
-- Write-only gate: these tables are also read by the deliberately-ungated
-- student/parent self-service panels (StudentTransportPanel/DormitoryPanel/
-- LibraryPanel etc. sit under navConfig.ts's ungated "Info" group, by
-- design — that's a client-side choice this migration isn't here to
-- relitigate). A blanket FOR ALL restrictive policy would also block those
-- reads and break an ungated feature. So here only INSERT/UPDATE/DELETE are
-- gated — a Starter/Premium(without the feature) tenant can no longer
-- create routes/vehicles/buildings/rooms, assign a student to one, or
-- add/issue a library book, but a student's already-existing assignment (or
-- a pre-downgrade book issue) stays visible.
-- ============================================================================
do $$
declare
  g record;
  write_gates jsonb := '[
    {"tbl":"books",                 "feature":"library_inventory_store"},
    {"tbl":"book_issues",           "feature":"library_inventory_store"},
    {"tbl":"library_members",       "feature":"library_inventory_store"},
    {"tbl":"transport_routes",      "feature":"transport"},
    {"tbl":"transport_vehicles",    "feature":"transport"},
    {"tbl":"transport_assignments", "feature":"transport"},
    {"tbl":"dormitory_buildings",   "feature":"dormitory"},
    {"tbl":"dormitory_rooms",       "feature":"dormitory"},
    {"tbl":"dormitory_assignments", "feature":"dormitory"}
  ]'::jsonb;
begin
  for g in select * from jsonb_to_recordset(write_gates) as x(tbl text, feature text)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = g.tbl and column_name = 'school_id'
    ) then
      execute format('alter table public.%I enable row level security', g.tbl);

      execute format('drop policy if exists %I on public.%I', 'plan_gate_ins_' || g.tbl, g.tbl);
      execute format(
        'create policy %I on public.%I as restrictive for insert to authenticated ' ||
        'with check (public.tenant_has_feature(school_id, %L) or public.is_platform_owner_user())',
        'plan_gate_ins_' || g.tbl, g.tbl, g.feature
      );

      execute format('drop policy if exists %I on public.%I', 'plan_gate_upd_' || g.tbl, g.tbl);
      execute format(
        'create policy %I on public.%I as restrictive for update to authenticated ' ||
        'using (public.tenant_has_feature(school_id, %L) or public.is_platform_owner_user()) ' ||
        'with check (public.tenant_has_feature(school_id, %L) or public.is_platform_owner_user())',
        'plan_gate_upd_' || g.tbl, g.tbl, g.feature, g.feature
      );

      execute format('drop policy if exists %I on public.%I', 'plan_gate_del_' || g.tbl, g.tbl);
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated ' ||
        'using (public.tenant_has_feature(school_id, %L) or public.is_platform_owner_user())',
        'plan_gate_del_' || g.tbl, g.tbl, g.feature
      );

      raise notice 'plan-feature gate (writes only, reads stay open): applied % on table %', g.feature, g.tbl;
    else
      raise notice 'plan-feature gate: SKIPPED % — no school_id column found (unverified/untracked schema, needs manual follow-up)', g.tbl;
    end if;
  end loop;
end $$;

-- ============================================================================
-- Child tables one join away from a school_id (no direct column to gate on).
-- Each is wrapped in an information_schema existence check on BOTH the
-- child and parent table/columns — same reasoning as the generic loop above:
-- a bare CREATE POLICY on a table/column that turns out not to exist is a
-- hard error that would abort this entire migration transaction (verified
-- locally: this is exactly what happened in a test run against a schema
-- missing one of these tables). Defensive here costs nothing and this repo
-- has already shown schema drift around the online-exam feature — its own
-- OnlineExamReport.tsx queries a table (online_exam_attempts) that no
-- tracked migration ever created.
-- ============================================================================
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='fee_payment_installments' and column_name='fee_payment_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='fee_payments' and column_name='school_id')
  then
    execute 'alter table public.fee_payment_installments enable row level security';
    execute 'drop policy if exists plan_gate_fee_payment_installments on public.fee_payment_installments';
    execute $q$
      create policy plan_gate_fee_payment_installments
        on public.fee_payment_installments as restrictive for all to authenticated
        using (
          public.is_platform_owner_user()
          or exists (
            select 1 from fee_payments fp
            where fp.id = fee_payment_installments.fee_payment_id
              and public.tenant_has_feature(fp.school_id, 'payment_gateway_collections')
          )
          or exists (
            select 1 from fees_collections fc
            where fc.id = fee_payment_installments.fees_collection_id
              and public.tenant_has_feature(fc.school_id, 'payment_gateway_collections')
          )
        )
        with check (
          public.is_platform_owner_user()
          or exists (
            select 1 from fee_payments fp
            where fp.id = fee_payment_installments.fee_payment_id
              and public.tenant_has_feature(fp.school_id, 'payment_gateway_collections')
          )
          or exists (
            select 1 from fees_collections fc
            where fc.id = fee_payment_installments.fees_collection_id
              and public.tenant_has_feature(fc.school_id, 'payment_gateway_collections')
          )
        )
    $q$;
    raise notice 'plan-feature gate: applied payment_gateway_collections on table fee_payment_installments (via parent join)';
  else
    raise notice 'plan-feature gate: SKIPPED fee_payment_installments — expected columns not found';
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='online_exam_questions' and column_name='online_exam_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='online_exams' and column_name='school_id')
  then
    execute 'alter table public.online_exam_questions enable row level security';
    execute 'drop policy if exists plan_gate_online_exam_questions on public.online_exam_questions';
    execute $q$
      create policy plan_gate_online_exam_questions
        on public.online_exam_questions as restrictive for all to authenticated
        using (
          public.is_platform_owner_user()
          or exists (
            select 1 from online_exams oe
            where oe.id = online_exam_questions.online_exam_id
              and public.tenant_has_feature(oe.school_id, 'cbt_engine')
          )
        )
        with check (
          public.is_platform_owner_user()
          or exists (
            select 1 from online_exams oe
            where oe.id = online_exam_questions.online_exam_id
              and public.tenant_has_feature(oe.school_id, 'cbt_engine')
          )
        )
    $q$;
    raise notice 'plan-feature gate: applied cbt_engine on table online_exam_questions (via parent join)';
  else
    raise notice 'plan-feature gate: SKIPPED online_exam_questions — expected columns not found';
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='online_exam_submissions' and column_name='online_exam_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='online_exams' and column_name='school_id')
  then
    execute 'alter table public.online_exam_submissions enable row level security';
    execute 'drop policy if exists plan_gate_online_exam_submissions on public.online_exam_submissions';
    execute $q$
      create policy plan_gate_online_exam_submissions
        on public.online_exam_submissions as restrictive for all to authenticated
        using (
          public.is_platform_owner_user()
          or exists (
            select 1 from online_exams oe
            where oe.id = online_exam_submissions.online_exam_id
              and public.tenant_has_feature(oe.school_id, 'cbt_engine')
          )
        )
        with check (
          public.is_platform_owner_user()
          or exists (
            select 1 from online_exams oe
            where oe.id = online_exam_submissions.online_exam_id
              and public.tenant_has_feature(oe.school_id, 'cbt_engine')
          )
        )
    $q$;
    raise notice 'plan-feature gate: applied cbt_engine on table online_exam_submissions (via parent join)';
  else
    raise notice 'plan-feature gate: SKIPPED online_exam_submissions — expected columns not found';
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='store_order_items' and column_name='order_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='store_orders' and column_name='school_id')
  then
    execute 'alter table public.store_order_items enable row level security';
    execute 'drop policy if exists plan_gate_store_order_items on public.store_order_items';
    execute $q$
      create policy plan_gate_store_order_items
        on public.store_order_items as restrictive for all to authenticated
        using (
          public.is_platform_owner_user()
          or exists (
            select 1 from store_orders so
            where so.id = store_order_items.order_id
              and public.tenant_has_feature(so.school_id, 'library_inventory_store')
          )
        )
        with check (
          public.is_platform_owner_user()
          or exists (
            select 1 from store_orders so
            where so.id = store_order_items.order_id
              and public.tenant_has_feature(so.school_id, 'library_inventory_store')
          )
        )
    $q$;
    raise notice 'plan-feature gate: applied library_inventory_store on table store_order_items (via parent join)';
  else
    raise notice 'plan-feature gate: SKIPPED store_order_items — expected columns not found';
  end if;
end $$;

-- ============================================================================
-- Role-based gates: campus_security / multi_branch aren't table-scoped, they
-- gate whether the security_officer / diocesan_official role can be assigned
-- at all — same shape as filterNavByPlan()'s whole-role fallback in
-- navConfig.ts (getNavItems() collapses those roles to just a Dashboard link
-- below Enterprise).
-- ============================================================================
create or replace function enforce_tenant_role_feature_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.school_id is null then
    return new;
  end if;

  if new.role = 'security_officer' and not public.tenant_has_feature(new.school_id, 'campus_security') then
    raise exception 'The Security Officer role requires the Enterprise plan. Upgrade your plan to add this role.'
      using errcode = 'P0001';
  end if;

  if new.role = 'diocesan_official' and not public.tenant_has_feature(new.school_id, 'multi_branch') then
    raise exception 'The Diocesan Official role requires the Enterprise plan. Upgrade your plan to add this role.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_role_feature_gate on profiles;
create trigger trg_enforce_role_feature_gate
  before insert or update of role on profiles
  for each row execute function enforce_tenant_role_feature_gate();

-- ============================================================================
-- white_labeling / custom_domain: gate the one tenant_settings column that
-- matters. Platform owners are exempt (they set this up on a tenant's
-- behalf from /saas-admin, typically as part of the same upgrade).
-- ============================================================================
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

  return new;
end;
$$;

drop trigger if exists trg_enforce_tenant_settings_feature_gate on tenant_settings;
create trigger trg_enforce_tenant_settings_feature_gate
  before update of custom_domain on tenant_settings
  for each row execute function enforce_tenant_settings_feature_gate();
