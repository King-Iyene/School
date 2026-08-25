import { useEffect, useState } from 'react';
import { Users, Search, Phone, Mail, BadgeCheck, Printer, Eye, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../components/hooks/useLocation';
import StaffIDCardPrint from '../../components/print/StaffIDCardPrint';
import { cache } from '../../utils/cache';

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  staff_id?: string;
  avatar_url?: string | null;
  department?: string;
  employment_type?: string;
  join_date?: string;
  is_active?: boolean;
  subject_count?: number;
  class_count?: number;
}

export default function Teachers() {
  const { profile } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [printTeachers, setPrintTeachers] = useState<Teacher[] | null>(null);
  const [academicYear, setAcademicYear] = useState('2025/2026');
  const [yearId, setYearId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  useEffect(() => { loadCurrentYear(); }, [profile]);
  useEffect(() => { loadTeachers(); }, [profile, currentPage, search, deptFilter]);

  async function loadCurrentYear() {
    if (!profile?.school_id) return;
    const { data } = await supabase.from('academic_years').select('id, name').eq('school_id', profile.school_id).eq('is_current', true).maybeSingle();
    if (data?.name) setAcademicYear(data.name);
    if (data?.id) setYearId(data.id);
  }

  async function loadTeachers() {
    if (!profile?.school_id) return;
    setLoading(true);
    
    // Get current year ID if not already loaded (for the queries below)
    let currentYearId = yearId;
    if (!currentYearId) {
      const { data } = await supabase.from('academic_years').select('id').eq('school_id', profile.school_id).eq('is_current', true).maybeSingle();
      currentYearId = data?.id || null;
    }

    try {
      const cacheKey = `teachers_p${currentPage}_s${pageSize}_d${deptFilter}_q${search}_${profile.school_id}`;
      const result = await cache.fetch(cacheKey, async () => {
        let query = supabase
          .from('profiles')
          .select('id, first_name, last_name, email, phone, staff_id, avatar_url, department, employment_type, join_date, is_active', { count: 'exact' })
          .eq('school_id', profile.school_id)
          .in('role', ['teacher', 'head_teacher'])
          .order('first_name');

        if (deptFilter) query = query.eq('department', deptFilter);
        if (search) {
          query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,staff_id.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data: teacherData, count, error: sError } = await query.range(from, to);
        if (sError) throw sError;

        if (!teacherData) return { data: [], count: 0 };

        const enriched = await Promise.all(teacherData.map(async (t) => {
          const [subRes, formRes, classesRes] = await Promise.all([
            supabase.from('subject_teacher_assignments').select('class_id').eq('teacher_id', t.id).eq('academic_year_id', currentYearId ?? ''),
            supabase.from('class_teachers').select('class_id').eq('teacher_id', t.id).eq('academic_year_id', currentYearId ?? ''),
            supabase.from('classes').select('id').eq('class_teacher_id', t.id).eq('academic_year_id', currentYearId ?? '')
          ]);
          
          const classIds = new Set([
            ...(subRes.data ?? []).map(d => d.class_id),
            ...(formRes.data ?? []).map(d => d.class_id),
            ...(classesRes.data ?? []).map(d => d.id)
          ].filter(Boolean));
          
          return { 
            ...t, 
            subject_count: (subRes.data ?? []).length, 
            class_count: classIds.size 
          };
        }));

        return { data: enriched, count: count || 0 };
      }, 3600000); // 1h

      setTeachers(result.data);
      setTotalCount(result.count);
    } catch (err) {
      console.error('Error loading teachers:', err);
    } finally {
      setLoading(false);
    }
  }

  const departments = [...new Set(teachers.map(t => t.department).filter(Boolean))];

  const filtered = teachers.filter(t => {
    const q = search.toLowerCase();
    const matchesSearch = !q || `${t.first_name} ${t.last_name}`.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) || t.staff_id?.toLowerCase().includes(q) ||
      t.department?.toLowerCase().includes(q);
    const matchesDept = !deptFilter || t.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  function handlePrintAll() {
    setPrintTeachers(filtered);
  }

  function handlePrintOne(t: Teacher) {
    setPrintTeachers([t]);
  }

  function navigateToProfile(id: string) {
    navigate(`/teacher-profile?id=${id}`);
  }

  if (printTeachers) {
    return (
      <StaffIDCardPrint
        staff={printTeachers.map(t => ({ ...t, role: 'teacher' }))}
        academicYear={academicYear}
        onClose={() => setPrintTeachers(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Teachers</h2>
          <p className="text-slate-500 text-sm">{teachers.length} teacher{teachers.length !== 1 ? 's' : ''} on staff</p>
        </div>
        <button
          onClick={handlePrintAll}
          className="flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Printer className="w-4 h-4" /> Print ID Cards ({filtered.length})
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, staff ID, or email..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
        {departments.length > 0 && (
          <div className="relative">
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="appearance-none border border-slate-200 rounded-xl px-3 py-2.5 pr-8 text-sm focus:outline-none bg-white text-slate-700"
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading teachers...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">{search || deptFilter ? 'No teachers match your filters' : 'No teachers found'}</p>
          <p className="text-slate-400 text-sm mt-1">Teachers are managed through the Users section</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teachers.map(t => (
            <TeacherCard
              key={t.id}
              teacher={t}
              onView={() => navigateToProfile(t.id)}
              onPrint={() => handlePrintOne(t)}
            />
          ))}
        </div>
      )}

      {/* Pagination UI */}
      {!loading && totalCount > pageSize && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm mt-6">
          <div className="text-sm text-slate-500">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} teacher{totalCount !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <div className="text-sm font-medium text-slate-600 px-2">
              Page {currentPage} of {Math.ceil(totalCount / pageSize)}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
              disabled={currentPage === Math.ceil(totalCount / pageSize)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherCard({ teacher: t, onView, onPrint }: { teacher: Teacher; onView: () => void; onPrint: () => void }) {
  const initials = `${t.first_name?.[0] ?? ''}${t.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
      <div className="h-2 bg-gradient-to-r from-emerald-600 to-teal-500" />
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            {t.avatar_url ? (
              <img src={t.avatar_url} alt={`${t.first_name} ${t.last_name}`} className="w-16 h-16 rounded-xl object-cover border-2 border-slate-100" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center border-2 border-slate-100">
                <span className="text-xl font-bold text-emerald-700">{initials}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-800 leading-snug">{t.first_name} {t.last_name}</h3>
                {t.staff_id && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-mono text-slate-500">{t.staff_id}</span>
                  </div>
                )}
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${t.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {t.is_active !== false ? 'Active' : 'Inactive'}
              </span>
            </div>
            {t.department && (
              <p className="text-xs text-slate-500 mt-1 font-medium">{t.department}</p>
            )}
            {t.employment_type && (
              <p className="text-xs text-slate-400 capitalize">{t.employment_type.replace('_', ' ')}</p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          {t.email && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{t.email}</span>
            </div>
          )}
          {t.phone && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{t.phone}</span>
            </div>
          )}
        </div>

        {(t.subject_count !== undefined || t.class_count !== undefined) && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-4">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-800">{t.subject_count ?? 0}</p>
              <p className="text-xs text-slate-400">Subjects</p>
            </div>
            <div className="h-8 w-px bg-slate-100" />
            <div className="text-center">
              <p className="text-lg font-bold text-slate-800">{t.class_count ?? 0}</p>
              <p className="text-xs text-slate-400">Classes</p>
            </div>
            {t.join_date && (
              <>
                <div className="h-8 w-px bg-slate-100" />
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-700">{new Date(t.join_date).getFullYear()}</p>
                  <p className="text-xs text-slate-400">Joined</p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onView}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 py-2 rounded-xl transition-colors font-medium"
          >
            <Eye className="w-4 h-4" /> View Profile
          </button>
          <button
            onClick={onPrint}
            className="flex items-center justify-center gap-1.5 text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl transition-colors"
            title="Print ID Card"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
