-- ============================================================================
-- Enterprise "Sidebar Navigation" customization
-- ============================================================================
-- Same Enterprise "customize your portal" entitlement (white_labeling) as
-- Appearance's colors and the dashboard layout, extended to which sidebar
-- nav *groups* a tenant's users see and in what order. Stored as a jsonb
-- array of {id, visible} in display order, where id is a nav group name
-- (e.g. "Academics", "HR & Leave") — the same vocabulary shared across every
-- role's nav array in navConfig.ts, so one saved layout applies consistently
-- regardless of which role is viewing. Individual items within a group and
-- the always-visible top-level links (Dashboard, Billing, etc.) aren't
-- covered by this — only whole groups, since the item-level list would run
-- into the hundreds of rows. Null means "use the default group order" —
-- the same convention as app_primary_color and dashboard_layout.
alter table tenant_settings add column if not exists sidebar_layout jsonb;

comment on column tenant_settings.sidebar_layout is
  'Enterprise-only ("white_labeling"): ordered [{id, visible}] list of sidebar nav group names controlling which groups are shown and in what order, for every user of this tenant. Null = use the default order. The "System Settings" group is never included/customizable (it is where this very setting lives).';

-- Widen the existing theme-gate trigger once more (rather than add a third
-- one) so all three settings share one exception message and code path.
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
    or new.dashboard_layout is distinct from old.dashboard_layout
    or new.sidebar_layout is distinct from old.sidebar_layout
  )
  and not public.tenant_has_feature(new.tenant_id, 'white_labeling')
  and not public.is_platform_owner_user() then
    raise exception 'Custom theme colors, dashboard layout, and sidebar navigation require the Enterprise plan. Upgrade your plan to customize your portal.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_tenant_theme_feature_gate on tenant_settings;
create trigger trg_enforce_tenant_theme_feature_gate
  before update of app_primary_color, app_secondary_color, dashboard_layout, sidebar_layout on tenant_settings
  for each row execute function enforce_tenant_theme_feature_gate();
