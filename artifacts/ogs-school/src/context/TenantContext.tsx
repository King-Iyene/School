import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Tenant, TenantSettings } from '../lib/types';
import { useAuth } from './AuthContext';
import { Feature, isFeatureEnabledForPlan, PLAN_STUDENT_LIMITS } from '../lib/planFeatures';

const DEFAULT_SETTINGS: TenantSettings = {
  tenant_id: '',
  school_name: 'School Portal',
  motto: '',
  address: '',
  phone: '',
  email: '',
  logo_url: '',
  primary_color: '#059669',
  secondary_color: '#0d9488',
  paystack_public_key: '',
  custom_domain: null,
  app_primary_color: null,
  app_secondary_color: null,
  updated_at: '',
};

interface TenantContextType {
  tenant: Tenant | null;
  settings: TenantSettings;
  loading: boolean;
  /** Resolves the tenant from the current subdomain/custom domain for public, pre-auth pages. */
  resolveBySlug: (slug: string) => Promise<Tenant | null>;
  isFeatureEnabled: (feature: Feature) => boolean;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

function slugFromHostname(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  const parts = host.split('.');
  // e.g. "greenfield.schoolportal.app" -> "greenfield"; bare/root domains have no tenant slug.
  if (parts.length < 3) return null;
  const [first] = parts;
  if (first === 'www' || first === 'app' || first === 'eportal') return null;
  return first;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [settings, setSettings] = useState<TenantSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const loadByTenantId = useCallback(async (tenantId: string) => {
    const [{ data: tenantRow }, { data: settingsRow }] = await Promise.all([
      supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle(),
      supabase.from('tenant_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
    ]);
    if (tenantRow) setTenant(tenantRow as Tenant);
    if (settingsRow) setSettings(settingsRow as TenantSettings);
  }, []);

  const resolveBySlug = useCallback(async (slug: string) => {
    const { data: tenantRow } = await supabase.from('tenants').select('*').eq('slug', slug).maybeSingle();
    if (!tenantRow) return null;
    const { data: settingsRow } = await supabase
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', tenantRow.id)
      .maybeSingle();
    setTenant(tenantRow as Tenant);
    if (settingsRow) setSettings(settingsRow as TenantSettings);
    return tenantRow as Tenant;
  }, []);

  const loadDefaultTenant = useCallback(async () => {
    // No authenticated profile and no tenant subdomain in the URL (the
    // current production deployment serves one school on its own domain,
    // e.g. eportal.okrikagrammarschool.org, not <slug>.schoolos.app) — used
    // for pre-auth public pages like Login and the admission form so they
    // still show real branding instead of the generic fallback.
    const { data: tenantRow } = await supabase.from('tenants').select('*').order('created_at').limit(1).maybeSingle();
    if (!tenantRow) return;
    const { data: settingsRow } = await supabase
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', tenantRow.id)
      .maybeSingle();
    setTenant(tenantRow as Tenant);
    if (settingsRow) setSettings(settingsRow as TenantSettings);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (profile?.school_id) {
        await loadByTenantId(profile.school_id);
      } else {
        const slug = slugFromHostname();
        if (slug) await resolveBySlug(slug);
        else await loadDefaultTenant();
      }
    } finally {
      setLoading(false);
    }
  }, [profile?.school_id, loadByTenantId, resolveBySlug, loadDefaultTenant]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.school_id]);

  const isFeatureEnabled = useCallback(
    (feature: Feature) => isFeatureEnabledForPlan(tenant?.plan_tier, feature),
    [tenant?.plan_tier]
  );

  const contextValue = useMemo(
    () => ({ tenant, settings, loading, resolveBySlug, isFeatureEnabled, refresh }),
    [tenant, settings, loading, resolveBySlug, isFeatureEnabled, refresh]
  );

  return <TenantContext.Provider value={contextValue}>{children}</TenantContext.Provider>;
}

/**
 * Single source of truth for "what school is this and what can it do".
 * Falls back to sane defaults (school_name: "School Portal") until a tenant
 * resolves, so branded components never need a null-check dance.
 */
export function useTenantSettings() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenantSettings must be used within TenantProvider');
  return context;
}

export { PLAN_STUDENT_LIMITS };
