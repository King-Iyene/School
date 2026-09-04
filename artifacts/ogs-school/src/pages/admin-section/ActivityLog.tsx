import { useEffect, useState } from 'react';
import { ScrollText, Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { actionLabel } from '../../lib/activityLog';

const PAGE_SIZE = 30;

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'student.admitted', label: 'Student admitted' },
  { value: 'student.updated', label: 'Student updated' },
  { value: 'student.deleted', label: 'Student deleted' },
  { value: 'student.promoted', label: 'Student promoted' },
  { value: 'student.graduated', label: 'Student graduated' },
  { value: 'parent.account_created', label: 'Parent account created' },
  { value: 'user.created', label: 'User created' },
  { value: 'user.deleted', label: 'User deleted' },
  { value: 'fee.payment_recorded', label: 'Fee payment recorded' },
  { value: 'result.compiled', label: 'Results compiled' },
  { value: 'result.published', label: 'Results published' },
];

const ALLOWED_ROLES = new Set(['super_admin', 'admin', 'principal']);

export default function ActivityLog() {
  const { profile } = useAuth();
  const authorized = !!profile && ALLOWED_ROLES.has(profile.role);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, action, query, dateFrom, dateTo, profile?.school_id]);

  async function load() {
    if (!authorized || !profile?.school_id) { setLoading(false); return; }
    setLoading(true);
    setLoadError('');

    let q = supabase
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false });

    if (action) q = q.eq('action', action);
    if (query) q = q.ilike('user_name', `%${query}%`);
    if (dateFrom) q = q.gte('created_at', dateFrom);
    if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59`);

    const from = (page - 1) * PAGE_SIZE;
    const { data, count, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) {
      setLoadError(
        error.message.includes('relation') || error.code === '42P01'
          ? 'The activity log table has not been created in the database yet. Run the setup SQL to enable logging.'
          : error.message
      );
      setRows([]);
      setTotal(0);
    } else {
      setRows(data ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!authorized) {
    return <div className="p-6 text-sm text-app-text-muted">You do not have permission to view the activity log.</div>;
  }

  function detailText(details: any): string {
    if (!details || typeof details !== 'object') return '';
    return Object.entries(details)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
      .join(' · ');
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-violet-50 p-2 rounded-lg">
            <ScrollText size={22} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-app-text">Activity Log</h1>
            <p className="text-sm text-app-text-muted">Every recorded action taken by users in the portal</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-app-text-muted border border-app-border rounded-xl px-3.5 py-2 hover:bg-app-surface-alt">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 text-app-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setPage(1); setQuery(userSearch.trim()); } }}
            placeholder="Search by user…"
            className="bg-app-surface text-app-text border border-app-border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 w-56"
          />
        </div>
        <select
          value={action}
          onChange={e => { setPage(1); setAction(e.target.value); }}
          className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        >
          {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setPage(1); setDateFrom(e.target.value); }} className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm" />
        <span className="text-app-text-muted text-sm">to</span>
        <input type="date" value={dateTo} onChange={e => { setPage(1); setDateTo(e.target.value); }} className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm" />
        <span className="text-sm text-app-text-muted ml-auto">{total} entries</span>
      </div>

      {loadError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3 mb-4">{loadError}</div>
      )}

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-app-text-muted text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-app-text-muted text-sm">No activity recorded yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-app-surface-alt text-left text-xs text-app-text-muted uppercase">
                  <th className="px-5 py-3 font-semibold">When</th>
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">Action</th>
                  <th className="px-5 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-app-surface-alt align-top">
                    <td className="px-5 py-3 text-app-text-muted whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString()}<br />
                      <span className="text-xs">{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-app-text">{r.user_name}</p>
                      <p className="text-xs text-app-text-muted capitalize">{(r.user_role || '').replace(/_/g, ' ')}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 font-medium whitespace-nowrap">{actionLabel(r.action)}</span>
                    </td>
                    <td className="px-5 py-3 text-app-text-muted capitalize">{detailText(r.details) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg border border-app-border disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm text-app-text-muted">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg border border-app-border disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
