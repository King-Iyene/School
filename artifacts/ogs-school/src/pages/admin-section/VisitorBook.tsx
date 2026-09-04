import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, CreditCard as Edit2, Download, CalendarDays } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

export default function VisitorBook() {
  const { profile } = useAuth();
  const [visitors, setVisitors] = useState<any[]>([]);
  const [purposes, setPurposes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', id_card_type: '', id_card_number: '',
    num_of_persons: 1, purpose: '', meeting_with: '', in_time: '', out_time: '', note: '', date: new Date().toISOString().split('T')[0],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, [profile]);

  async function loadAll() {
    if (!profile?.school_id) return;
    setLoading(true);
    const [vRes, pRes] = await Promise.all([
      supabase.from('visitors').select('*').eq('school_id', profile.school_id).order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('admin_setup').select('*').eq('school_id', profile.school_id).eq('type', 'purpose').order('name'),
    ]);
    setVisitors(vRes.data ?? []);
    setPurposes(pRes.data ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditItem(null);
    setError('');
    setForm({ name: '', phone: '', email: '', id_card_type: '', id_card_number: '', num_of_persons: 1, purpose: '', meeting_with: '', in_time: '', out_time: '', note: '', date: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  }

  function openEdit(item: any) {
    setEditItem(item);
    setError('');
    setForm({
      name: item.name, phone: item.phone ?? '', email: item.email ?? '',
      id_card_type: item.id_card_type ?? '', id_card_number: item.id_card_number ?? '',
      num_of_persons: item.num_of_persons ?? 1, purpose: item.purpose ?? '',
      meeting_with: item.meeting_with ?? '', in_time: item.in_time ?? '',
      out_time: item.out_time ?? '', note: item.note ?? '',
      date: item.date ? item.date.split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!profile?.school_id || !form.name.trim()) return;
    setSaving(true);
    setError('');
    const payload = {
      name: form.name, phone: form.phone, email: form.email,
      id_card_type: form.id_card_type, id_card_number: form.id_card_number,
      num_of_persons: form.num_of_persons, purpose: form.purpose,
      meeting_with: form.meeting_with, in_time: form.in_time || null,
      out_time: form.out_time || null, note: form.note,
      date: form.date || new Date().toISOString().split('T')[0],
    };
    const res = editItem
      ? await supabase.from('visitors').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id)
      : await supabase.from('visitors').insert({ ...payload, school_id: profile.school_id });
    if (res.error) { setError(res.error.message); setSaving(false); return; }
    setShowModal(false);
    loadAll();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this visitor record?')) return;
    await supabase.from('visitors').delete().eq('id', id);
    loadAll();
  }

  function exportCSV() {
    const rows = [
      ['Name', 'Phone', 'Email', 'ID Type', 'ID Number', 'Persons', 'Purpose', 'Meeting With', 'In Time', 'Out Time', 'Date', 'Note'],
      ...filtered.map(v => [v.name, v.phone ?? '', v.email ?? '', v.id_card_type ?? '', v.id_card_number ?? '', v.num_of_persons ?? '', v.purpose ?? '', v.meeting_with ?? '', v.in_time ?? '', v.out_time ?? '', v.date ? new Date(v.date).toLocaleDateString('en-GB') : '', v.note ?? '']),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `visitor-book-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = visitors.filter(v => {
    const textMatch = !search || `${v.name} ${v.phone ?? ''} ${v.purpose ?? ''}`.toLowerCase().includes(search.toLowerCase());
    const vDate = v.date ? v.date.split('T')[0] : '';
    const fromMatch = !dateFrom || vDate >= dateFrom;
    const toMatch = !dateTo || vDate <= dateTo;
    return textMatch && fromMatch && toMatch;
  });

  const grouped: Record<string, typeof filtered> = {};
  filtered.forEach(v => {
    const d = v.date ? new Date(v.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'No Date';
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(v);
  });

  const inputCls = 'w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-app-text">Visitor Book</h2>
          <p className="text-app-text-muted text-sm">Track all school visitors and their details</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 border border-app-border text-app-text-muted hover:bg-app-surface-alt px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Visitor
          </button>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm">
        <div className="p-4 border-b border-app-border flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, purpose..." className="w-full pl-9 pr-4 py-2 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-app-text-muted flex-shrink-0" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            <span className="text-app-text-muted text-sm">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">Clear</button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-app-text-muted">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-app-text-muted">No visitor records found</div>
        ) : (
          <div className="divide-y divide-app-border">
            {Object.entries(grouped).map(([date, dayVisitors]) => (
              <div key={date}>
                <div className="px-5 py-2.5 bg-app-surface-alt flex items-center justify-between">
                  <span className="text-xs font-semibold text-app-text-muted uppercase tracking-wide">{date}</span>
                  <span className="text-xs text-app-text-muted">{dayVisitors.length} visitor{dayVisitors.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <tbody className="divide-y divide-slate-50">
                      {dayVisitors.map(v => (
                        <tr key={v.id} className="hover:bg-app-surface-alt transition-colors">
                          <td className="px-5 py-3">
                            <div>
                              <p className="text-sm font-semibold text-app-text">{v.name}</p>
                              {v.phone && <p className="text-xs text-app-text-muted">{v.phone}</p>}
                            </div>
                          </td>
                          <td className="px-5 py-3 hidden sm:table-cell">
                            <span className="text-xs bg-slate-100 text-app-text-muted px-2 py-1 rounded-lg">{v.purpose || '—'}</span>
                          </td>
                          <td className="px-5 py-3 hidden md:table-cell text-sm text-app-text-muted">
                            {v.meeting_with ? <span>Meets: <span className="font-medium">{v.meeting_with}</span></span> : '—'}
                          </td>
                          <td className="px-5 py-3 hidden md:table-cell text-sm text-app-text-muted">
                            <span className="text-emerald-600">{v.in_time || '—'}</span>
                            {v.out_time && <><span className="mx-1 text-slate-300">→</span><span className="text-red-500">{v.out_time}</span></>}
                          </td>
                          <td className="px-5 py-3 hidden lg:table-cell text-sm text-app-text-muted">
                            {v.num_of_persons > 1 ? `${v.num_of_persons} persons` : '1 person'}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => openEdit(v)} title="Edit" className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-slate-100 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete(v.id)} title="Delete" className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="px-5 py-3 border-t border-app-border text-sm text-app-text-muted">
          {filtered.length} of {visitors.length} records
          {(dateFrom || dateTo || search) && <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }} className="ml-3 text-emerald-600 hover:underline">Clear filters</button>}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Visitor' : 'Add Visitor'} size="lg">
        <div className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Full Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Visit Date *</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Purpose</label>
              <select value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} className={`${inputCls} bg-app-surface`}>
                <option value="">Select purpose</option>
                {purposes.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                <option value="Official Visit">Official Visit</option>
                <option value="Parent / Guardian">Parent / Guardian</option>
                <option value="Delivery">Delivery</option>
                <option value="Interview">Interview</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Meeting With</label>
              <input value={form.meeting_with} onChange={e => setForm({ ...form, meeting_with: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">ID Card Type</label>
              <input value={form.id_card_type} onChange={e => setForm({ ...form, id_card_type: e.target.value })} className={inputCls} placeholder="NIN, Passport, Drivers Licence..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">ID Card Number</label>
              <input value={form.id_card_number} onChange={e => setForm({ ...form, id_card_number: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">No. of Persons</label>
              <input type="number" min={1} value={form.num_of_persons} onChange={e => setForm({ ...form, num_of_persons: parseInt(e.target.value) || 1 })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">In Time</label>
              <input type="time" value={form.in_time} onChange={e => setForm({ ...form, in_time: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Out Time</label>
              <input type="time" value={form.out_time} onChange={e => setForm({ ...form, out_time: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Note</label>
            <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : editItem ? 'Update' : 'Add Visitor'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
