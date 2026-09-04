import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, CreditCard as Edit2, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import AdmissionQueryDetail from './AdmissionQueryDetail';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  follow_up: 'bg-blue-100 text-blue-700',
  converted: 'bg-teal-100 text-teal-700',
  closed: 'bg-slate-100 text-app-text-muted',
  inactive: 'bg-amber-100 text-amber-700',
};

const emptyForm = {
  student_name: '',
  phone: '',
  email: '',
  address: '',
  source: '',
  description: '',
  status: 'active',
  next_follow_up_date: '',
  class_interested: '',
};

export default function AdmissionQuery() {
  const { profile } = useAuth();
  const [queries, setQueries] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpQueryId, setFollowUpQueryId] = useState('');
  const [followUpForm, setFollowUpForm] = useState({ note: '', next_follow_up_date: '' });
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState('');

  const [selectedQuery, setSelectedQuery] = useState<any | null>(null);

  useEffect(() => { loadAll(); }, [profile]);

  async function loadAll() {
    if (!profile?.school_id) return;
    setLoading(true);
    const [qRes, sRes] = await Promise.all([
      supabase.from('admission_queries').select('*').eq('school_id', profile.school_id).order('created_at', { ascending: false }),
      supabase.from('admin_setup').select('*').eq('school_id', profile.school_id).eq('type', 'source').order('name'),
    ]);
    setQueries(qRes.data ?? []);
    setSources(sRes.data ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditItem(null);
    setError('');
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(item: any) {
    setEditItem(item);
    setError('');
    setForm({
      student_name: item.student_name ?? '',
      phone: item.phone ?? '',
      email: item.email ?? '',
      address: item.address ?? '',
      source: item.source ?? '',
      description: item.description ?? '',
      status: item.status ?? 'active',
      next_follow_up_date: item.next_follow_up_date ?? '',
      class_interested: item.class_interested ?? '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!profile?.school_id || !form.student_name.trim()) return;
    setSaving(true);
    setError('');
    const payload = {
      student_name: form.student_name.trim(),
      phone: form.phone,
      email: form.email,
      address: form.address,
      source: form.source,
      description: form.description,
      status: form.status,
      next_follow_up_date: form.next_follow_up_date || null,
      class_interested: form.class_interested,
    };
    let res;
    if (editItem) {
      res = await supabase.from('admission_queries').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id);
    } else {
      res = await supabase.from('admission_queries').insert({ ...payload, school_id: profile.school_id });
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
    await supabase.from('admission_queries').delete().eq('id', id);
    loadAll();
  }

  function openFollowUp(queryId: string) {
    setFollowUpQueryId(queryId);
    setFollowUpForm({ note: '', next_follow_up_date: '' });
    setFollowUpError('');
    setShowFollowUpModal(true);
  }

  async function handleSaveFollowUp() {
    if (!profile?.school_id) return;
    setSavingFollowUp(true);
    setFollowUpError('');
    const res = await supabase.from('admission_followups').insert({
      query_id: followUpQueryId,
      school_id: profile.school_id,
      note: followUpForm.note,
      next_follow_up_date: followUpForm.next_follow_up_date || null,
    });
    if (res.error) {
      setFollowUpError(res.error.message);
      setSavingFollowUp(false);
      return;
    }
    await supabase.from('admission_queries').update({
      status: 'follow_up',
      next_follow_up_date: followUpForm.next_follow_up_date || null,
      updated_at: new Date().toISOString(),
    }).eq('id', followUpQueryId);
    setShowFollowUpModal(false);
    loadAll();
    setSavingFollowUp(false);
  }

  const filtered = queries.filter(q => {
    const matchSearch = !search || `${q.student_name} ${q.phone ?? ''} ${q.email ?? ''}`.toLowerCase().includes(search.toLowerCase());
    const matchSource = !filterSource || q.source === filterSource;
    const matchStatus = !filterStatus || q.status === filterStatus;
    const matchFrom = !fromDate || q.created_at >= fromDate;
    const matchTo = !toDate || q.created_at <= toDate + 'T23:59:59';
    return matchSearch && matchSource && matchStatus && matchFrom && matchTo;
  });

  const inputCls = 'bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 focus:border-emerald-400 transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">Admission Queries</h2>
          <p className="text-app-text-muted text-sm">Track and manage prospective student inquiries</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Query
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, email..."
            className="bg-app-surface text-app-text w-full pl-9 pr-4 py-2 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
          />
        </div>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none bg-app-surface">
          <option value="">All Sources</option>
          {sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none bg-app-surface">
          <option value="">All Status</option>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none" />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none" />
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-app-border bg-app-surface-alt">
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">SL</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Name</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Phone</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Source</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Query Date</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Next Follow-up</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-app-text-muted">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-app-text-muted">No queries found</td></tr>
            ) : filtered.map((q, idx) => (
              <tr
                key={q.id}
                onClick={() => setSelectedQuery(q)}
                className="hover:bg-app-surface-alt transition-colors cursor-pointer"
              >
                <td className="px-5 py-3.5 text-sm text-app-text-muted">{idx + 1}</td>
                <td className="px-5 py-3.5">
                  <span className="text-sm font-medium text-emerald-600 hover:text-emerald-700">{q.student_name}</span>
                  {q.description && (
                    <p className="text-xs text-app-text-muted mt-0.5 truncate max-w-[160px]">{q.description}</p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-sm text-app-text-muted">{q.phone || '—'}</td>
                <td className="px-5 py-3.5 text-sm text-app-text-muted">{q.source || '—'}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[q.status] ?? 'bg-slate-100 text-app-text-muted'}`}>
                    {STATUS_OPTIONS.find(o => o.value === q.status)?.label ?? q.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm text-app-text-muted">
                  {q.date ? new Date(q.date).toLocaleDateString() : new Date(q.created_at).toLocaleDateString()}
                </td>
                <td className="px-5 py-3.5 text-sm text-app-text-muted">
                  {q.next_follow_up_date
                    ? <span className="text-blue-600 font-medium">{new Date(q.next_follow_up_date).toLocaleDateString()}</span>
                    : '—'}
                </td>
                <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openFollowUp(q.id)}
                      title="Add Follow-up"
                      className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(q)}
                      title="Edit"
                      className="p-1.5 text-app-text-muted hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this query?')) handleDelete(q.id); }}
                      title="Delete"
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-app-border text-sm text-app-text-muted">
          {filtered.length} of {queries.length} {queries.length === 1 ? 'query' : 'queries'}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Admission Query' : 'Add Admission Query'} size="lg">
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Full Name <span className="text-red-500">*</span></label>
              <input value={form.student_name} onChange={e => setForm({ ...form, student_name: e.target.value })} className={inputCls} placeholder="Applicant's full name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputCls} placeholder="+1 234 567 8900" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Source</label>
              <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className={`${inputCls} bg-app-surface`}>
                <option value="">Select source</option>
                {sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Address</label>
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls} placeholder="Home or city address" />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Class Interested</label>
              <input value={form.class_interested} onChange={e => setForm({ ...form, class_interested: e.target.value })} className={inputCls} placeholder="e.g. Grade 5, JSS 1" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Notes / Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Add any relevant notes, inquiry details, or description about this query..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={`${inputCls} bg-app-surface`}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Next Follow-up Date</label>
              <input type="date" value={form.next_follow_up_date} onChange={e => setForm({ ...form, next_follow_up_date: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.student_name.trim()}
              className="flex-1 px-4 py-2.5 bg-app-primary hover:opacity-90 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : editItem ? 'Update Query' : 'Add Query'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showFollowUpModal} onClose={() => setShowFollowUpModal(false)} title="Add Follow-up" size="md">
        <div className="space-y-4">
          {followUpError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{followUpError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Note <span className="text-red-500">*</span></label>
            <textarea
              value={followUpForm.note}
              onChange={e => setFollowUpForm({ ...followUpForm, note: e.target.value })}
              rows={4}
              className={`${inputCls} resize-none`}
              placeholder="Describe the follow-up conversation, outcome, or next steps..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Next Follow-up Date</label>
            <input
              type="date"
              value={followUpForm.next_follow_up_date}
              onChange={e => setFollowUpForm({ ...followUpForm, next_follow_up_date: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowFollowUpModal(false)} className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSaveFollowUp}
              disabled={savingFollowUp || !followUpForm.note.trim()}
              className="flex-1 px-4 py-2.5 bg-app-primary hover:opacity-90 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {savingFollowUp ? 'Saving...' : 'Add Follow-up'}
            </button>
          </div>
        </div>
      </Modal>

      <AdmissionQueryDetail
        query={selectedQuery}
        onClose={() => setSelectedQuery(null)}
        onEdit={q => { setSelectedQuery(null); openEdit(q); }}
        onDelete={handleDelete}
        onAddFollowUp={queryId => { setSelectedQuery(null); openFollowUp(queryId); }}
      />
    </div>
  );
}
