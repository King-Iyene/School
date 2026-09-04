import { useEffect, useState } from 'react';
import { Plus, Search, UserCheck, UserX, CreditCard as Edit2, Eye, EyeOff, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLog';
import { useAuth } from '../../context/AuthContext';
import { Profile, UserRole } from '../../lib/types';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

const roleColors: Record<string, 'success' | 'info' | 'warning' | 'default' | 'error'> = {
  super_admin: 'error',
  admin: 'error',
  principal: 'warning',
  head_teacher: 'warning',
  teacher: 'info',
  nur_prim_teacher: 'info',
  non_teaching_staff: 'default',
  matron: 'default',
  porter: 'default',
  cleaner: 'default',
  admin_support: 'default',
  student: 'success',
  parent: 'warning',
  accountant: 'default',
  security_officer: 'info',
};

export default function Users() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', role: 'teacher' as UserRole, phone: '', gender: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { loadUsers(); }, [profile]);

  async function loadUsers() {
    if (!profile?.school_id) return;
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('school_id', profile.school_id).order('created_at', { ascending: false });
    setUsers(data ?? []);
    setLoading(false);
  }

  const filtered = users.filter(u => {
    const matchSearch = `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  function openCreate() {
    setEditUser(null);
    setForm({ first_name: '', last_name: '', email: '', role: 'teacher', phone: '', gender: '', password: '' });
    setError('');
    setShowPassword(false);
    setShowModal(true);
  }

  function openEdit(user: Profile) {
    setEditUser(user);
    setForm({ first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role, phone: user.phone || '', gender: user.gender || '', password: '' });
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      if (editUser) {
        const { error } = await supabase.rpc('update_profile', {
          p_id: editUser.id,
          p_payload: {
            first_name: form.first_name,
            last_name: form.last_name,
            role: form.role,
            phone: form.phone,
            gender: form.gender,
          }
        });
        if (error) throw error;
      } else {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.access_token) {
          throw new Error('Authentication session not found. Please log out and log in again.');
        }

        const { data, error: fnError } = await supabase.functions.invoke('create-user', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: {
            email: form.email,
            password: form.password,
            first_name: form.first_name,
            last_name: form.last_name,
            role: form.role,
            phone: form.phone,
            gender: form.gender,
            school_id: profile?.school_id,
          },
        });
        if (fnError) {
          let msg = 'Failed to create user';
          try {
            const body = await (fnError as any).context.json();
            msg = body?.error || body?.message || fnError.message || msg;
          } catch {
            msg = fnError.message || msg;
          }
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        logActivity(profile, {
          action: 'user.created',
          entityType: 'user',
          details: { name: `${form.first_name} ${form.last_name}`, role: form.role },
        });
      }
      setShowModal(false);
      loadUsers();
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    }
    setSaving(false);
  }

  async function toggleActive(user: Profile) {
    await supabase.rpc('update_profile', {
      p_id: user.id,
      p_payload: { is_active: !user.is_active }
    });
    loadUsers();
  }

  async function handleDeleteUser(user: Profile) {
    if (!confirm(`Are you sure you want to PERMANENTLY delete ${user.first_name} ${user.last_name}? This cannot be undone.`)) return;
    
    setLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        throw new Error('Authentication session not found. Please log out and log in again.');
      }
      
      const { data, error: fnError } = await supabase.functions.invoke('create-user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: { 
          action: 'delete',
          userId: user.id 
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      logActivity(profile, {
        action: 'user.deleted',
        entityType: 'user',
        entityId: user.id,
        details: { name: `${user.first_name} ${user.last_name}`, role: user.role },
      });
      loadUsers();
    } catch (e: any) {
      let errorMsg = 'Failed to delete user';
      
      if (e.context) {
        try {
          const body = await e.context.json();
          errorMsg = `[Edge Function Error]\nMsg: ${body.message || body.error || e.message}\nDetails: ${JSON.stringify(body.details || {})}\nDebug: ${JSON.stringify(body.debug || {})}`;
        } catch (jsonErr) {
          errorMsg = `[Raw Error]\n${e.message}\nStatus: ${e.status || 'unknown'}`;
        }
      } else {
        errorMsg = e.message || errorMsg;
      }
      
      setError(errorMsg);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">User Management</h2>
          <p className="text-app-text-muted text-sm">Manage all school users and their roles</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-emerald-500/20">
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm">
        <div className="p-4 border-b border-app-border flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users..."
              className="bg-app-surface text-app-text w-full pl-9 pr-4 py-2 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
            />
          </div>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 bg-app-surface"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="principal">Principal</option>
            <option value="head_teacher">Head Teacher</option>
            <option value="teacher">Teacher</option>
            <option value="nur_prim_teacher">Nur &amp; Prim Teacher</option>
            <option value="non_teaching_staff">Non-Teaching Staff</option>
            <option value="matron">Matron</option>
            <option value="porter">Porter</option>
            <option value="cleaner">Cleaner</option>
            <option value="admin_support">Admin Support</option>
            <option value="student">Student</option>
            <option value="parent">Parent</option>
            <option value="accountant">Accountant</option>
            <option value="security_officer">Security Officer</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-app-border">
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-4 py-3">Email / ID</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-4 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-4 py-3">Joined</th>
                <th className="text-right text-xs font-semibold text-app-text-muted uppercase px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-app-text-muted">Loading users...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-app-text-muted">No users found</td></tr>
              ) : filtered.map(user => (
                <tr key={user.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-app-text-muted flex-shrink-0">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-app-text">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-app-text-muted">{user.phone || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-app-text-muted">
                    {user.role === 'student' && user.admission_number ? user.admission_number : user.email}
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={user.role.replace('_', ' ')} variant={roleColors[user.role]} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={user.is_active ? 'Active' : 'Inactive'} variant={user.is_active ? 'success' : 'error'} />
                  </td>
                  <td className="px-4 py-3 text-sm text-app-text-muted">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(user)} className="p-1.5 text-app-text-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleActive(user)} className={`p-1.5 rounded-lg transition-colors ${user.is_active ? 'text-app-text-muted hover:text-red-600 hover:bg-red-50' : 'text-app-text-muted hover:text-emerald-600 hover:bg-emerald-50'}`}>
                        {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleDeleteUser(user)} className="p-1.5 text-app-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete User">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-app-border text-sm text-app-text-muted">
          Showing {filtered.length} of {users.length} users
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editUser ? 'Edit User' : 'Add New User'} size="md">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</div>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">First Name</label>
              <input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Last Name</label>
              <input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30" />
            </div>
          </div>
          {!editUser && (
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30" />
            </div>
          )}
          {!editUser && (
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Role</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value as UserRole})} className="w-full border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 bg-app-surface">
                <option value="teacher">Teacher</option>
                <option value="nur_prim_teacher">Nur &amp; Prim Teacher</option>
                <option value="non_teaching_staff">Non-Teaching Staff</option>
                <option value="matron">Matron</option>
                <option value="porter">Porter</option>
                <option value="cleaner">Cleaner</option>
                <option value="admin_support">Admin Support</option>
                <option value="head_teacher">Head Teacher</option>
                <option value="principal">Principal</option>
                <option value="parent">Parent</option>
                <option value="accountant">Accountant</option>
                <option value="security_officer">Security Officer</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Gender</label>
              <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="w-full border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 bg-app-surface">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Phone</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-app-primary hover:opacity-90 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : editUser ? 'Update User' : 'Create User'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
