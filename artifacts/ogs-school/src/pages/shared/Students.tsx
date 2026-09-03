import { useEffect, useState } from 'react';
import { Search, Eye, Download, Home, Moon } from 'lucide-react';

function StudentTypeBadge({ type }: { type?: string | null }) {
  if (!type) return null;
  const isBoarding = type === 'boarding';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isBoarding ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'}`}>
      {isBoarding ? <Moon className="w-2.5 h-2.5" /> : <Home className="w-2.5 h-2.5" />}
      {isBoarding ? 'Boarding' : 'Day'}
    </span>
  );
}
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/common/Badge';
import { navigate } from '../../components/hooks/useLocation';
import { cache } from '../../utils/cache';
import { useTenantSettings } from '../../context/TenantContext';

export default function Students() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  useEffect(() => { loadInitialData(); }, [profile]);
  useEffect(() => { loadStudents(); }, [profile, filterClass, filterYear, search, currentPage]);

  async function loadInitialData() {
    if (!profile?.school_id) return;
    
    // Fetch classes and years (metadata) with 1 day cache
    const [cData, yData] = await Promise.all([
      cache.fetch(`classes_meta_${profile.school_id}`, async () => {
        const { data } = await supabase.from('classes').select('id, name, level, section').eq('school_id', profile.school_id).order('level').order('section');
        return data || [];
      }, 86400000),
      cache.fetch(`years_meta_${profile.school_id}`, async () => {
        const { data } = await supabase.from('academic_years').select('id, name, is_current').eq('school_id', profile.school_id).order('start_date', { ascending: false });
        return data || [];
      }, 86400000)
    ]);

    setClasses(cData);
    setYears(yData);

    // Removed defaulting to current year to ensure all students show initially
    // if (!filterYear && yData.length > 0) { ... }
  }

  async function loadStudents() {
    if (!profile?.school_id) return;
    setLoading(true);

    const cacheKey = `students_v3_p${currentPage}_s${pageSize}_f${filterClass}_y${filterYear}_q${search}_${profile.school_id}`;
    
    const result = await cache.fetch(cacheKey, async () => {
      let queryStr = filterYear 
        ? '*, classes(name, level, section), student_enrollments!inner(academic_year_id)'
        : '*, classes(name, level, section)';

      let query = supabase
        .from('students')
        .select(queryStr, { count: 'exact' })
        .eq('school_id', profile.school_id)
        .neq('status', 'graduated')
        .order('first_name');

      if (filterClass) query = query.eq('class_id', filterClass);
      if (filterYear) query = query.eq('student_enrollments.academic_year_id', filterYear);
      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,admission_number.ilike.%${search}%`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, count, error } = await query.range(from, to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    }, 3600000); // Cache for 1 hour

    setStudents(result.data);
    setTotalCount(result.count);
    setLoading(false);
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Fetch all students for export (one-off, or cached for 1 hour)
      const cacheKey = `students_export_v3_f${filterClass}_y${filterYear}_q${search}_${profile?.school_id}`;
      const exportData = await cache.fetch(cacheKey, async () => {
        let queryStr = filterYear 
          ? '*, classes(name, level, section), student_enrollments!inner(academic_year_id)'
          : '*, classes(name, level, section)';

        let query = supabase
          .from('students')
          .select(queryStr)
          .eq('school_id', profile?.school_id ?? '')
          .neq('status', 'graduated')
          .order('first_name');

        if (filterClass) query = query.eq('class_id', filterClass);
        if (filterYear) query = query.eq('student_enrollments.academic_year_id', filterYear);
        if (search) {
          query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,admission_number.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      }, 3600000);

      const headers = [
        'Admission Number',
        'First Name',
        'Last Name',
        'Class',
        'Academic Year',
        'Gender',
        'Guardian Name',
        'Guardian Phone',
        'State of Origin',
        'LGA',
        'Status',
        'Joined Date'
      ];

      const rows = exportData.map((s: any) => [
        s.admission_number || '',
        s.first_name || '',
        s.last_name || '',
        s.classes ? (s.classes.name || `${s.classes.level}${s.classes.section}`) : '',
        years.find(y => y.id === filterYear)?.name || 'All Years',
        s.gender || '',
        s.guardian_name || '',
        s.guardian_phone || s.phone || '',
        s.state_of_origin || '',
        s.lga || '',
        s.status || (s.is_active ? 'active' : 'inactive'),
        new Date(s.created_at).toLocaleDateString()
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `students_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Students</h2>
        <p className="text-slate-500 text-sm">All enrolled students at {settings.school_name || 'School Portal'}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Search by name, admission no or class..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>
          <div className="flex gap-3 flex-wrap">
            <select
              value={filterClass}
              onChange={e => { setFilterClass(e.target.value); setCurrentPage(1); }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[130px]"
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name || `${c.level}${c.section}`}
                </option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={e => { setFilterYear(e.target.value); setCurrentPage(1); }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[130px]"
            >
              <option value="">All Years</option>
              {years.map(y => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.is_current ? '(Current)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleExport}
              disabled={loading || students.length === 0}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Student</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Admission No.</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Class</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Phone</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Joined</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading students...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">No students found</td></tr>
              ) : students.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/student-profile?id=${s.id}`)}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-semibold text-emerald-700">
                        {s.first_name?.[0]}{s.last_name?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{s.first_name} {s.last_name}</p>
                        <StudentTypeBadge type={s.student_type} />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm font-mono text-emerald-600 font-medium">{s.admission_number || '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-800 font-semibold">{s.classes ? (s.classes.name || `${s.classes.level}${s.classes.section}`) : '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{s.guardian_phone || s.phone || '—'}</td>
                  <td className="px-5 py-3"><Badge label={s.status === 'active' || s.is_active ? 'Active' : 'Inactive'} variant={s.status === 'active' || s.is_active ? 'success' : 'error'} /></td>
                  <td className="px-5 py-3 text-sm text-slate-500">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => navigate(`/student-profile?id=${s.id}`)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} students
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <div className="text-sm font-medium text-slate-600 px-2">
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
