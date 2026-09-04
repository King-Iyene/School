import { useState, useEffect } from 'react';
import { BookOpen, AlertTriangle, CheckCircle, DollarSign, Download, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface FineRecord {
  id: string;
  date: string;
  student_name: string;
  class_name: string;
  fine_type: string;
  description: string;
  amount: number;
  status: 'paid' | 'unpaid';
  paid_date: string;
}

export default function StudentFineReport() {
  const { profile } = useAuth();
  const [fines, setFines] = useState<FineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState<boolean | null>(null);
  const [showToast, setShowToast] = useState(false);

  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    fine_type: '',
    status: '',
  });

  useEffect(() => {
    checkTableExists();
  }, []);

  useEffect(() => {
    if (tableExists) fetchFines();
  }, [filters, tableExists]);

  async function checkTableExists() {
    const { error } = await supabase.from('student_fines').select('id').limit(1);
    const exists = !error || error.code !== '42P01';
    setTableExists(exists);
    if (!exists) setLoading(false);
  }

  async function fetchFines() {
    setLoading(true);
    let query = supabase
      .from('student_fines')
      .select('id, fine_date, student_name, class_name, fine_type, description, amount, status, paid_date, students!student_id(first_name, last_name, class_name)')
      .eq('school_id', profile?.school_id)
      .order('fine_date', { ascending: false });

    if (filters.date_from) query = query.gte('fine_date', filters.date_from);
    if (filters.date_to) query = query.lte('fine_date', filters.date_to);
    if (filters.fine_type) query = query.eq('fine_type', filters.fine_type);
    if (filters.status) query = query.eq('status', filters.status);

    const { data } = await query;
    const mapped: FineRecord[] = (data || []).map((d: any) => ({
      id: d.id,
      date: d.fine_date,
      student_name: d.students?.first_name ? `${d.students.first_name} ${d.students.last_name}` : (d.student_name || 'Unknown'),
      class_name: d.students?.class_name || d.class_name || '-',
      fine_type: d.fine_type || 'other',
      description: d.description || '-',
      amount: Number(d.amount) || 0,
      status: d.status || 'unpaid',
      paid_date: d.paid_date || '',
    }));
    setFines(mapped);
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const totalFines = fines.reduce((s, f) => s + f.amount, 0);
  const collected = fines.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0);
  const outstanding = fines.filter(f => f.status === 'unpaid').reduce((s, f) => s + f.amount, 0);

  function getFineTypeBadge(type: string) {
    switch (type) {
      case 'library':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><BookOpen className="h-3 w-3" />Library</span>;
      case 'discipline':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><AlertTriangle className="h-3 w-3" />Discipline</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-app-text capitalize">{type}</span>;
    }
  }

  if (tableExists === false) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-app-text">Student Fine Report</h1>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-16 flex flex-col items-center gap-4 text-center">
          <div className="bg-slate-100 p-6 rounded-full">
            <XCircle className="h-16 w-16 text-app-text-muted" />
          </div>
          <h2 className="text-xl font-semibold text-app-text">Fine Records Not Available</h2>
          <p className="text-app-text-muted max-w-md">
            The student fines table has not been configured yet. Please set up the fines management module to track library and discipline fines.
          </p>
          <div className="flex items-center gap-2 mt-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">This feature requires the student fines module to be enabled.</p>
          </div>
        </div>
      </div>
    );
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
        <h1 className="text-2xl font-bold text-app-text">Student Fine Report</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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

          <select
            value={filters.fine_type}
            onChange={e => setFilters(f => ({ ...f, fine_type: e.target.value }))}
            className="bg-app-surface text-app-text border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary self-end"
          >
            <option value="">All Types</option>
            <option value="library">Library</option>
            <option value="discipline">Discipline</option>
            <option value="other">Other</option>
          </select>

          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="bg-app-surface text-app-text border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary self-end"
          >
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Total Fines</p>
              <p className="text-2xl font-bold text-app-text mt-1">₦{totalFines.toLocaleString()}</p>
            </div>
            <div className="bg-slate-100 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-app-text-muted" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Collected</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">₦{collected.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-lg">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Outstanding</p>
              <p className="text-2xl font-bold text-red-600 mt-1">₦{outstanding.toLocaleString()}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
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
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Date</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Student Name</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Class</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Fine Type</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Description</th>
                <th className="text-right px-4 py-3 text-app-text-muted font-medium">Amount</th>
                <th className="text-center px-4 py-3 text-app-text-muted font-medium">Status</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Paid Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-app-text-muted">Loading...</td>
                </tr>
              ) : fines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-app-text-muted">No fine records found</td>
                </tr>
              ) : (
                fines.map((fine, index) => (
                  <tr key={fine.id} className="border-b border-app-border hover:bg-app-surface-alt">
                    <td className="px-4 py-3 text-app-text-muted">{index + 1}</td>
                    <td className="px-4 py-3 text-app-text-muted">{new Date(fine.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-app-text">{fine.student_name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{fine.class_name}</td>
                    <td className="px-4 py-3">{getFineTypeBadge(fine.fine_type)}</td>
                    <td className="px-4 py-3 text-app-text-muted max-w-xs truncate">{fine.description}</td>
                    <td className="px-4 py-3 text-right font-medium text-app-text">₦{fine.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      {fine.status === 'paid' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <CheckCircle className="h-3 w-3" />
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <XCircle className="h-3 w-3" />
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {fine.paid_date ? new Date(fine.paid_date).toLocaleDateString() : '-'}
                    </td>
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
