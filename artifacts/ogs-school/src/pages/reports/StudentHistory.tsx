import { useState, useEffect } from 'react';
import { TrendingUp, ArrowRightLeft, LogOut, Search, Download, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface HistoryRecord {
  id: string;
  full_name: string;
  previous_class: string;
  current_class: string;
  promoted_date: string;
  promotion_status: string;
  academic_year: string;
}

interface AcademicYear {
  id: string;
  name: string;
}

export default function StudentHistory() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    academic_year_id: '',
  });

  useEffect(() => {
    fetchAcademicYears();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [filters.academic_year_id]);

  async function fetchAcademicYears() {
    const { data } = await supabase
      .from('academic_years')
      .select('id, name')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setAcademicYears(data);
  }

  async function fetchHistory() {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('id, full_name, previous_class, class_name, promotion_date, promotion_status, academic_year')
      .eq('role', 'student')
      .eq('school_id', profile?.school_id)
      .order('full_name');

    if (filters.academic_year_id) {
      const yr = academicYears.find(y => y.id === filters.academic_year_id);
      if (yr) query = query.eq('academic_year', yr.name);
    }

    const { data } = await query;
    const mapped = (data || []).map((d: any) => ({
      id: d.id,
      full_name: d.full_name,
      previous_class: d.previous_class || '-',
      current_class: d.class_name || '-',
      promoted_date: d.promotion_date || '',
      promotion_status: d.promotion_status || 'promoted',
      academic_year: d.academic_year || '',
    }));
    setRecords(mapped);
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const filteredRecords = records.filter(r =>
    filters.search === '' || r.full_name.toLowerCase().includes(filters.search.toLowerCase())
  );

  const promotions = filteredRecords.filter(r => r.promotion_status === 'promoted').length;
  const transfers = filteredRecords.filter(r => r.promotion_status === 'transferred').length;
  const dropouts = filteredRecords.filter(r => r.promotion_status === 'left').length;

  function getStatusBadge(status: string) {
    switch (status) {
      case 'promoted':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Promoted</span>;
      case 'transferred':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Transferred</span>;
      case 'left':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Left</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-app-text capitalize">{status}</span>;
    }
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
        <h1 className="text-2xl font-bold text-app-text">Student History</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-text-muted" />
            <input
              type="text"
              placeholder="Search student..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="bg-app-surface text-app-text w-full border border-app-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            />
          </div>

          <select
            value={filters.academic_year_id}
            onChange={e => setFilters(f => ({ ...f, academic_year_id: e.target.value }))}
            className="bg-app-surface text-app-text border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
          >
            <option value="">All Academic Years</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Total Promotions</p>
              <p className="text-2xl font-bold text-app-text mt-1">{promotions}</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Transfers</p>
              <p className="text-2xl font-bold text-app-text mt-1">{transfers}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <ArrowRightLeft className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Drop-outs</p>
              <p className="text-2xl font-bold text-app-text mt-1">{dropouts}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <LogOut className="h-6 w-6 text-red-600" />
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
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Previous Class</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Current Class</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Promoted Date</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-app-text-muted">Loading...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-app-text-muted">No records found</td>
                </tr>
              ) : (
                filteredRecords.map((record, index) => (
                  <tr key={record.id} className="border-b border-app-border hover:bg-app-surface-alt">
                    <td className="px-4 py-3 text-app-text-muted">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-app-text">{record.full_name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{record.previous_class}</td>
                    <td className="px-4 py-3 text-app-text-muted">{record.current_class}</td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {record.promoted_date ? new Date(record.promoted_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(record.promotion_status)}</td>
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
