import { useState, useEffect } from 'react';
import { Users, Activity, Clock, Search, Download, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface UserRecord {
  id: string;
  full_name: string;
  email: string;
  role: string;
  updated_at: string;
  created_at: string;
}

export default function UserLog() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    role: '',
    search: '',
  });

  useEffect(() => {
    fetchUsers();
  }, [filters.date_from, filters.date_to, filters.role]);

  async function fetchUsers() {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, role, updated_at, created_at')
      .eq('school_id', profile?.school_id)
      .order('updated_at', { ascending: false });

    if (filters.role) query = query.eq('role', filters.role);
    if (filters.date_from) query = query.gte('updated_at', filters.date_from);
    if (filters.date_to) query = query.lte('updated_at', filters.date_to + 'T23:59:59');

    const { data } = await query;
    setUsers(data || []);
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const filteredUsers = users.filter(u =>
    filters.search === '' ||
    u.full_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
    u.email?.toLowerCase().includes(filters.search.toLowerCase())
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const activeTodayCount = filteredUsers.filter(u => u.updated_at && new Date(u.updated_at) >= today).length;
  const inactiveCount = filteredUsers.filter(u => !u.updated_at || new Date(u.updated_at) < thirtyDaysAgo).length;

  function getRoleBadge(role: string) {
    const colorMap: Record<string, string> = {
      super_admin: 'bg-purple-100 text-purple-700',
      admin: 'bg-indigo-100 text-indigo-700',
      teacher: 'bg-blue-100 text-blue-700',
      student: 'bg-emerald-100 text-emerald-700',
      parent: 'bg-amber-100 text-amber-700',
      accountant: 'bg-orange-100 text-orange-700',
    };
    const cls = colorMap[role] || 'bg-slate-100 text-app-text';
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${cls}`}>
        {role?.replace('_', ' ')}
      </span>
    );
  }

  function getActivityStatus(updatedAt: string) {
    if (!updatedAt) return <span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-app-text-muted">Never</span>;
    const date = new Date(updatedAt);
    if (date >= today) return <span className="px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700 font-medium">Today</span>;
    if (date >= thirtyDaysAgo) return <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">Active</span>;
    return <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">Inactive</span>;
  }

  return (
    <div className="space-y-6">
      {showToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <CheckCircle className="h-5 w-5" />
          <span>Report exported successfully!</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-text">User Activity Log</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-app-text-muted mb-1">From Date</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
              className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs text-app-text-muted mb-1">To Date</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
              className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={filters.role}
            onChange={e => setFilters(f => ({ ...f, role: e.target.value }))}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 self-end"
          >
            <option value="">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
            <option value="parent">Parent</option>
            <option value="accountant">Accountant</option>
          </select>

          <div className="relative self-end">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-text-muted" />
            <input
              type="text"
              placeholder="Search user..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="w-full border border-app-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Active Today</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{activeTodayCount}</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-lg">
              <Activity className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Total Users</p>
              <p className="text-2xl font-bold text-app-text mt-1">{filteredUsers.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Inactive (30+ Days)</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{inactiveCount}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <Clock className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt border-b border-app-border">
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">#</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Date / Time</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">User Name</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Role</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Email</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Last Activity</th>
                <th className="text-center px-4 py-3 text-app-text-muted font-medium">Status</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-app-text-muted">Loading...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-app-text-muted">No users found</td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => (
                  <tr key={user.id} className="border-b border-app-border hover:bg-app-surface-alt">
                    <td className="px-4 py-3 text-app-text-muted">{index + 1}</td>
                    <td className="px-4 py-3 text-app-text-muted text-xs">
                      {user.updated_at ? new Date(user.updated_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 font-medium text-app-text">{user.full_name}</td>
                    <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                    <td className="px-4 py-3 text-app-text-muted">{user.email || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted text-xs">
                      {user.updated_at ? new Date(user.updated_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getActivityStatus(user.updated_at)}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted text-xs">N/A</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
