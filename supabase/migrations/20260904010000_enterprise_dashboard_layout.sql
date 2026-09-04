-- ============================================================================
-- Enterprise "Dashboard Layout" customization
-- ============================================================================
-- Extends the same Enterprise "customize your portal" entitlement
-- (white_labeling) used for Appearance's accent colors to also cover which
-- dashboard sections a tenant's users see and in what order. Stored as a
-- jsonb array of {id, visible} in display order, e.g.:
--   [{"id":"stats","visible":true}, {"id":"attendance","visible":false}, ...]
-- Null means "use the app's default layout" — every tenant that's never
-- touched this gets the same section order/visibility the dashboard already
-- ships with, same null-means-default convention as app_primary_color.
alter table tenant_settings add column if not exists dashboard_layout jsonb;

comment on column tenant_settings.dashboard_layout is
  'Enterprise-only ("white_labeling"): ordered [{id, visible}] list controlling which super-admin dashboard sections are shown and in what order, for every user of this tenant. Null = use the default layout.';

-- Widen the existing theme-gate trigger (rather than add a second one) so
-- both settings share one exception message and one code path — this column
-- is the same "Enterprise portal customization" entitlement as the colors.
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
  )
  and not public.tenant_has_feature(new.tenant_id, 'white_labeling')
  and not public.is_platform_owner_user() then
    raise exception 'Custom theme colors and dashboard layout require the Enterprise plan. Upgrade your plan to customize your portal.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_tenant_theme_feature_gate on tenant_settings;
create trigger trg_enforce_tenant_theme_feature_gate
  before update of app_primary_color, app_secondary_color, dashboard_layout on tenant_settings
  for each row execute function enforce_tenant_theme_feature_gate();
