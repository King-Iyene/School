-- ============================================================================
-- Enterprise "Appearance" theme customization
-- ============================================================================
-- tenant_settings.primary_color/secondary_color already exist, but they're
-- consumed exclusively by print/PDF letterhead styling (every print
-- component reads them with its own hardcoded fallback) — reusing them for
-- the app's live on-screen UI accent color would mean every tenant that
-- never touched either feature suddenly gets served whatever their print
-- color happens to be (default '#059669' emerald), not the intended
-- brand-indigo/violet default. So this adds two new, separate, nullable
-- columns instead: null means "use the default app theme", non-null means
-- an Enterprise tenant has deliberately customized their portal's accent
-- color from the new Appearance settings page.
alter table tenant_settings add column if not exists app_primary_color text;
alter table tenant_settings add column if not exists app_secondary_color text;

comment on column tenant_settings.app_primary_color is
  'Enterprise-only ("white_labeling"): overrides the app shell''s default brand-indigo accent color for every user of this tenant. Null = use the default theme.';
comment on column tenant_settings.app_secondary_color is
  'Enterprise-only ("white_labeling"): overrides the app shell''s default brand-violet secondary accent color. Null = use the default theme.';

-- Same shape as enforce_tenant_settings_feature_gate() (custom_domain) in
-- 20260903144058_enforce_plan_feature_access_rls.sql: RLS already lets a
-- tenant's own super_admin/admin write any tenant_settings column, so this
-- is the one place left to actually gate these two to Enterprise. Platform
-- owners are exempt (SaaS admin sets branding up on a tenant's behalf).
create or replace function enforce_tenant_theme_feature_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.app_primary_color is distinct from old.app_primary_color
    or new.app_secondary_color is distinct from old.app_secondary_color
  )
  and not public.tenant_has_feature(new.tenant_id, 'white_labeling')
  and not public.is_platform_owner_user() then
    raise exception 'Custom theme colors require the Enterprise plan. Upgrade your plan to customize your portal''s appearance.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_tenant_theme_feature_gate on tenant_settings;
create trigger trg_enforce_tenant_theme_feature_gate
  before update of app_primary_color, app_secondary_color on tenant_settings
  for each row execute function enforce_tenant_theme_feature_gate();
