import { useState, useEffect } from 'react';
import { CreditCard as Edit2, Trash2, Plus, CalendarDays } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface LeaveType {
  id: string;
  name: string;
}

interface LeaveApplication {
  id: string;
  staff_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  leave_types?: { name: string };
}

const inputClass =
  'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

function calcDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const d1 = new Date(from);
  const d2 = new Date(to);
  if (d2 < d1) return 0;
  return Math.floor((d2.getTime() - d1.getTime()) / 86400000) + 1;
}

function statusBadge(status: string) {
  switch (status) {
    case 'approved': return 'bg-emerald-100 text-emerald-700';
    case 'rejected': return 'bg-red-100 text-red-600';
    default: return 'bg-amber-100 text-amber-700';
  }
}

export default function ApplyLeave() {
  const { user, profile } = useAuth();
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveApplication | null>(null);
  const [deleting, setDeleting] = useState<LeaveApplication | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    leave_type_id: '',
    from_date: '',
    to_date: '',
    reason: '',
  });

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [appRes, ltRes] = await Promise.all([
      supabase
        .from('leave_applications')
        .select('*, leave_types(name)')
        .eq('staff_id', user.id)
        .order('from_date', { ascending: false }),
      supabase.from('leave_types').select('id, name').order('name'),
    ]);
    if (appRes.data) setApplications(appRes.data);
    if (ltRes.data) setLeaveTypes(ltRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const openAdd = () => {
    setEditing(null);
    setForm({ leave_type_id: '', from_date: '', to_date: '', reason: '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (a: LeaveApplication) => {
    if (a.status !== 'pending') return;
    setEditing(a);
    setForm({
      leave_type_id: a.leave_type_id,
      from_date: a.from_date,
      to_date: a.to_date,
      reason: a.reason || '',
    });
    setError('');
    setModalOpen(true);
  };

  const openDelete = (a: LeaveApplication) => {
    setDeleting(a);
    setDeleteModalOpen(true);
  };

  const days = calcDays(form.from_date, form.to_date);

  const handleSave = async () => {
    if (!form.leave_type_id) { setError('Please select a leave type.'); return; }
    if (!form.from_date) { setError('From date is required.'); return; }
    if (!form.to_date) { setError('To date is required.'); return; }
    if (days <= 0) { setError('To date must be on or after from date.'); return; }
    if (!form.reason.trim()) { setError('Reason is required.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      staff_id: user!.id,
      leave_type_id: form.leave_type_id,
      from_date: form.from_date,
      to_date: form.to_date,
      days,
      reason: form.reason.trim(),
      status: 'pending' as const,
      school_id: profile?.school_id,
    };
    if (editing) {
      const { error: err } = await supabase.from('leave_applications').update(payload).eq('id', editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('leave_applications').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('leave_applications').delete().eq('id', deleting.id);
    if (error) {
      alert(`Error deleting leave: ${error.message}`);
    } else {
      setDeleteModalOpen(false);
      setDeleting(null);
      fetchData();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">Apply Leave</h2>
          <p className="text-app-text-muted text-sm hidden sm:block">Submit and manage your leave applications</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white text-sm font-medium px-3 sm:px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Apply Leave</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm text-center py-16 text-app-text-muted text-sm">
          <CalendarDays className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          No leave applications found.
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm">
          <div className="overflow-x-auto rounded-2xl">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-app-surface-alt border-b border-app-border">
              <tr>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Leave Type</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">From</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">To</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Days</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Status</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Reason</th>
                <th className="text-right px-5 py-3.5 font-semibold text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {applications.map((a) => (
                <tr key={a.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-5 py-3.5 font-medium text-app-text">{a.leave_types?.name || '-'}</td>
                  <td className="px-5 py-3.5 text-app-text-muted">{a.from_date}</td>
                  <td className="px-5 py-3.5 text-app-text-muted">{a.to_date}</td>
                  <td className="px-5 py-3.5 text-app-text-muted">{a.days}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(a.status)}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-app-text-muted max-w-xs truncate">{a.reason}</td>
                  <td className="px-5 py-3.5 text-right space-x-2 whitespace-nowrap">
                    {a.status === 'pending' && (
                      <button
                        onClick={() => openEdit(a)}
                        className="text-emerald-600 hover:text-emerald-700 p-1.5 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => openDelete(a)}
                      className="text-red-500 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Leave Application' : 'Apply Leave'}>
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1.5">Leave Type</label>
            <select
              className={inputClass}
              value={form.leave_type_id}
              onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}
            >
              <option value="">Select leave type...</option>
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>{lt.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1.5">From Date</label>
              <input
                type="date"
                className={inputClass}
                value={form.from_date}
                onChange={(e) => setForm({ ...form, from_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1.5">To Date</label>
              <input
                type="date"
                className={inputClass}
                value={form.to_date}
                onChange={(e) => setForm({ ...form, to_date: e.target.value })}
              />
            </div>
          </div>
          {form.from_date && form.to_date && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-sm text-emerald-700">
              Total days: <span className="font-semibold">{days}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1.5">Reason</label>
            <textarea
              className={inputClass}
              placeholder="Reason for leave..."
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 text-sm font-medium text-app-text-muted hover:text-app-text border border-app-border rounded-xl hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2.5 text-sm font-medium text-white bg-app-primary hover:opacity-90 rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Application">
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">Are you sure you want to delete this leave application? This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2.5 text-sm font-medium text-app-text-muted hover:text-app-text border border-app-border rounded-xl hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
