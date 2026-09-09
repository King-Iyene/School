import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Palette, RotateCcw, Check, Moon, Sun, LayoutGrid, PanelLeft, Eye, EyeOff, ChevronUp, ChevronDown, Globe, Copy, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenantSettings } from '../../context/TenantContext';
import { DASHBOARD_WIDGETS, resolveDashboardLayout } from '../../lib/dashboardLayout';
import { buildEditableSidebarLayout } from '../../lib/sidebarLayout';
import { getNavItems } from '../../components/layout/navConfig';
import { DashboardLayoutEntry, SidebarLayoutEntry } from '../../lib/types';
import { verifyCustomDomainDns, getVercelDnsRecord } from '../../lib/dnsVerify';
import { apiUrl } from '../../lib/apiUrl';
import Modal from '../../components/common/Modal';

const DEFAULT_PRIMARY = '#2A0A5C';
const DEFAULT_SECONDARY = '#B679F5';

const PRESETS: { label: string; primary: string; secondary: string }[] = [
  { label: 'SchoolOS (default)', primary: '#2A0A5C', secondary: '#B679F5' },
  { label: 'Forest', primary: '#065f46', secondary: '#10b981' },
  { label: 'Ocean', primary: '#0c4a6e', secondary: '#0ea5e9' },
  { label: 'Crimson', primary: '#7f1d1d', secondary: '#ef4444' },
  { label: 'Sunset', primary: '#7c2d12', secondary: '#f97316' },
];

export default function Appearance() {
  const { tenant, settings, refresh } = useTenantSettings();
  const [primary, setPrimary] = useState(settings.app_primary_color || DEFAULT_PRIMARY);
  const [secondary, setSecondary] = useState(settings.app_secondary_color || DEFAULT_SECONDARY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isCustomized = !!settings.app_primary_color || !!settings.app_secondary_color;

  async function save(newPrimary: string | null, newSecondary: string | null) {
    if (!tenant?.id) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from('tenant_settings')
      .update({ app_primary_color: newPrimary, app_secondary_color: newSecondary })
      .eq('tenant_id', tenant.id);
    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setMessage({ type: 'success', text: 'Appearance updated — every user of your school will see it applied.' });
    await refresh();
  }

  async function reset() {
    setPrimary(DEFAULT_PRIMARY);
    setSecondary(DEFAULT_SECONDARY);
    await save(null, null);
  }

  const isEnterprise = tenant?.plan_tier === 'enterprise';
  const [domain, setDomain] = useState(settings.custom_domain ?? '');
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainMessage, setDomainMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkingDns, setCheckingDns] = useState(false);
  const [dnsError, setDnsError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectMessage, setConnectMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ connected: boolean; misconfigured: boolean } | null>(null);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  function copyField(field: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(f => (f === field ? null : f)), 1500);
    });
  }

  async function authedFetch(path: string, init?: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(apiUrl(path), {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${session?.access_token ?? ''}` },
    });
  }

  async function connectToVercel(): Promise<boolean> {
    setConnecting(true);
    setConnectMessage(null);
    try {
      const resp = await authedFetch('/api/domains/register-vercel', { method: 'POST' });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setConnectMessage({ type: 'error', text: body.error ?? 'Could not connect this domain.' });
        return false;
      }
      setConnectMessage({ type: 'success', text: 'Domain connected.' });
      await checkConnectionStatus();
      return true;
    } catch {
      setConnectMessage({ type: 'error', text: 'Could not reach the server. Please try again.' });
      return false;
    } finally {
      setConnecting(false);
    }
  }

  async function checkConnectionStatus() {
    setCheckingStatus(true);
    setConnectionStatus(null);
    try {
      const resp = await authedFetch('/api/domains/vercel-status');
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setConnectMessage({ type: 'error', text: body.error ?? 'Could not check connection status.' });
        return;
      }
      setConnectionStatus({ connected: !!body.connected, misconfigured: !!body.misconfigured });
    } catch {
      setConnectMessage({ type: 'error', text: 'Could not reach the server. Please try again.' });
    } finally {
      setCheckingStatus(false);
    }
  }

  async function saveDomain(explicitDomain?: string | null) {
    if (!tenant?.id) return;
    const nextDomain = explicitDomain !== undefined ? explicitDomain : (domain.trim() || null);
    setDomainSaving(true);
    setDomainMessage(null);

    // Clean up the OLD domain's Vercel attachment first, while it's still
    // the value on record — otherwise a removed/replaced domain stays
    // attached to the project forever, blocking it from being reconnected
    // later (whether by this tenant again or a different one). Not fatal
    // if this fails: the DB stays the source of truth for what THIS
    // tenant's domain is, and a stale Vercel attachment can be cleaned up
    // manually — just surface a note rather than blocking the save.
    if (settings.custom_domain && settings.custom_domain !== nextDomain) {
      const resp = await authedFetch('/api/domains/remove-vercel', { method: 'POST' }).catch(() => null);
      if (resp && !resp.ok) {
        const body = await resp.json().catch(() => ({}));
        if (body.error) setConnectMessage({ type: 'error', text: `Note: ${body.error}` });
      }
    }

    const { error } = await supabase
      .from('tenant_settings')
      .update({ custom_domain: nextDomain })
      .eq('tenant_id', tenant.id);
    setDomainSaving(false);
    if (error) {
      setDomainMessage({ type: 'error', text: error.message });
      return;
    }
    setDomain(nextDomain ?? '');
    setDomainMessage({ type: 'success', text: nextDomain ? 'Custom domain saved.' : 'Custom domain removed.' });
    setConnectionStatus(null);
    if (nextDomain) setShowDomainModal(true);
    await refresh();
  }

  async function removeDomain() {
    if (!confirm('Remove this custom domain? Visitors will need to use the default address again.')) return;
    await saveDomain(null);
  }

  async function checkDns() {
    if (!settings.custom_domain) return;
    setCheckingDns(true);
    setDnsError('');
    try {
      const verified = await verifyCustomDomainDns(settings.custom_domain, settings.custom_domain_verification_token);
      if (!verified) {
        setDnsError('TXT record not found yet. DNS changes can take a few minutes to propagate — try again shortly.');
        return;
      }
      if (!tenant?.id) return;
      await supabase.from('tenant_settings').update({ custom_domain_verified: true }).eq('tenant_id', tenant.id);
      await refresh();
      const connected = await connectToVercel();
      if (connected) setShowDomainModal(false);
    } catch (err) {
      setDnsError(err instanceof Error ? err.message : 'DNS lookup failed.');
    } finally {
      setCheckingDns(false);
    }
  }

  // Keeps the status icon in the domain input meaningful without a manual
  // "Check Status" button — refreshes automatically whenever there's a
  // verified domain to report on (page load, or right after verifying).
  useEffect(() => {
    if (settings.custom_domain_verified) {
      checkConnectionStatus();
    } else {
      setConnectionStatus(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.custom_domain_verified, settings.custom_domain]);

  const [layout, setLayout] = useState<DashboardLayoutEntry[]>(() => resolveDashboardLayout(settings.dashboard_layout));
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const layoutIsCustomized = !!settings.dashboard_layout;

  function moveWidget(index: number, direction: -1 | 1) {
    const next = [...layout];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setLayout(next);
  }

  function toggleWidget(index: number) {
    const next = [...layout];
    next[index] = { ...next[index], visible: !next[index].visible };
    setLayout(next);
  }

  async function saveLayout(newLayout: DashboardLayoutEntry[] | null) {
    if (!tenant?.id) return;
    setLayoutSaving(true);
    setLayoutMessage(null);
    const { error } = await supabase
      .from('tenant_settings')
      .update({ dashboard_layout: newLayout })
      .eq('tenant_id', tenant.id);
    setLayoutSaving(false);
    if (error) {
      setLayoutMessage({ type: 'error', text: error.message });
      return;
    }
    setLayoutMessage({ type: 'success', text: 'Dashboard layout updated — every user of your school will see it applied.' });
    await refresh();
  }

  async function resetLayout() {
    const defaultLayout = resolveDashboardLayout(null);
    setLayout(defaultLayout);
    await saveLayout(null);
  }

  // Every role has its own nav array, but group *names* (Academics, HR &
  // Leave, ...) are shared vocabulary across all of them — using the
  // super_admin's own nav (the fullest one) as the representative list of
  // customizable groups keeps this screen from needing a separate settings
  // list per role.
  const presentGroups = useMemo(() => {
    const items = getNavItems('super_admin', tenant?.plan_tier);
    const seen = new Set<string>();
    const groups: string[] = [];
    for (const item of items) {
      if (item.group && !seen.has(item.group)) {
        seen.add(item.group);
        groups.push(item.group);
      }
    }
    return groups;
  }, [tenant?.plan_tier]);

  const [sidebarLayout, setSidebarLayout] = useState<SidebarLayoutEntry[]>(() =>
    buildEditableSidebarLayout(settings.sidebar_layout, presentGroups)
  );
  const [sidebarSaving, setSidebarSaving] = useState(false);
  const [sidebarMessage, setSidebarMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const sidebarIsCustomized = !!settings.sidebar_layout;

  function moveSidebarGroup(index: number, direction: -1 | 1) {
    const next = [...sidebarLayout];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSidebarLayout(next);
  }

  function toggleSidebarGroup(index: number) {
    const next = [...sidebarLayout];
    next[index] = { ...next[index], visible: !next[index].visible };
    setSidebarLayout(next);
  }

  async function saveSidebarLayout(newLayout: SidebarLayoutEntry[] | null) {
    if (!tenant?.id) return;
    setSidebarSaving(true);
    setSidebarMessage(null);
    const { error } = await supabase
      .from('tenant_settings')
      .update({ sidebar_layout: newLayout })
      .eq('tenant_id', tenant.id);
    setSidebarSaving(false);
    if (error) {
      setSidebarMessage({ type: 'error', text: error.message });
      return;
    }
    setSidebarMessage({ type: 'success', text: 'Sidebar navigation updated — every user of your school will see it applied.' });
    await refresh();
  }

  async function resetSidebarLayout() {
    setSidebarLayout(buildEditableSidebarLayout(null, presentGroups));
    await saveSidebarLayout(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-app-text">Appearance</h1>
        <p className="text-app-text-muted text-sm mt-1">
          Customize your portal's accent colors — applied for every user at your school, in both light and dark mode.
        </p>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-app-text flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4" /> Brand Colors
        </h2>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-app-text mb-2">Primary color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primary}
                onChange={e => setPrimary(e.target.value)}
                className="w-12 h-12 rounded-lg border border-app-border cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={primary}
                onChange={e => setPrimary(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-app-primary/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-2">Secondary color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={secondary}
                onChange={e => setSecondary(e.target.value)}
                className="w-12 h-12 rounded-lg border border-app-border cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={secondary}
                onChange={e => setSecondary(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-app-primary/40"
              />
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm font-medium text-app-text mb-2">Presets</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => { setPrimary(p.primary); setSecondary(p.secondary); }}
                className="bg-app-surface text-app-text flex items-center gap-2 px-3 py-1.5 rounded-lg border border-app-border hover:border-app-primary/50 text-xs font-medium text-app-text transition-colors"
              >
                <span className="w-3 h-3 rounded-full" style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm font-medium text-app-text mb-2">Preview</p>
          <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Preview</p>
            <p className="text-white text-lg font-bold">Welcome back, Admin</p>
            <p className="text-white/70 text-sm mt-1">This is how your hero banner and accent color will look.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => save(primary, secondary)}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-app-primary hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Check className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {isCustomized && (
            <button
              onClick={reset}
              disabled={saving}
              className="bg-app-surface text-app-text inline-flex items-center gap-2 px-4 py-2.5 border border-app-border text-app-text-muted hover:text-app-text text-sm font-medium rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Reset to Default
            </button>
          )}
        </div>
      </div>

      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-app-text flex items-center gap-2 mb-1">
          <Globe className="w-4 h-4" /> Custom Domain
          {!isEnterprise && (
            <span className="text-white text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gradient-to-r from-brand-violet to-brand-indigo">ENTERPRISE ONLY</span>
          )}
        </h2>
        <p className="text-sm text-app-text-muted mb-4">
          Use your own domain (e.g. portal.yourschool.com) instead of the default address.
        </p>

        {domainMessage && (
          <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${domainMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {domainMessage.text}
          </div>
        )}

        {(() => {
          const domainMatchesSaved = !!settings.custom_domain && domain.trim() === settings.custom_domain;
          const connected = connectionStatus?.connected && !connectionStatus.misconfigured;
          let statusIcon: ReactNode = null;
          let statusTitle = '';
          if (domainMatchesSaved) {
            if (!settings.custom_domain_verified) {
              statusIcon = <AlertCircle className="w-4 h-4 text-amber-500" />;
              statusTitle = 'Setup needed';
            } else if (checkingStatus) {
              statusIcon = <Loader2 className="w-4 h-4 text-app-text-muted animate-spin" />;
              statusTitle = 'Checking connection…';
            } else if (connected) {
              statusIcon = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
              statusTitle = 'Connected and live';
            } else {
              statusIcon = <AlertCircle className="w-4 h-4 text-amber-500" />;
              statusTitle = 'Verified — DNS still needs to point at Vercel';
            }
          }

          return (
            <>
              <div className="mb-2">
                <label className="block text-sm font-medium text-app-text mb-2">Domain</label>
                <div className="relative">
                  <input
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                    placeholder="portal.yourschool.com"
                    disabled={!isEnterprise}
                    className="w-full px-3 py-2 pr-9 text-sm bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-app-primary/40 disabled:bg-app-surface-alt disabled:text-app-text-muted"
                  />
                  {statusIcon && (
                    <button
                      type="button"
                      title={statusTitle}
                      onClick={() => setShowDomainModal(true)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2"
                    >
                      {statusIcon}
                    </button>
                  )}
                </div>
              </div>

              {domainMatchesSaved && (
                <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-app-text-muted">{statusTitle}</p>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button type="button" onClick={() => setShowDomainModal(true)} className="text-xs text-app-primary font-medium hover:underline">
                      Manage
                    </button>
                    <button type="button" onClick={removeDomain} disabled={domainSaving} className="text-xs text-red-600 font-medium hover:underline disabled:opacity-50">
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        <button
          onClick={() => saveDomain()}
          disabled={domainSaving || !isEnterprise || domain.trim() === (settings.custom_domain ?? '')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-app-primary hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Check className="w-4 h-4" /> {domainSaving ? 'Saving…' : 'Save Domain'}
        </button>
      </div>

      {showDomainModal && settings.custom_domain && (() => {
        const routingRecord = getVercelDnsRecord(settings.custom_domain);
        const verified = settings.custom_domain_verified;
        const connected = connectionStatus?.connected && !connectionStatus.misconfigured;
        return (
          <Modal isOpen onClose={() => setShowDomainModal(false)} title="Custom Domain" size="md">
            <div className="space-y-4">
              {!verified ? (
                <p className="text-sm text-app-text-muted">
                  Add both of these DNS records at <strong>{settings.custom_domain}</strong>'s registrar in one trip, then verify — the first proves you own the domain, the second is what actually routes it to your portal:
                </p>
              ) : (
                <p className="text-sm text-app-text-muted">
                  {connected
                    ? <>✓ Connected and live — visitors to <strong>{settings.custom_domain}</strong> now reach your portal.</>
                    : <>Ownership verified. If the DNS record below isn't added yet, add it at your registrar — this can take a few minutes to a few hours to take effect.</>}
                </p>
              )}

              <div className="bg-app-surface-alt border border-app-border rounded-xl overflow-hidden text-sm">
                <div className="grid grid-cols-3 gap-2 px-4 py-2 font-semibold text-app-text-muted text-xs uppercase tracking-wide border-b border-app-border">
                  <span>Type</span><span>Host / Name</span><span>Value</span>
                </div>
                {!verified && (
                  <div className="grid grid-cols-3 gap-2 px-4 py-3 font-mono text-xs items-center border-b border-app-border">
                    <span className="text-app-text">TXT</span>
                    <span className="text-app-text flex items-center gap-1.5 min-w-0">
                      <span className="break-all">_ogs-verify.{settings.custom_domain}</span>
                      <button type="button" onClick={() => copyField('txt-host', `_ogs-verify.${settings.custom_domain}`)} title="Copy" className="text-app-text-muted hover:text-app-text transition-colors flex-shrink-0">
                        {copiedField === 'txt-host' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </span>
                    <span className="text-app-text flex items-center gap-1.5 min-w-0">
                      <span className="break-all">{settings.custom_domain_verification_token}</span>
                      <button type="button" onClick={() => copyField('txt-value', settings.custom_domain_verification_token)} title="Copy" className="text-app-text-muted hover:text-app-text transition-colors flex-shrink-0">
                        {copiedField === 'txt-value' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 px-4 py-3 font-mono text-xs items-center">
                  <span className="text-app-text">{routingRecord.type}</span>
                  <span className="text-app-text flex items-center gap-1.5 min-w-0">
                    <span className="break-all">{routingRecord.host}</span>
                    <button type="button" onClick={() => copyField('cname-host', routingRecord.host)} title="Copy" className="text-app-text-muted hover:text-app-text transition-colors flex-shrink-0">
                      {copiedField === 'cname-host' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </span>
                  <span className="text-app-text flex items-center gap-1.5 min-w-0">
                    <span className="break-all">{routingRecord.value}</span>
                    <button type="button" onClick={() => copyField('cname-value', routingRecord.value)} title="Copy" className="text-app-text-muted hover:text-app-text transition-colors flex-shrink-0">
                      {copiedField === 'cname-value' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </span>
                </div>
              </div>

              {dnsError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3">{dnsError}</div>
              )}
              {connectMessage && (
                <div className={`text-xs rounded-xl px-4 py-3 ${connectMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {connectMessage.text}
                </div>
              )}

              {!verified && (
                <p className="text-xs text-app-text-muted">
                  "Verify Now" checks ownership and connects your domain in one step once the TXT record is visible. The CNAME record can take longer to propagate, so the portal may not be reachable at the domain immediately even after this succeeds.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDomainModal(false)}
                  className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors"
                >
                  Close
                </button>
                {!verified ? (
                  <button
                    onClick={checkDns}
                    disabled={checkingDns}
                    className="flex-1 px-4 py-2.5 bg-app-primary hover:opacity-90 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                  >
                    {checkingDns ? 'Verifying...' : 'Verify Now'}
                  </button>
                ) : (
                  <button
                    onClick={() => (connected ? checkConnectionStatus() : connectToVercel())}
                    disabled={checkingStatus || connecting}
                    className="flex-1 px-4 py-2.5 bg-app-primary hover:opacity-90 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                  >
                    {checkingStatus || connecting ? 'Checking...' : 'Refresh Status'}
                  </button>
                )}
              </div>

              <button
                onClick={removeDomain}
                disabled={domainSaving}
                className="w-full px-4 py-2 text-xs text-red-600 hover:underline disabled:opacity-50 transition-colors"
              >
                Remove this domain
              </button>
            </div>
          </Modal>
        );
      })()}

      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-app-text flex items-center gap-2 mb-1">
          <LayoutGrid className="w-4 h-4" /> Dashboard Layout
        </h2>
        <p className="text-sm text-app-text-muted mb-4">
          Choose which sections appear on the dashboard, and in what order — applied for every user at your school.
        </p>

        {layoutMessage && (
          <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${layoutMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {layoutMessage.text}
          </div>
        )}

        <div className="divide-y divide-app-border border border-app-border rounded-xl overflow-hidden mb-4">
          {layout.map((entry, index) => {
            const widget = DASHBOARD_WIDGETS.find(w => w.id === entry.id);
            if (!widget) return null;
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-4 py-3 bg-app-surface ${!entry.visible ? 'opacity-50' : ''}`}
              >
                <div className="flex flex-col -my-1">
                  <button
                    onClick={() => moveWidget(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${widget.label} up`}
                    className="text-app-text-muted hover:text-app-text disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveWidget(index, 1)}
                    disabled={index === layout.length - 1}
                    aria-label={`Move ${widget.label} down`}
                    className="text-app-text-muted hover:text-app-text disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <span className="flex-1 text-sm font-medium text-app-text">{widget.label}</span>
                <button
                  onClick={() => toggleWidget(index)}
                  className="flex items-center gap-1.5 text-xs font-medium text-app-text-muted hover:text-app-text px-2.5 py-1.5 rounded-lg hover:bg-app-surface-alt transition-colors"
                >
                  {entry.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {entry.visible ? 'Visible' : 'Hidden'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => saveLayout(layout)}
            disabled={layoutSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-app-primary hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Check className="w-4 h-4" /> {layoutSaving ? 'Saving…' : 'Save Layout'}
          </button>
          <button
            onClick={resetLayout}
            disabled={layoutSaving || !layoutIsCustomized}
            className="bg-app-surface text-app-text inline-flex items-center gap-2 px-4 py-2.5 border border-app-border text-app-text-muted hover:text-app-text disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Reset to Default
          </button>
        </div>
      </div>

      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-app-text flex items-center gap-2 mb-1">
          <PanelLeft className="w-4 h-4" /> Sidebar Navigation
        </h2>
        <p className="text-sm text-app-text-muted mb-4">
          Choose which sidebar sections appear, and in what order — applied for every user at your school. "System Settings" always stays put, so you can never lose access to this screen.
        </p>

        {sidebarMessage && (
          <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${sidebarMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {sidebarMessage.text}
          </div>
        )}

        <div className="divide-y divide-app-border border border-app-border rounded-xl overflow-hidden mb-4">
          {sidebarLayout.map((entry, index) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-4 py-3 bg-app-surface ${!entry.visible ? 'opacity-50' : ''}`}
            >
              <div className="flex flex-col -my-1">
                <button
                  onClick={() => moveSidebarGroup(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${entry.id} up`}
                  className="text-app-text-muted hover:text-app-text disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveSidebarGroup(index, 1)}
                  disabled={index === sidebarLayout.length - 1}
                  aria-label={`Move ${entry.id} down`}
                  className="text-app-text-muted hover:text-app-text disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <span className="flex-1 text-sm font-medium text-app-text">{entry.id}</span>
              <button
                onClick={() => toggleSidebarGroup(index)}
                className="flex items-center gap-1.5 text-xs font-medium text-app-text-muted hover:text-app-text px-2.5 py-1.5 rounded-lg hover:bg-app-surface-alt transition-colors"
              >
                {entry.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {entry.visible ? 'Visible' : 'Hidden'}
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => saveSidebarLayout(sidebarLayout)}
            disabled={sidebarSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-app-primary hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Check className="w-4 h-4" /> {sidebarSaving ? 'Saving…' : 'Save Navigation'}
          </button>
          <button
            onClick={resetSidebarLayout}
            disabled={sidebarSaving || !sidebarIsCustomized}
            className="bg-app-surface text-app-text inline-flex items-center gap-2 px-4 py-2.5 border border-app-border text-app-text-muted hover:text-app-text disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Reset to Default
          </button>
        </div>
      </div>

      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-app-text flex items-center gap-2 mb-2">
          <Sun className="w-4 h-4" /> <Moon className="w-4 h-4 -ml-1" /> Light &amp; Dark Mode
        </h2>
        <p className="text-sm text-app-text-muted">
          Every user can switch between light, dark, or system theme individually from the sun/moon icon in the top bar — that's a personal preference and isn't affected by the brand colors above.
        </p>
      </div>
    </div>
  );
}
