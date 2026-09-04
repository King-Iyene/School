import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, CreditCard as Edit2, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

export default function PostalReceive() {
  const { profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ from_title: '', address: '', reference_no: '', to_title: '', date: '', note: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, [profile]);

  async function loadAll() {
    if (!profile?.school_id) return;
    setLoading(true);
    const { data } = await supabase.from('postal_receives').select('*').eq('school_id', profile.school_id).order('date', { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditItem(null);
    setError('');
    setForm({ from_title: '', address: '', reference_no: '', to_title: '', date: new Date().toISOString().split('T')[0], note: '' });
    setShowModal(true);
  }

  function openEdit(item: any) {
    setEditItem(item);
    setError('');
    setForm({ from_title: item.from_title, address: item.address ?? '', reference_no: item.reference_no ?? '', to_title: item.to_title ?? '', date: item.date, note: item.note ?? '' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!profile?.school_id) return;
    setSaving(true);
    setError('');
    const payload = {
      from_title: form.from_title,
      address: form.address,
      reference_no: form.reference_no,
      to_title: form.to_title,
      date: form.date,
      note: form.note,
    };
    let res;
    if (editItem) {
      res = await supabase.from('postal_receives').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id);
    } else {
      res = await supabase.from('postal_receives').insert({ ...payload, school_id: profile.school_id });
    }
    if (res.error) {
      setError(res.error.message);
      setSaving(false);
      return;
    }
    setShowModal(false);
    loadAll();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this record?')) return;
    await supabase.from('postal_receives').delete().eq('id', id);
    loadAll();
  }

  function handleDownload(item: any) {
    const csv = `From Title,Reference No,Address,To Title,Note,Date\n"${item.from_title}","${item.reference_no ?? ''}","${item.address ?? ''}","${item.to_title ?? ''}","${item.note ?? ''}","${item.date ?? ''}"`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `postal-receive-${item.reference_no || item.id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = items.filter(i => !search || `${i.from_title} ${i.reference_no} ${i.to_title}`.toLowerCase().includes(search.toLowerCase()));
  const inputCls = 'bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">Postal Receive</h2>
          <p className="text-app-text-muted text-sm">Log all incoming postal correspondence</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Record
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm">
        <div className="p-4 border-b border-app-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by sender, reference, subject..." className="bg-app-surface text-app-text w-full pl-9 pr-4 py-2 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-app-border bg-app-surface-alt">
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">From Title</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Reference No</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Address</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">To Title</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Note</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-app-text-muted">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-app-text-muted">No records found</td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-app-text">{item.from_title}</td>
                  <td className="px-5 py-3 text-sm text-app-text-muted font-mono">{item.reference_no || '—'}</td>
                  <td className="px-5 py-3 text-sm text-app-text-muted truncate max-w-[160px]">{item.from_address || '—'}</td>
                  <td className="px-5 py-3 text-sm text-app-text-muted">{item.received_by || '—'}</td>
                  <td className="px-5 py-3 text-sm text-app-text-muted">{item.notes || '—'}</td>
                  <td className="px-5 py-3 text-sm text-app-text-muted">{item.date ? new Date(item.date).toLocaleDateString() : '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDownload(item)} title="Download" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Download className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(item)} title="Edit" className="p-1.5 text-app-text-muted hover:bg-slate-100 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} title="Delete" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-app-border text-sm text-app-text-muted">{filtered.length} of {items.length} records</div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Record' : 'Add Postal Receive'} size="lg">
        <div className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">From Title *</label>
              <input value={form.from_title} onChange={e => setForm({ ...form, from_title: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Reference No</label>
              <input value={form.reference_no} onChange={e => setForm({ ...form, reference_no: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Address</label>
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">To Title</label>
              <input value={form.to_title} onChange={e => setForm({ ...form, to_title: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Note</label>
            <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.from_title} className="flex-1 px-4 py-2 bg-app-primary hover:opacity-90 text-white rounded-xl text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : editItem ? 'Update' : 'Add Record'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
