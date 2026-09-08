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
  custom_domain_verified: false,
  custom_domain_verification_token: '',
  app_primary_color: null,
  app_secondary_color: null,
  dashboard_layout: null,
  sidebar_layout: null,
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
  /** True when the current hostname matched a tenant's own verified custom domain (not the platform's own domain). */
  isOnOwnCustomDomain: boolean;
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
  const [isOnOwnCustomDomain, setIsOnOwnCustomDomain] = useState(false);

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

  // Matches the current hostname against a verified Enterprise custom
  // domain, so a visitor who lands on a tenant's own domain (rather than
  // <slug>.schoolos.app) sees that tenant's real branding pre-login too.
  // Only a *verified* domain resolves here — an unverified one (still
  // mid DNS setup) falls through to loadDefaultTenant() like any other
  // unrecognized host, since we can't yet be sure who really owns it.
  const resolveByCustomDomain = useCallback(async (hostname: string) => {
    const { data: settingsRow } = await supabase
      .from('tenant_settings')
      .select('*')
      .eq('custom_domain', hostname)
      .eq('custom_domain_verified', true)
      .maybeSingle();
    if (!settingsRow) return null;
    const { data: tenantRow } = await supabase.from('tenants').select('*').eq('id', settingsRow.tenant_id).maybeSingle();
    if (!tenantRow) return null;
    setTenant(tenantRow as Tenant);
    setSettings(settingsRow as TenantSettings);
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
    setIsOnOwnCustomDomain(false);
    try {
      if (profile?.school_id) {
        await loadByTenantId(profile.school_id);
      } else {
        // Check custom domains FIRST, before guessing this is a
        // <slug>.schoolos.app-style address: a real custom domain like
        // "portal.kdsquares.com" has 3 dot-separated labels too, so
        // checking slugFromHostname() first would misread "portal" as a
        // subdomain slug and never reach the actual custom-domain match.
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        const isLocalOrIp = !hostname || hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
        const byDomain = isLocalOrIp ? null : await resolveByCustomDomain(hostname);
        if (byDomain) {
          setIsOnOwnCustomDomain(true);
          return;
        }

        const slug = slugFromHostname();
        if (slug) {
          const bySlug = await resolveBySlug(slug);
          if (bySlug) return;
        }

        await loadDefaultTenant();
      }
    } finally {
      setLoading(false);
    }
  }, [profile?.school_id, loadByTenantId, resolveBySlug, resolveByCustomDomain, loadDefaultTenant]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.school_id]);

  const isFeatureEnabled = useCallback(
    (feature: Feature) => isFeatureEnabledForPlan(tenant?.plan_tier, feature),
    [tenant?.plan_tier]
  );

  const contextValue = useMemo(
    () => ({ tenant, settings, loading, resolveBySlug, isFeatureEnabled, refresh, isOnOwnCustomDomain }),
    [tenant, settings, loading, resolveBySlug, isFeatureEnabled, refresh, isOnOwnCustomDomain]
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
