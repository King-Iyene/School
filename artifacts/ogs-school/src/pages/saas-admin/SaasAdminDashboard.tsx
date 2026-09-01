import { useEffect, useMemo, useState, ElementType } from 'react';
import { Building2, Users, DollarSign, Search, Save, Palette, X, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/common/Modal';
import Reveal from '../../components/shared/Reveal';
import { PLAN_LABELS, PLAN_PRICES_NGN, PLAN_ORDER } from '../../lib/planFeatures';
import type { PlanTier, TenantStatus } from '../../lib/types';

interface TenantRow {
  tenant_id: string;
  slug: string;
  plan_tier: PlanTier;
  student_limit: number | null;
  status: TenantStatus;
  created_at: string;
  school_name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  custom_domain: string | null;
  student_count: number;
  staff_count: number;
}

const STATUS_COLORS: Record<TenantStatus, string> = {
  active: 'bg-brand-mint/15 text-brand-ink ring-1 ring-brand-mint/40',
  trial: 'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
};

const PLAN_BADGE_COLORS: Record<PlanTier, string> = {
  starter: 'bg-slate-100 text-slate-700',
  premium: 'bg-brand-violet/15 text-brand-indigo ring-1 ring-brand-violet/30',
  enterprise: 'bg-gradient-to-r from-brand-violet to-brand-indigo text-white',
};

function StatTile({ title, value, icon: Icon, delay }: { title: string; value: string | number; icon: ElementType; delay: number }) {
  return (
    <Reveal delay={delay}>
      <div className="relative overflow-hidden rounded-2xl p-5 bg-brand-ink border border-white/10 shadow-lg shadow-black/10">
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-brand-violet/20 blur-2xl" />
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-violet to-brand-indigo flex items-center justify-center mb-3 shadow-lg shadow-brand-violet/20">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs font-medium text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        </div>
      </div>
    </Reveal>
  );
}

export default function SaasAdminDashboard() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState<PlanTier | 'all'>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<TenantRow | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('v_tenant_overview').select('*').order('created_at', { ascending: false });
    setTenants((data as TenantRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return tenants.filter(t => {
      if (planFilter !== 'all' && t.plan_tier !== planFilter) return false;
      if (search && !t.school_name.toLowerCase().includes(search.toLowerCase()) && !t.slug.includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tenants, planFilter, search]);

  const mrr = useMemo(
    () => tenants.filter(t => t.status === 'active').reduce((sum, t) => sum + PLAN_PRICES_NGN[t.plan_tier], 0),
    [tenants]
  );
  const totalStudents = useMemo(() => tenants.reduce((sum, t) => sum + (t.student_count ?? 0), 0), [tenants]);

  async function updateTenant(tenantId: string, patch: Partial<TenantRow>) {
    setSaving(true);
    const tenantPatch: Record<string, unknown> = {};
    if (patch.plan_tier !== undefined) tenantPatch.plan_tier = patch.plan_tier;
    if (patch.student_limit !== undefined) tenantPatch.student_limit = patch.student_limit;
    if (patch.status !== undefined) tenantPatch.status = patch.status;

    if (Object.keys(tenantPatch).length) {
      await supabase.from('tenants').update(tenantPatch).eq('id', tenantId);
    }

    const settingsPatch: Record<string, unknown> = {};
    if (patch.school_name !== undefined) settingsPatch.school_name = patch.school_name;
    if (patch.logo_url !== undefined) settingsPatch.logo_url = patch.logo_url;
    if (patch.primary_color !== undefined) settingsPatch.primary_color = patch.primary_color;
    if (patch.secondary_color !== undefined) settingsPatch.secondary_color = patch.secondary_color;
    if (patch.custom_domain !== undefined) settingsPatch.custom_domain = patch.custom_domain || null;

    if (Object.keys(settingsPatch).length) {
      await supabase.from('tenant_settings').update(settingsPatch).eq('tenant_id', tenantId);
    }

    await load();
    setSaving(false);
    setEditing(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-violet to-brand-indigo flex items-center justify-center shadow-lg shadow-brand-violet/25">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">SaaS Platform Admin</h1>
              <p className="text-slate-500 text-sm">Manage every subscribed school from one place</p>
            </div>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <StatTile title="Subscribed Schools" value={tenants.length} icon={Building2} delay={0} />
          <StatTile title="Monthly Recurring Revenue" value={`₦${mrr.toLocaleString('en-NG')}`} icon={TrendingUp} delay={80} />
          <StatTile title="Active Students (Platform-wide)" value={totalStudents.toLocaleString()} icon={Users} delay={160} />
        </div>

        <Reveal delay={200} className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search schools…"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet/30 focus:border-brand-violet/40"
              />
            </div>
            <div className="flex gap-2">
              {(['all', ...PLAN_ORDER] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPlanFilter(p as PlanTier | 'all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    planFilter === p
                      ? 'bg-gradient-to-r from-brand-violet to-brand-indigo text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p === 'all' ? 'All Plans' : PLAN_LABELS[p as PlanTier]}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100">
                  <th className="p-4">School</th>
                  <th className="p-4">Plan</th>
                  <th className="p-4">Students</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Since</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading tenants…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">No schools match this filter.</td></tr>
                ) : filtered.map(t => (
                  <tr key={t.tenant_id} className="border-b border-slate-50 hover:bg-brand-violet/[0.03] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {t.logo_url ? <img src={t.logo_url} className="w-full h-full object-contain" /> : <Building2 className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">{t.school_name || t.slug}</p>
                          <p className="text-xs text-slate-400 truncate">{t.custom_domain || `${t.slug}.schoolos.app`}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${PLAN_BADGE_COLORS[t.plan_tier]}`}>{PLAN_LABELS[t.plan_tier]}</span>
                    </td>
                    <td className="p-4 text-slate-600">
                      {t.student_count}{t.student_limit ? ` / ${t.student_limit}` : ' / ∞'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                    </td>
                    <td className="p-4 text-slate-500">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setEditing(t)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-indigo bg-brand-violet/10 hover:bg-brand-violet/20 rounded-lg transition-colors"
                      >
                        <Palette className="w-3.5 h-3.5" /> Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>

      {editing && (
        <TenantEditModal
          tenant={editing}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={patch => updateTenant(editing.tenant_id, patch)}
        />
      )}
    </div>
  );
}

function TenantEditModal({
  tenant, saving, onClose, onSave,
}: {
  tenant: TenantRow;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: Partial<TenantRow>) => void;
}) {
  const [form, setForm] = useState<TenantRow>({ ...tenant });
  const fieldClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet/30 focus:border-brand-violet/40 transition-colors';

  return (
    <Modal isOpen title={`Manage ${tenant.school_name || tenant.slug}`} onClose={onClose} size="lg">
      <div className="space-y-5">
        <section>
          <h4 className="text-xs font-semibold text-brand-indigo uppercase tracking-wide mb-2">Plan & Billing</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Plan Tier</label>
              <select
                value={form.plan_tier}
                onChange={e => setForm(f => ({ ...f, plan_tier: e.target.value as PlanTier }))}
                className={fieldClass}
              >
                {PLAN_ORDER.map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as TenantStatus }))}
                className={fieldClass}
              >
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Student Limit (blank = unlimited)</label>
            <input
              type="number"
              value={form.student_limit ?? ''}
              onChange={e => setForm(f => ({ ...f, student_limit: e.target.value ? Number(e.target.value) : null }))}
              placeholder="Unlimited"
              className={fieldClass}
            />
          </div>
        </section>

        <section>
          <h4 className="text-xs font-semibold text-brand-indigo uppercase tracking-wide mb-2">Branding</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">School Name</label>
              <input value={form.school_name} onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))} className={fieldClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Logo URL</label>
              <input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} className={fieldClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="w-10 h-9 border border-slate-200 rounded-lg" />
                  <input value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className={`flex-1 ${fieldClass}`} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Secondary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} className="w-10 h-9 border border-slate-200 rounded-lg" />
                  <input value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} className={`flex-1 ${fieldClass}`} />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
                Custom Domain
                {tenant.plan_tier !== 'enterprise' && (
                  <span className="text-white text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gradient-to-r from-brand-violet to-brand-indigo">ENTERPRISE ONLY</span>
                )}
              </label>
              <input
                value={form.custom_domain ?? ''}
                onChange={e => setForm(f => ({ ...f, custom_domain: e.target.value }))}
                placeholder="portal.yourschool.com"
                disabled={form.plan_tier !== 'enterprise'}
                className={`${fieldClass} disabled:bg-slate-50 disabled:text-slate-400`}
              />
            </div>
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            <X className="w-4 h-4 inline mr-1" /> Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving}
            className="flex-1 py-2.5 bg-gradient-to-r from-brand-violet to-brand-indigo hover:brightness-110 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-brand-violet/20"
          >
            <Save className="w-4 h-4 inline mr-1" /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
