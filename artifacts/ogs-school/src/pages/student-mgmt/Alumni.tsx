import { useEffect, useState } from 'react';
import { GraduationCap, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../components/hooks/useLocation';

const PAGE_SIZE = 25;

interface AlumniRow {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  gender: string | null;
  avatar_url?: string | null;
  graduated_year?: string;
  last_class?: string;
}

const BLOCKED_ROLES = new Set(['student', 'parent']);

export default function Alumni() {
  const { profile } = useAuth();
  const authorized = !!profile && !BLOCKED_ROLES.has(profile.role);
  const [rows, setRows] = useState<AlumniRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, profile?.school_id]);

  async function load() {
    if (!authorized) { setLoading(false); return; }
    if (!profile?.school_id) {
      setLoadError('Your account profile has no school linked, so alumni cannot be loaded. Please log out and log in again — if this message persists, contact the administrator.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);

    // A silently-expired session makes every query return 0 rows — detect it.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoadError('Your session has expired. Please log out and log in again to see alumni.');
      setLoading(false);
      return;
    }

    let q = supabase
      .from('students')
      .select('id, first_name, last_name, admission_number, gender, avatar_url', { count: 'exact' })
      .eq('school_id', profile.school_id)
      .eq('status', 'graduated')
      .order('first_name');

    if (query) {
      q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,admission_number.ilike.%${query}%`);
    }

    const from = (page - 1) * PAGE_SIZE;
    const { data, count, error: qError } = await q.range(from, from + PAGE_SIZE - 1);
    if (qError) {
      setLoadError(`Could not load alumni: ${qError.message}`);
      setLoading(false);
      return;
    }
    const students = (data ?? []) as AlumniRow[];

    // Enrich with final class + graduation year from enrollment history
    if (students.length > 0) {
      const ids = students.map(s => s.id);
      const { data: enrolls } = await supabase
        .from('student_enrollments')
        .select('student_id, status, enrollment_date, classes(name), academic_years(name)')
        .in('student_id', ids)
        .order('enrollment_date', { ascending: false });
      const byStudent: Record<string, any[]> = {};
      (enrolls ?? []).forEach((e: any) => {
        (byStudent[e.student_id] ||= []).push(e);
      });
      students.forEach(s => {
        const hist = byStudent[s.id] ?? [];
        const gradRow = hist.find(e => e.status === 'graduated');
        const lastClassRow = hist.find(e => e.classes?.name);
        s.graduated_year = gradRow?.academic_years?.name ?? '';
        s.last_class = lastClassRow?.classes?.name ?? '';
      });
    }

    setRows(students);
    setTotal(count ?? 0);
    setLoading(false);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!authorized) {
    return <div className="p-6 text-sm text-app-text-muted">You do not have permission to view this page.</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="bg-blue-50 p-2 rounded-lg">
          <GraduationCap size={22} className="text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-app-text">Alumni</h1>
      </div>
      <p className="text-sm text-app-text-muted mb-6">
        Graduated students. Their full records — results, fees, attendance — remain available on their profile.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-app-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setPage(1); setQuery(search.trim()); } }}
            placeholder="Search name or admission number…"
            className="bg-app-surface text-app-text w-full border border-app-border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <span className="text-sm text-app-text-muted">{total} alumni</span>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
          {loadError}
        </div>
      )}

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-app-text-muted text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-app-text-muted text-sm">
            {query ? 'No alumni match your search' : 'No graduated students yet. Students appear here after graduation via Student Promote.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-app-surface-alt text-left text-xs text-app-text-muted uppercase">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Admission No.</th>
                  <th className="px-5 py-3 font-semibold">Final Class</th>
                  <th className="px-5 py-3 font-semibold">Graduated</th>
                  <th className="px-5 py-3 font-semibold text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {rows.map(s => (
                  <tr key={s.id} className="hover:bg-app-surface-alt">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                            {s.first_name?.[0]}{s.last_name?.[0]}
                          </div>
                        )}
                        <span className="font-medium text-app-text">{s.first_name} {s.last_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-app-text-muted">{s.admission_number || '—'}</td>
                    <td className="px-5 py-3 text-app-text-muted">{s.last_class || '—'}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                        {s.graduated_year || 'Graduated'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => navigate(`/student-profile?id=${s.id}`)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
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
