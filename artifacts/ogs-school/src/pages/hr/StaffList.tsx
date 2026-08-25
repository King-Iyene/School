import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import { navigate } from '../../components/hooks/useLocation';
import { Eye, EyeOff } from 'lucide-react';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  phone?: string;
  basic_salary?: number;
  address?: string;
  date_of_birth?: string;
  join_date?: string;
  gender?: string;
  is_active?: boolean;
}

const ROLES = ['accountant', 'admin', 'admin_support', 'cleaner', 'head_teacher', 'matron', 'non_teaching_staff', 'nur_prim_teacher', 'porter', 'principal', 'security_officer', 'super_admin', 'teacher'];

const inputClass =
  'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

function roleBadge(role: string) {
  switch (role) {
    case 'super_admin': return 'bg-purple-100 text-purple-700';
    case 'teacher': return 'bg-blue-100 text-blue-700';
    case 'accountant': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function getInitials(p: Profile) {
  return `${(p.first_name || '?')[0]}${(p.last_name || '?')[0]}`.toUpperCase();
}

function avatarColor(role: string) {
  switch (role) {
    case 'super_admin': return 'bg-purple-100 text-purple-600';
    case 'teacher': return 'bg-blue-100 text-blue-600';
    case 'accountant': return 'bg-amber-100 text-amber-600';
    default: return 'bg-slate-100 text-slate-600';
  }
}

export default function StaffList() {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [addForm, setAddForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: '',
    phone: '',
    basic_salary: '',
    password: '',
  });

  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    role: '',
    phone: '',
    basic_salary: '',
  });

  const fetchStaff = async () => {
    if (!profile?.school_id) return;
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('*')
      .eq('school_id', profile.school_id)
      .not('role', 'in', '("student","parent","diocesan_official")')
      .order('first_name');
    if (filterRole) query = query.eq('role', filterRole);
    if (filterStatus === 'active') query = query.eq('is_active', true);
    if (filterStatus === 'inactive') query = query.eq('is_active', false);
    const { data } = await query;
    if (data) setStaff(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
  }, [filterRole, filterStatus]);

  const openAdd = () => {
    setAddForm({ first_name: '', last_name: '', email: '', role: '', phone: '', basic_salary: '', password: '' });
    setError('');
    setShowPassword(false);
    setAddModalOpen(true);
  };

  const openEdit = (p: Profile) => {
    setSelected(p);
    setEditForm({
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      role: p.role || '',
      phone: p.phone || '',
      basic_salary: p.basic_salary != null ? String(p.basic_salary) : '',
    });
    setError('');
    setEditModalOpen(true);
  };


  const openDelete = (p: Profile) => {
    setSelected(p);
    setDeleteModalOpen(true);
  };

  const openDeactivate = (p: Profile) => {
    setSelected(p);
    setError('');
    setDeactivateModalOpen(true);
  };

  const handleToggleActive = async () => {
    if (!selected) return;
    const newStatus = !(selected.is_active ?? true);
    setSaving(true);
    setError('');
    const { error: err } = await supabase.rpc('update_profile', {
      p_id: selected.id,
      p_payload: { is_active: newStatus }
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setDeactivateModalOpen(false);
    setSelected(null);
    fetchStaff();
  };

  const handleAdd = async () => {
    if (!addForm.first_name.trim()) { setError('First name is required.'); return; }
    if (!addForm.last_name.trim()) { setError('Last name is required.'); return; }
    if (!addForm.email.trim()) { setError('Email is required.'); return; }
    if (!addForm.role) { setError('Role is required.'); return; }
    setSaving(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication session not found. Please log out and log in again.');
      }

      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('create-user', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: {
          email: addForm.email.trim(),
          first_name: addForm.first_name.trim(),
          last_name: addForm.last_name.trim(),
          role: addForm.role,
          phone: addForm.phone.trim() || '',
          password: addForm.password.trim(),
          school_id: profile?.school_id,
        }
      });

      if (edgeError) throw edgeError;
      if (!edgeData?.user) throw new Error(edgeData?.error || 'Failed to create staff account');

      const userId = edgeData.user.id;

        await supabase.rpc('update_profile', {
          p_id: userId,
          p_payload: { basic_salary: Number(addForm.basic_salary) }
        });

      setSaving(false);
      setAddModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selected) return;
    if (!editForm.first_name.trim()) { setError('First name is required.'); return; }
    if (!editForm.last_name.trim()) { setError('Last name is required.'); return; }
    setSaving(true);
    setError('');
    const payload: Partial<Profile> = {
      first_name: editForm.first_name.trim(),
      last_name: editForm.last_name.trim(),
      role: editForm.role || undefined,
      phone: editForm.phone.trim() || undefined,
      basic_salary: editForm.basic_salary ? Number(editForm.basic_salary) : undefined,
    };
    const { error: err } = await supabase.rpc('update_profile', {
      p_id: selected.id,
      p_payload: payload
    });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    setEditModalOpen(false);
    fetchStaff();
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profileExists } = await supabase.from('profiles').select('id').eq('id', selected.id).maybeSingle();
      if (profileExists && session?.access_token) {
        await supabase.functions.invoke('create-user', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: { action: 'delete', userId: selected.id },
        });
      } else {
        await supabase.from('profiles').delete().eq('id', selected.id);
      }
    } catch (err: any) {
      alert('Error deleting staff: ' + err.message);
    }
    setDeleteModalOpen(false);
    setSelected(null);
    fetchStaff();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Staff List</h1>
        <div className="flex items-center gap-3">
          <select
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
          </select>
          <button
            onClick={openAdd}
            className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            + Add Staff
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">No staff members found.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Name</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Email</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Role</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Phone</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Status</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(p.role)}`}>
                        {getInitials(p)}
                      </div>
                      <span className="font-medium text-slate-800">
                        {`${p.first_name || ''} ${p.last_name || ''}`.trim() || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{p.email || '-'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${roleBadge(p.role)}`}>
                      {p.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{p.phone || '-'}</td>
                  <td className="px-5 py-3.5">
                    {(p.is_active ?? true) ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        Deactivated
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => navigate(`/teacher-profile?id=${p.id}`)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      View Profile
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDeactivate(p)}
                      className={`font-medium text-xs px-3 py-1.5 rounded-lg transition-colors ${(p.is_active ?? true) ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}`}
                    >
                      {(p.is_active ?? true) ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => openDelete(p)}
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

      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Staff">
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name</label>
              <input className={inputClass} placeholder="First name" value={addForm.first_name} onChange={(e) => setAddForm({ ...addForm, first_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label>
              <input className={inputClass} placeholder="Last name" value={addForm.last_name} onChange={(e) => setAddForm({ ...addForm, last_name: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input type="email" className={inputClass} placeholder="Email address" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className={inputClass}
                placeholder="Set initial password"
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
            <select className={inputClass} value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}>
              <option value="">Select role...</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
            <input className={inputClass} placeholder="Phone number" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Basic Salary</label>
            <input type="number" className={inputClass} placeholder="e.g. 5000" value={addForm.basic_salary} onChange={(e) => setAddForm({ ...addForm, basic_salary: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAddModalOpen(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors disabled:opacity-60">
              {saving ? 'Adding...' : 'Add Staff'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Staff">
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name</label>
              <input className={inputClass} placeholder="First name" value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label>
              <input className={inputClass} placeholder="Last name" value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
            <select className={inputClass} value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
              <option value="">Select role...</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
            <input className={inputClass} placeholder="Phone number" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Basic Salary</label>
            <input type="number" className={inputClass} placeholder="e.g. 5000" value={editForm.basic_salary} onChange={(e) => setEditForm({ ...editForm, basic_salary: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditModalOpen(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleEdit} disabled={saving} className="px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={viewModalOpen} onClose={() => setViewModalOpen(false)} title="Staff Details">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${avatarColor(selected.role)}`}>
                {getInitials(selected)}
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-800">{`${selected.first_name || ''} ${selected.last_name || ''}`.trim()}</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${roleBadge(selected.role)}`}>
                  {selected.role.replace('_', ' ')}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Email', value: selected.email },
                { label: 'Phone', value: selected.phone },
                { label: 'Basic Salary', value: selected.basic_salary != null ? `$${selected.basic_salary.toLocaleString()}` : undefined },
                { label: 'Date of Birth', value: selected.date_of_birth },
                { label: 'Join Date', value: selected.join_date },
                { label: 'Gender', value: selected.gender },
                { label: 'Address', value: selected.address },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                  <p className="font-medium text-slate-700">{value || '-'}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setViewModalOpen(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Close</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={deactivateModalOpen} onClose={() => setDeactivateModalOpen(false)} title={selected && (selected.is_active ?? true) ? 'Deactivate Staff' : 'Activate Staff'}>
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
          )}
          {selected && (selected.is_active ?? true) ? (
            <p className="text-sm text-slate-600">
              Deactivate <span className="font-semibold text-slate-800">{`${selected.first_name} ${selected.last_name}`}</span>? They will be unable to sign in until reactivated. Their data will be preserved.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Reactivate <span className="font-semibold text-slate-800">{selected ? `${selected.first_name} ${selected.last_name}` : ''}</span>? They will be able to sign in again immediately.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeactivateModalOpen(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button
              onClick={handleToggleActive}
              disabled={saving}
              className={`px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-60 ${selected && (selected.is_active ?? true) ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
            >
              {saving ? 'Saving...' : (selected && (selected.is_active ?? true) ? 'Deactivate' : 'Activate')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Staff">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <span className="font-semibold text-slate-800">{selected ? `${selected.first_name} ${selected.last_name}` : ''}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteModalOpen(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
