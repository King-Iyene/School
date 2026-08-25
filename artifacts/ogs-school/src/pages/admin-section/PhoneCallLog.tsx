import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, CreditCard as Edit2, Phone, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

export default function PhoneCallLog() {
  const { profile } = useAuth();
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ caller_name: '', phone: '', call_type: 'incoming', subject: '', duration_minutes: '', call_date: '', next_follow_up_date: '', handled_by: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => { loadAll(); }, [profile]);

  async function loadAll() {
    if (!profile?.school_id) return;
    setLoading(true);
    const { data } = await supabase.from('phone_call_logs').select('*').eq('school_id', profile.school_id).order('call_date', { ascending: false });
    setCalls(data ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditItem(null);
    setForm({ caller_name: '', phone: '', call_type: 'incoming', subject: '', duration_minutes: '', call_date: new Date().toISOString().split('T')[0], next_follow_up_date: '', handled_by: profile ? `${profile.first_name} ${profile.last_name}` : '', notes: '' });
    setSaveError('');
    setShowModal(true);
  }

  function openEdit(item: any) {
    setEditItem(item);
    setForm({ caller_name: item.caller_name, phone: item.phone ?? '', call_type: item.call_type, subject: item.subject ?? '', duration_minutes: item.duration_minutes ? String(item.duration_minutes) : '', call_date: item.call_date, next_follow_up_date: item.next_follow_up_date ?? '', handled_by: item.handled_by ?? '', notes: item.notes ?? '' });
    setSaveError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!profile?.school_id) return;
    setSaving(true);
    const payload = { ...form, duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null, next_follow_up_date: form.next_follow_up_date || null };
    if (editItem) {
      const res = await supabase.from('phone_call_logs').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id);
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    } else {
      const res = await supabase.from('phone_call_logs').insert({ ...payload, school_id: profile.school_id });
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    }
    setShowModal(false);
    loadAll();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this call log?')) return;
    await supabase.from('phone_call_logs').delete().eq('id', id);
    loadAll();
  }

  const filtered = calls.filter(c => {
    const matchSearch = !search || `${c.caller_name} ${c.phone} ${c.subject}`.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || c.call_type === filterType;
    return matchSearch && matchType;
  });

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Phone Call Log</h2>
          <p className="text-slate-500 text-sm">Track all incoming and outgoing phone calls</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Log Call
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, subject..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white">
          <option value="">All Calls</option>
          <option value="incoming">Incoming</option>
          <option value="outgoing">Outgoing</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Type</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Caller</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Subject</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Duration</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Handled By</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Next Follow-up</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Date</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">No call logs found</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3">
                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${c.call_type === 'incoming' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                    {c.call_type === 'incoming' ? <PhoneIncoming className="w-3 h-3" /> : <PhoneOutgoing className="w-3 h-3" />}
                    {c.call_type}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-800">{c.caller_name}</p>
                  <p className="text-xs text-slate-500">{c.phone}</p>
                </td>
                <td className="px-5 py-3 text-sm text-slate-600">{c.subject || '—'}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{c.duration_minutes ? `${c.duration_minutes} min` : '—'}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{c.handled_by || '—'}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{c.next_follow_up_date ? new Date(c.next_follow_up_date).toLocaleDateString() : '—'}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{new Date(c.call_date).toLocaleDateString()}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(c)} title="Edit" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(c.id)} title="Delete" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-slate-100 text-sm text-slate-500">{filtered.length} of {calls.length} call logs</div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Call Log' : 'Log Phone Call'} size="lg">
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Call Type</label>
              <select value={form.call_type} onChange={e => setForm({ ...form, call_type: e.target.value })} className={`${inputCls} bg-white`}>
                <option value="incoming">Incoming</option>
                <option value="outgoing">Outgoing</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Caller / Contact Name *</label>
              <input value={form.caller_name} onChange={e => setForm({ ...form, caller_name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Call Date</label>
              <input type="date" value={form.call_date} onChange={e => setForm({ ...form, call_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duration (minutes)</label>
              <input type="number" min="0" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Next Follow-up</label>
              <input type="date" value={form.next_follow_up_date} onChange={e => setForm({ ...form, next_follow_up_date: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Handled By</label>
            <input value={form.handled_by} onChange={e => setForm({ ...form, handled_by: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.caller_name} className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : editItem ? 'Update' : 'Log Call'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
