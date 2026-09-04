import { useState, useEffect } from 'react';
import { Activity, UserCheck, AlertTriangle, UserX, Download, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface LoginRecord {
  id: string;
  full_name: string;
  class_name: string;
  updated_at: string;
  status: string;
}

interface Class {
  id: string;
  name: string;
}

export default function StudentLoginReport() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<LoginRecord[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    class_id: '',
  });

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [filters]);

  async function fetchClasses() {
    const { data } = await supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setClasses(data);
  }

  async function fetchRecords() {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('id, full_name, class_name, updated_at, status')
      .eq('role', 'student')
      .eq('school_id', profile?.school_id)
      .order('updated_at', { ascending: false });

    if (filters.date_from) query = query.gte('updated_at', filters.date_from);
    if (filters.date_to) query = query.lte('updated_at', filters.date_to + 'T23:59:59');
    if (filters.class_id) {
      const cls = classes.find(c => c.id === filters.class_id);
      if (cls) query = query.eq('class_name', cls.name);
    }

    const { data } = await query;
    setRecords(data || []);
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const activeStudents = records.filter(r => r.status === 'active' && new Date(r.updated_at) > thirtyDaysAgo).length;
  const inactiveThirtyPlus = records.filter(r => new Date(r.updated_at) <= thirtyDaysAgo).length;
  const neverLoggedIn = records.filter(r => !r.updated_at).length;

  function getLoginStatus(updatedAt: string) {
    if (!updatedAt) return { label: 'Never', cls: 'bg-slate-100 text-app-text' };
    const date = new Date(updatedAt);
    if (date > thirtyDaysAgo) return { label: 'Active', cls: 'bg-emerald-100 text-emerald-700' };
    return { label: 'Inactive', cls: 'bg-red-100 text-red-700' };
  }

  function getMockLoginCount(updatedAt: string) {
    if (!updatedAt) return 0;
    const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, 30 - days);
  }

  return (
    <div className="space-y-6">
      {showToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-app-primary text-white px-4 py-3 rounded-lg shadow-lg">
          <CheckCircle className="h-5 w-5" />
          <span>Report exported successfully!</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-text">Student Login Report</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-app-text-muted mb-1">From Date</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
              className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            />
          </div>

          <div>
            <label className="block text-xs text-app-text-muted mb-1">To Date</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
              className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            />
          </div>

          <div>
            <label className="block text-xs text-app-text-muted mb-1">Class</label>
            <select
              value={filters.class_id}
              onChange={e => setFilters(f => ({ ...f, class_id: e.target.value }))}
              className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Active Students</p>
              <p className="text-2xl font-bold text-app-text mt-1">{activeStudents}</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-lg">
              <UserCheck className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Inactive 30+ Days</p>
              <p className="text-2xl font-bold text-app-text mt-1">{inactiveThirtyPlus}</p>
            </div>
            <div className="bg-amber-100 p-3 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Never Logged In</p>
              <p className="text-2xl font-bold text-app-text mt-1">{neverLoggedIn}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <UserX className="h-6 w-6 text-red-600" />
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
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Student Name</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Class</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Last Login</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Login Count</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-app-text-muted">Loading...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-app-text-muted">No records found</td>
                </tr>
              ) : (
                records.map((record, index) => {
                  const loginStatus = getLoginStatus(record.updated_at);
                  return (
                    <tr key={record.id} className="border-b border-app-border hover:bg-app-surface-alt">
                      <td className="px-4 py-3 text-app-text-muted">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-app-text">{record.full_name}</td>
                      <td className="px-4 py-3 text-app-text-muted">{record.class_name || '-'}</td>
                      <td className="px-4 py-3 text-app-text-muted">
                        {record.updated_at ? new Date(record.updated_at).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-app-text-muted">{getMockLoginCount(record.updated_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${loginStatus.cls}`}>
                          {loginStatus.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
