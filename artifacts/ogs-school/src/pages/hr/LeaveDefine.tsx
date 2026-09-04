import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface LeaveType {
  id: string;
  name: string;
}

interface AcademicYear {
  id: string;
  name: string;
}

interface LeaveAllocation {
  id: string;
  role: string;
  leave_type_id: string;
  days_allocated: number;
  academic_year_id: string;
  leave_types?: { name: string };
  academic_years?: { name: string };
}

const ROLES = ['super_admin', 'teacher', 'accountant', 'staff'];

const inputClass =
  'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

export default function LeaveDefine() {
  const { profile } = useAuth();
  const [allocations, setAllocations] = useState<LeaveAllocation[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveAllocation | null>(null);
  const [deleting, setDeleting] = useState<LeaveAllocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    role: '',
    leave_type_id: '',
    days_allocated: '',
    academic_year_id: '',
  });

  const fetchData = async () => {
    setLoading(true);
    const [allocRes, ltRes, ayRes] = await Promise.all([
      supabase
        .from('leave_allocations')
        .select('*, leave_types(name), academic_years(name)')
        .order('role'),
      supabase.from('leave_types').select('id, name').order('name'),
      supabase.from('academic_years').select('id, name').order('name'),
    ]);
    if (allocRes.data) setAllocations(allocRes.data);
    if (ltRes.data) setLeaveTypes(ltRes.data);
    if (ayRes.data) setAcademicYears(ayRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ role: '', leave_type_id: '', days_allocated: '', academic_year_id: '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (a: LeaveAllocation) => {
    setEditing(a);
    setForm({
      role: a.role,
      leave_type_id: a.leave_type_id,
      days_allocated: String(a.days_allocated),
      academic_year_id: a.academic_year_id,
    });
    setError('');
    setModalOpen(true);
  };

  const openDelete = (a: LeaveAllocation) => {
    setDeleting(a);
    setDeleteModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.role) { setError('Role is required.'); return; }
    if (!form.leave_type_id) { setError('Leave type is required.'); return; }
    if (!form.days_allocated || isNaN(Number(form.days_allocated))) { setError('Days allocated must be a number.'); return; }
    if (!form.academic_year_id) { setError('Academic year is required.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      role: form.role,
      leave_type_id: form.leave_type_id,
      days_allocated: Number(form.days_allocated),
      academic_year_id: form.academic_year_id,
      school_id: profile?.school_id,
    };
    if (editing) {
      const { error: err } = await supabase.from('leave_allocations').update(payload).eq('id', editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('leave_allocations').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await supabase.from('leave_allocations').delete().eq('id', deleting.id);
    setDeleteModalOpen(false);
    setDeleting(null);
    fetchData();
  };

  const roleBadgeClass = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-purple-100 text-purple-700';
      case 'teacher': return 'bg-blue-100 text-blue-700';
      case 'accountant': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-app-text-muted';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-app-text">Leave Define</h1>
        <button
          onClick={openAdd}
          className="bg-app-primary hover:opacity-90 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          + Add Allocation
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : allocations.length === 0 ? (
        <div className="text-center py-16 text-app-text-muted text-sm">No leave allocations found. Add your first allocation.</div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-app-surface-alt border-b border-app-border">
              <tr>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Role</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Leave Type</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Days Allocated</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Academic Year</th>
                <th className="text-right px-5 py-3.5 font-semibold text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {allocations.map((a) => (
                <tr key={a.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${roleBadgeClass(a.role)}`}>
                      {a.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-app-text">{a.leave_types?.name || '-'}</td>
                  <td className="px-5 py-3.5 text-app-text">{a.days_allocated}</td>
                  <td className="px-5 py-3.5 text-app-text">{a.academic_years?.name || '-'}</td>
                  <td className="px-5 py-3.5 text-right space-x-2">
                    <button
                      onClick={() => openEdit(a)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDelete(a)}
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Allocation' : 'Add Allocation'}>
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1.5">Role</label>
            <select
              className={inputClass}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="">Select role...</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
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
          <div>
            <label className="block text-sm font-medium text-app-text mb-1.5">Days Allocated</label>
            <input
              type="number"
              className={inputClass}
              placeholder="e.g. 12"
              value={form.days_allocated}
              onChange={(e) => setForm({ ...form, days_allocated: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1.5">Academic Year</label>
            <select
              className={inputClass}
              value={form.academic_year_id}
              onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
            >
              <option value="">Select academic year...</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>{ay.name}</option>
              ))}
            </select>
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

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Allocation">
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">
            Are you sure you want to delete this leave allocation? This action cannot be undone.
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
