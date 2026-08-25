import { useState, useEffect } from 'react';
import { BookOpen, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface BookIssue {
  id: string;
  issue_date: string;
  return_date: string;
  actual_return_date: string | null;
  status: string;
  fine_amount: number | null;
  books: {
    title: string;
    author: string;
  } | null;
  profiles: {
    full_name: string;
  } | null;
}

interface Summary {
  total: number;
  currentlyOut: number;
  returnedThisMonth: number;
  overdue: number;
}

export default function AllIssuedBooks() {
  const { profile } = useAuth();
  const [issues, setIssues] = useState<BookIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [summary, setSummary] = useState<Summary>({ total: 0, currentlyOut: 0, returnedThisMonth: 0, overdue: 0 });

  useEffect(() => {
    if (profile?.school_id) fetchIssues();
  }, [profile?.school_id, filterStatus, dateFrom, dateTo]);

  async function fetchIssues() {
    setLoading(true);
    let query = supabase
      .from('book_issues')
      .select('id, issue_date, return_date, actual_return_date, status, fine_amount, member_type, books(title, author), profiles!member_id(first_name, last_name), students!member_id(first_name, last_name)')
      .eq('school_id', profile?.school_id || '')
      .order('issue_date', { ascending: false });

    if (filterStatus !== 'all') {
      if (filterStatus === 'overdue') {
        const today = new Date().toISOString().split('T')[0];
        query = query.eq('status', 'issued').lt('return_date', today);
      } else {
        query = query.eq('status', filterStatus);
      }
    }
    if (dateFrom) query = query.gte('issue_date', dateFrom);
    if (dateTo) query = query.lte('issue_date', dateTo);

    const { data } = await query;
    const rows = (data ?? []) as BookIssue[];
    setIssues(rows);
    computeSummary(rows);
    setLoading(false);
  }

  function computeSummary(rows: BookIssue[]) {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const total = rows.length;
    const currentlyOut = rows.filter((r) => r.status === 'issued').length;
    const returnedThisMonth = rows.filter(
      (r) =>
        r.status === 'returned' &&
        r.actual_return_date &&
        new Date(r.actual_return_date) >= startOfMonth
    ).length;
    const overdue = rows.filter(
      (r) => r.status === 'issued' && r.return_date && new Date(r.return_date) < today
    ).length;
    setSummary({ total, currentlyOut, returnedThisMonth, overdue });
  }

  function isOverdue(issue: BookIssue): boolean {
    return issue.status === 'issued' && !!issue.return_date && new Date(issue.return_date) < new Date();
  }

  function computeFine(issue: BookIssue): number {
    if (!isOverdue(issue)) return 0;
    const due = new Date(issue.return_date);
    const today = new Date();
    const diffMs = today.getTime() - due.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days) * 50;
  }

  function statusLabel(issue: BookIssue): { label: string; cls: string } {
    if (isOverdue(issue)) return { label: 'Overdue', cls: 'bg-red-100 text-red-700' };
    if (issue.status === 'returned') return { label: 'Returned', cls: 'bg-emerald-100 text-emerald-700' };
    return { label: 'Issued', cls: 'bg-blue-100 text-blue-700' };
  }

  const summaryCards = [
    {
      label: 'Total Issued',
      value: summary.total,
      icon: TrendingUp,
      cls: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Currently Out',
      value: summary.currentlyOut,
      icon: Clock,
      cls: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Returned This Month',
      value: summary.returnedThisMonth,
      icon: CheckCircle,
      cls: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Overdue',
      value: summary.overdue,
      icon: AlertTriangle,
      cls: 'bg-red-50 text-red-600',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-white p-2 rounded-xl">
            <BookOpen size={20} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">All Issued Books</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${card.cls}`}>
              <card.icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{card.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="issued">Issued</option>
            <option value="returned">Returned</option>
            <option value="overdue">Overdue</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          {(dateFrom || dateTo || filterStatus !== 'all') && (
            <button
              onClick={() => { setFilterStatus('all'); setDateFrom(''); setDateTo(''); }}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : issues.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No issued books found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Issue Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Due Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Book Title</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Author</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Borrower</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Return Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Fine (₦)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issues.map((issue) => {
                  const { label, cls } = statusLabel(issue);
                  const fine = computeFine(issue);
                  return (
                    <tr key={issue.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-600">{issue.issue_date || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{issue.return_date || '-'}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{issue.books?.title || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{issue.books?.author || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {(() => {
                          const i = issue as any;
                          if (i.member_type === 'student') {
                            const s = Array.isArray(i.students) ? i.students[0] : i.students;
                            return s ? `${s.first_name} ${s.last_name}` : (i.profiles?.first_name ? `${i.profiles.first_name} ${i.profiles.last_name}` : '—');
                          }
                          const p = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles;
                          return p ? `${p.first_name} ${p.last_name}` : '—';
                        })()}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{issue.actual_return_date || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${cls}`}>{label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {fine > 0 ? (
                          <span className="text-red-600 font-medium">₦{fine.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
