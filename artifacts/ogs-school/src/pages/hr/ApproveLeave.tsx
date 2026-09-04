import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

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
  remarks?: string;
  leave_types?: { name: string };
  profiles?: Profile;
}

function calcDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const d1 = new Date(from);
  const d2 = new Date(to);
  if (d2 < d1) return 0;
  return Math.floor((d2.getTime() - d1.getTime()) / 86400000) + 1;
}

const inputClass =
  'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

function statusBadge(status: string) {
  switch (status) {
    case 'approved': return 'bg-emerald-100 text-emerald-700';
    case 'rejected': return 'bg-red-100 text-red-600';
    default: return 'bg-amber-100 text-amber-700';
  }
}

function roleBadge(role: string) {
  switch (role) {
    case 'super_admin': return 'bg-purple-100 text-purple-700';
    case 'teacher': return 'bg-blue-100 text-blue-700';
    case 'accountant': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-app-text-muted';
  }
}

export default function ApproveLeave() {
  const { } = useAuth();
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selected, setSelected] = useState<LeaveApplication | null>(null);
  const [deleting, setDeleting] = useState<LeaveApplication | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionForm, setActionForm] = useState({ 
    status: 'pending', 
    remarks: '',
    leave_type_id: '',
    from_date: '',
    to_date: '',
    reason: '',
  });

  const fetchData = async () => {
    setLoading(true);
    const [appRes, ltRes] = await Promise.all([
      supabase
        .from('leave_applications')
        .select('*, leave_types(name), profiles!staff_id(id, first_name, last_name, role)')
        .order('from_date', { ascending: false }),
      supabase.from('leave_types').select('id, name').order('name'),
    ]);
    
    if (appRes.data) {
      let filtered = appRes.data;
      if (filterStatus) filtered = filtered.filter(a => a.status === filterStatus);
      setApplications(filtered);
    }
    if (ltRes.data) setLeaveTypes(ltRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const openAction = (a: LeaveApplication) => {
    setSelected(a);
    setActionForm({ 
      status: a.status, 
      remarks: a.remarks || '',
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

  const days = calcDays(actionForm.from_date, actionForm.to_date);

  const handleSave = async () => {
    if (!selected) return;
    if (!actionForm.from_date || !actionForm.to_date || days <= 0) {
      setError('Please provide valid dates.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('leave_applications')
      .update({ 
        status: actionForm.status, 
        remarks: actionForm.remarks,
        leave_type_id: actionForm.leave_type_id,
        from_date: actionForm.from_date,
        to_date: actionForm.to_date,
        days: days,
        reason: actionForm.reason,
      })
      .eq('id', selected.id);
    setSaving(false);
    if (!err) {
      setModalOpen(false);
      fetchData();
    } else {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await supabase.from('leave_applications').delete().eq('id', deleting.id);
    setDeleteModalOpen(false);
    setDeleting(null);
    fetchData();
  };

  const staffName = (a: LeaveApplication) =>
    a.profiles ? `${a.profiles.first_name || ''} ${a.profiles.last_name || ''}`.trim() || 'Unknown' : 'Unknown';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-app-text">Approve Leave Request</h1>
        <div className="flex items-center gap-3">
          <select
            className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-16 text-app-text-muted text-sm">No leave applications found.</div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-app-surface-alt border-b border-app-border">
              <tr>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Staff</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Role</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Leave Type</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">From</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">To</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Days</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Reason</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Status</th>
                <th className="text-right px-5 py-3.5 font-semibold text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {applications.map((a) => (
                <tr key={a.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-5 py-3.5 font-medium text-app-text whitespace-nowrap">{staffName(a)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${roleBadge(a.profiles?.role || '')}`}>
                      {(a.profiles?.role || '-').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-app-text whitespace-nowrap">{a.leave_types?.name || '-'}</td>
                  <td className="px-5 py-3.5 text-app-text-muted whitespace-nowrap">{a.from_date}</td>
                  <td className="px-5 py-3.5 text-app-text-muted whitespace-nowrap">{a.to_date}</td>
                  <td className="px-5 py-3.5 text-app-text-muted">{a.days}</td>
                  <td className="px-5 py-3.5 text-app-text-muted max-w-xs truncate">{a.reason}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(a.status)}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => openAction(a)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      Review
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Manage Leave Application">
        {selected && (
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
            )}
            <div className="bg-app-surface-alt rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-app-text-muted">Staff Member</span>
                <span className="font-medium text-app-text">{staffName(selected)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-app-text mb-1.5">Leave Type</label>
                <select
                  className={inputClass}
                  value={actionForm.leave_type_id}
                  onChange={(e) => setActionForm({ ...actionForm, leave_type_id: e.target.value })}
                >
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-2.5 px-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-semibold">
                Total: {days} days
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-app-text mb-1.5">From Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={actionForm.from_date}
                  onChange={(e) => setActionForm({ ...actionForm, from_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-text mb-1.5">To Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={actionForm.to_date}
                  onChange={(e) => setActionForm({ ...actionForm, to_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-app-text mb-1.5">Reason</label>
              <textarea
                className={inputClass}
                rows={2}
                value={actionForm.reason}
                onChange={(e) => setActionForm({ ...actionForm, reason: e.target.value })}
              />
            </div>

            <div className="border-t border-app-border pt-4 mt-2">
              <label className="block text-sm font-medium text-app-text mb-1.5">Administrative Status</label>
              <div className="grid grid-cols-3 gap-2">
                {['pending', 'approved', 'rejected'].map(s => (
                  <button
                    key={s}
                    onClick={() => setActionForm({ ...actionForm, status: s as any })}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize border transition-all ${
                      actionForm.status === s 
                        ? 'bg-slate-800 border-slate-800 text-white shadow-sm' 
                        : 'bg-app-surface border-app-border text-app-text-muted hover:bg-app-surface-alt'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-app-text mb-1.5">Admin Remarks</label>
              <textarea
                className={inputClass}
                placeholder="Add remarks for the staff member..."
                rows={2}
                value={actionForm.remarks}
                onChange={(e) => setActionForm({ ...actionForm, remarks: e.target.value })}
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
                className="px-4 py-2.5 text-sm font-medium text-white bg-app-primary hover:opacity-90 rounded-xl shadow-sm transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Update & Save'}
              </button>
            </div>
          </div>
        )}
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
