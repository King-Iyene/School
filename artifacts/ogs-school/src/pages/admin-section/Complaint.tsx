import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, CreditCard as Edit2, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

const statusVariant: Record<string, any> = { open: 'default', in_progress: 'warning', resolved: 'success', closed: 'error' };

export default function Complaint() {
  const { profile } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [form, setForm] = useState({ complaint_by: '', phone: '', email: '', complaint_type: '', source: '', description: '', status: 'open' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, [profile]);

  async function loadAll() {
    if (!profile?.school_id) return;
    setLoading(true);
    const [cRes, tRes, sRes] = await Promise.all([
      supabase.from('complaints').select('*').eq('school_id', profile.school_id).order('created_at', { ascending: false }),
      supabase.from('admin_setup').select('*').eq('school_id', profile.school_id).eq('type', 'complaint_type').order('name'),
      supabase.from('admin_setup').select('*').eq('school_id', profile.school_id).eq('type', 'source').order('name'),
    ]);
    setComplaints(cRes.data ?? []);
    setTypes(tRes.data ?? []);
    setSources(sRes.data ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditItem(null);
    setForm({ complaint_by: '', phone: '', email: '', complaint_type: '', source: '', description: '', status: 'open' });
    setShowModal(true);
  }

  function openEdit(item: any) {
    setEditItem(item);
    setForm({ complaint_by: item.complaint_by || item.complainant_name || '', phone: item.phone ?? '', email: item.email ?? '', complaint_type: item.complaint_type ?? '', source: item.source ?? '', description: item.description ?? '', status: item.status });
    setShowModal(true);
  }

  async function handleSave() {
    if (!profile?.school_id) return;
    setSaving(true);
    const payload = {
      complaint_by: form.complaint_by,
      complainant_name: form.complaint_by,
      phone: form.phone,
      email: form.email,
      complaint_type: form.complaint_type,
      source: form.source,
      description: form.description,
      status: form.status,
    };
    let res;
    if (editItem) {
      res = await supabase.from('complaints').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id);
    } else {
      res = await supabase.from('complaints').insert({ ...payload, school_id: profile.school_id });
    }
    if (res.error) {
      console.error(res.error);
      setSaving(false);
      return;
    }
    setShowModal(false);
    loadAll();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this complaint?')) return;
    await supabase.from('complaints').delete().eq('id', id);
    loadAll();
  }

  const filtered = complaints.filter(c => !search || `${c.complaint_by} ${c.complaint_type} ${c.description}`.toLowerCase().includes(search.toLowerCase()));
  const inputCls = 'w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">Complaints</h2>
          <p className="text-app-text-muted text-sm">Manage and resolve school complaints</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 sm:px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Complaint</span>
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm">
        <div className="p-4 border-b border-app-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search complaints..." className="w-full pl-9 pr-4 py-2 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-app-border bg-app-surface-alt">
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">SL</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Complaint By</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Complaint Type</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Source</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Phone</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-app-text-muted">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-app-text-muted">No complaints found</td></tr>
              ) : filtered.map((c, idx) => (
                <tr key={c.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-5 py-3 text-sm text-app-text-muted">{idx + 1}</td>
                  <td className="px-5 py-3 text-sm font-medium text-app-text">{c.complaint_by}</td>
                  <td className="px-5 py-3 text-sm text-app-text-muted">{c.complaint_type || '—'}</td>
                  <td className="px-5 py-3 text-sm text-app-text-muted">{c.source || '—'}</td>
                  <td className="px-5 py-3 text-sm text-app-text-muted">{c.phone || '—'}</td>
                  <td className="px-5 py-3 text-sm text-app-text-muted">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setDetailItem(c); setShowDetailModal(true); }} title="View" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(c)} title="Edit" className="p-1.5 text-app-text-muted hover:bg-slate-100 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(c.id)} title="Delete" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-app-border text-sm text-app-text-muted">{filtered.length} of {complaints.length} complaints</div>
      </div>

      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Complaint Details" size="md">
        {detailItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-app-text-muted mb-1">Complainant</p><p className="text-sm font-medium text-app-text">{detailItem.complaint_by}</p></div>
              <div><p className="text-xs text-app-text-muted mb-1">Phone</p><p className="text-sm text-app-text">{detailItem.phone || '—'}</p></div>
              <div><p className="text-xs text-app-text-muted mb-1">Email</p><p className="text-sm text-app-text">{detailItem.email || '—'}</p></div>
              <div><p className="text-xs text-app-text-muted mb-1">Type</p><p className="text-sm text-app-text">{detailItem.complaint_type || '—'}</p></div>
              <div><p className="text-xs text-app-text-muted mb-1">Source</p><p className="text-sm text-app-text">{detailItem.source || '—'}</p></div>
              <div><p className="text-xs text-app-text-muted mb-1">Status</p><Badge label={detailItem.status.replace('_', ' ')} variant={statusVariant[detailItem.status]} /></div>
              <div><p className="text-xs text-app-text-muted mb-1">Assigned To</p><p className="text-sm text-app-text">{detailItem.assigned_to || '—'}</p></div>
              <div><p className="text-xs text-app-text-muted mb-1">Date</p><p className="text-sm text-app-text">{new Date(detailItem.created_at).toLocaleDateString()}</p></div>
            </div>
            {detailItem.description && (
              <div><p className="text-xs text-app-text-muted mb-1">Description</p><p className="text-sm text-app-text bg-app-surface-alt rounded-xl p-3">{detailItem.description}</p></div>
            )}
            <button onClick={() => setShowDetailModal(false)} className="w-full px-4 py-2 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt">Close</button>
          </div>
        )}
      </Modal>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Complaint' : 'Add Complaint'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Complainant Name *</label>
              <input value={form.complaint_by} onChange={e => setForm({ ...form, complaint_by: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Complaint Type</label>
              <select value={form.complaint_type} onChange={e => setForm({ ...form, complaint_type: e.target.value })} className={`${inputCls} bg-app-surface`}>
                <option value="">Select type</option>
                {types.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Source</label>
              <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className={`${inputCls} bg-app-surface`}>
                <option value="">Select source</option>
                {sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={`${inputCls} bg-app-surface`}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.complaint_by} className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : editItem ? 'Update' : 'Add Complaint'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
