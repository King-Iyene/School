import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface LeaveType {
  id: string;
  name: string;
  total_days: number;
  is_paid: boolean;
  description: string;
}

const inputClass =
  'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

export default function LeaveType() {
  const { profile } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [deleting, setDeleting] = useState<LeaveType | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    total_days: '',
    is_paid: false,
    description: '',
  });
  const [error, setError] = useState('');

  const fetchLeaveTypes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .order('name');
    if (!error && data) setLeaveTypes(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', total_days: '', is_paid: false, description: '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (lt: LeaveType) => {
    setEditing(lt);
    setForm({
      name: lt.name,
      total_days: String(lt.total_days),
      is_paid: lt.is_paid,
      description: lt.description || '',
    });
    setError('');
    setModalOpen(true);
  };

  const openDelete = (lt: LeaveType) => {
    setDeleting(lt);
    setDeleteModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.total_days || isNaN(Number(form.total_days))) { setError('Total days must be a number.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      total_days: Number(form.total_days),
      is_paid: form.is_paid,
      description: form.description.trim(),
      school_id: profile?.school_id,
    };
    if (editing) {
      const { error: err } = await supabase.from('leave_types').update(payload).eq('id', editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('leave_types').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchLeaveTypes();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error: err } = await supabase.from('leave_types').delete().eq('id', deleting.id);
    if (!err) {
      setDeleteModalOpen(false);
      setDeleting(null);
      fetchLeaveTypes();
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-app-text">Leave Type</h1>
        <button
          onClick={openAdd}
          className="bg-app-primary hover:opacity-90 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          + Add Leave Type
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : leaveTypes.length === 0 ? (
        <div className="text-center py-16 text-app-text-muted text-sm">No leave types found. Add your first leave type.</div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-app-surface-alt border-b border-app-border">
              <tr>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Name</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Total Days</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Type</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Description</th>
                <th className="text-right px-5 py-3.5 font-semibold text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {leaveTypes.map((lt) => (
                <tr key={lt.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-5 py-3.5 font-medium text-app-text">{lt.name}</td>
                  <td className="px-5 py-3.5 text-app-text-muted">{lt.total_days}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        lt.is_paid
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-app-text-muted'
                      }`}
                    >
                      {lt.is_paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-app-text-muted max-w-xs truncate">{lt.description || '-'}</td>
                  <td className="px-5 py-3.5 text-right space-x-2">
                    <button
                      onClick={() => openEdit(lt)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDelete(lt)}
                      className="text-red-500 hover:text-red-600 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Leave Type' : 'Add Leave Type'}>
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1.5">Name</label>
            <input
              className={inputClass}
              placeholder="e.g. Annual Leave"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1.5">Total Days</label>
            <input
              type="number"
              className={inputClass}
              placeholder="e.g. 14"
              value={form.total_days}
              onChange={(e) => setForm({ ...form, total_days: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              id="is_paid"
              type="checkbox"
              className="w-4 h-4 accent-emerald-500"
              checked={form.is_paid}
              onChange={(e) => setForm({ ...form, is_paid: e.target.checked })}
            />
            <label htmlFor="is_paid" className="text-sm font-medium text-app-text">Paid Leave</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1.5">Description</label>
            <textarea
              className={inputClass}
              placeholder="Optional description..."
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
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
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Leave Type">
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">
            Are you sure you want to delete <span className="font-semibold text-app-text">{deleting?.name}</span>? This action cannot be undone.
          </p>
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
