import { useEffect, useMemo, useState } from 'react';
import { Building2, Users, DollarSign, Search, Save, Palette, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import StatCard from '../../components/common/StatCard';
import Modal from '../../components/common/Modal';
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
  active: 'bg-emerald-100 text-emerald-700',
  trial: 'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
};

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
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">SaaS Platform Admin</h1>
            <p className="text-slate-500 text-sm">Manage every subscribed school from one place</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <StatCard title="Subscribed Schools" value={tenants.length} icon={Building2} color="blue" />
          <StatCard title="Monthly Recurring Revenue" value={`₦${mrr.toLocaleString('en-NG')}`} icon={DollarSign} color="emerald" />
          <StatCard title="Active Students (Platform-wide)" value={totalStudents.toLocaleString()} icon={Users} color="amber" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search schools…"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div className="flex gap-2">
              {(['all', ...PLAN_ORDER] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPlanFilter(p as PlanTier | 'all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    planFilter === p ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                  <tr key={t.tenant_id} className="border-b border-slate-50 hover:bg-slate-50/50">
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
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">{PLAN_LABELS[t.plan_tier]}</span>
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        <Palette className="w-3.5 h-3.5" /> Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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

  return (
    <Modal isOpen title={`Manage ${tenant.school_name || tenant.slug}`} onClose={onClose} size="lg">
      <div className="space-y-5">
        <section>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Plan & Billing</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Plan Tier</label>
              <select
                value={form.plan_tier}
                onChange={e => setForm(f => ({ ...f, plan_tier: e.target.value as PlanTier }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                {PLAN_ORDER.map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as TenantStatus }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
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
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </section>

        <section>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Branding</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">School Name</label>
              <input value={form.school_name} onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Logo URL</label>
              <input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="w-10 h-9 border border-slate-200 rounded-lg" />
                  <input value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Secondary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} className="w-10 h-9 border border-slate-200 rounded-lg" />
                  <input value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
                Custom Domain
                {tenant.plan_tier !== 'enterprise' && <span className="text-amber-600 text-[10px] font-semibold">ENTERPRISE ONLY</span>}
              </label>
              <input
                value={form.custom_domain ?? ''}
                onChange={e => setForm(f => ({ ...f, custom_domain: e.target.value }))}
                placeholder="portal.yourschool.com"
                disabled={form.plan_tier !== 'enterprise'}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
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
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Save className="w-4 h-4 inline mr-1" /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
