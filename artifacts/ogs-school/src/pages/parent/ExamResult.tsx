import { useState, useEffect } from 'react';
import { Award, ChevronDown, Users, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface TermGroup {
  key: string;
  termName: string;
  yearName: string;
  className: string;
  published: boolean;
  rows: any[];
  total: number;
  avg: number;
}

export default function ExamResult() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [groups, setGroups] = useState<TermGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadChildren() {
      if (!profile?.id) return;
      const { data, error: err } = await supabase
        .from('parent_student_links')
        .select('*, students!student_id(id, first_name, last_name)')
        .eq('parent_id', profile.id);
      if (err) setError(err.message);
      const kids = (data ?? []).map(l => (l as any).students).filter(Boolean);
      setChildren(kids);
      if (kids.length > 0) setSelectedChild((kids[0] as any).id);
      setLoading(false);
    }
    loadChildren();
  }, [profile]);

  useEffect(() => {
    async function loadResults() {
      if (!selectedChild) return;
      setResultsLoading(true);
      setError(null);

      const [{ data: grades, error: gErr }, { data: exclusionData }] = await Promise.all([
        supabase
          .from('grades')
          .select('*, subjects(name, code), terms(name), academic_years(name), classes(name, level, section)')
          .eq('student_id', selectedChild),
        supabase
          .from('student_subject_exclusions')
          .select('subject_id, academic_year_id, term_id')
          .eq('student_id', selectedChild),
      ]);

      if (gErr) {
        setError(gErr.message);
        setGroups([]);
        setResultsLoading(false);
        return;
      }

      // Term-aware: an exclusion applies when term_id is null (whole year) or matches the grade's term.
      const excludedList = exclusionData ?? [];
      const isExcluded = (g: any) => excludedList.some((e: any) =>
        e.subject_id === g.subject_id && e.academic_year_id === g.academic_year_id &&
        (e.term_id == null || e.term_id === g.term_id));

      // A grade counts as recorded if any score field or the letter grade is present.
      const rows = (grades ?? []).filter(g =>
        g.total_score != null || g.ca1_score != null || g.ca2_score != null ||
        g.ca3_score != null || g.exam_score != null || g.grade != null
      ).map(g => ({ ...g, _excluded: isExcluded(g) }));

      const termIds = Array.from(new Set(rows.map(g => g.term_id).filter(Boolean)));
      const publishedSet = new Set<string>();
      if (termIds.length > 0) {
        const { data: comps, error: cErr } = await supabase
          .from('result_compilations')
          .select('class_id, term_id, academic_year_id, status')
          .in('term_id', termIds);
        if (cErr) {
          setError(cErr.message);
          setGroups([]);
          setResultsLoading(false);
          return;
        }
        for (const c of comps ?? []) {
          if (c.status === 'published') {
            publishedSet.add(`${c.class_id}::${c.term_id}::${c.academic_year_id}`);
          }
        }
      }

      const map = new Map<string, TermGroup>();
      for (const g of rows) {
        const key = `${g.class_id}::${g.term_id}::${g.academic_year_id}`;
        const cls = (g as any).classes;
        if (!map.has(key)) {
          map.set(key, {
            key,
            termName: (g as any).terms?.name ?? 'Term',
            yearName: (g as any).academic_years?.name ?? '',
            className: cls?.name || `${cls?.level ?? ''}${cls?.section ? '-' + cls.section : ''}` || '—',
            published: g.class_id ? publishedSet.has(`${g.class_id}::${g.term_id}::${g.academic_year_id}`) : false,
            rows: [],
            total: 0,
            avg: 0,
          });
        }
        map.get(key)!.rows.push(g);
      }

      const list = Array.from(map.values());
      for (const grp of list) {
        grp.rows.sort((a, b) => (totalOf(b) - totalOf(a)));
        // Excluded subjects still display but must NOT count toward total/average.
        const counted = grp.rows.filter((r: any) => !r._excluded);
        grp.total = counted.reduce((s, r) => s + totalOf(r), 0);
        grp.avg = counted.length > 0 ? Math.round(grp.total / counted.length) : 0;
      }
      list.sort((a, b) => (b.yearName + b.termName).localeCompare(a.yearName + a.termName));
      setGroups(list);
      setResultsLoading(false);
    }
    loadResults();
  }, [selectedChild]);

  function totalOf(g: any): number {
    return g.total_score ?? ((g.ca1_score || 0) + (g.ca2_score || 0) + (g.ca3_score || 0) + (g.exam_score || 0));
  }

  const gradeColor = (grade: string | null) => {
    if (!grade) return 'bg-slate-100 text-slate-500';
    if (grade.startsWith('A')) return 'bg-emerald-100 text-emerald-700';
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-700';
    if (grade.startsWith('C')) return 'bg-amber-100 text-amber-700';
    if (grade.startsWith('D') || grade.startsWith('E')) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  const publishedGroups = groups.filter(g => g.published);
  const unpublishedCount = groups.length - publishedGroups.length;
  const selectedChildObj = children.find(c => c.id === selectedChild);
  const bestGroup = publishedGroups.length > 0 ? publishedGroups.reduce((a, b) => (a.avg > b.avg ? a : b)) : null;
  const overallAvg = publishedGroups.length > 0
    ? Math.round(publishedGroups.reduce((s, g) => s + g.avg, 0) / publishedGroups.length)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Exam Results</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          Could not load results: {error}
        </div>
      )}

      {children.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No children linked to your account</p>
          <p className="text-sm text-slate-400 mt-1">Please contact the school admin to link your ward.</p>
        </div>
      ) : (
        <>
          {children.length > 1 && (
            <div className="relative w-64">
              <select
                value={selectedChild}
                onChange={e => setSelectedChild(e.target.value)}
                className="w-full appearance-none border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white pr-9"
              >
                {children.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          )}

          {!resultsLoading && publishedGroups.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <TrendingUp className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-800">{overallAvg}%</p>
                <p className="text-xs text-slate-500 mt-0.5">Average Score</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <Award className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-800 truncate">
                  {bestGroup ? `${bestGroup.termName} ${bestGroup.yearName}` : '—'}
                </p>
                <p className="text-xs text-emerald-600">{bestGroup ? `${bestGroup.avg}%` : ''}</p>
                <p className="text-xs text-slate-500">Best Term</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <CheckCircle2 className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-800">{publishedGroups.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Published Terms</p>
              </div>
            </div>
          )}

          {resultsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : publishedGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
              {unpublishedCount > 0 ? (
                <>
                  <Clock className="w-12 h-12 text-amber-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">Results are awaiting publication</p>
                  <p className="text-sm text-slate-400 mt-1">
                    {selectedChildObj ? `${(selectedChildObj as any).first_name}'s results have been recorded but not yet released by the school.` : ''}
                  </p>
                </>
              ) : (
                <>
                  <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No exam results available</p>
                  <p className="text-sm text-slate-400 mt-1">
                    {selectedChildObj ? `${(selectedChildObj as any).first_name} has no recorded results yet` : ''}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {unpublishedCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3">
                  {unpublishedCount} more term{unpublishedCount > 1 ? 's are' : ' is'} awaiting publication by the school.
                </div>
              )}
              {publishedGroups.map(group => (
                <div key={group.key} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-800 text-lg">{group.termName} {group.yearName && `· ${group.yearName}`}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">Class: {group.className}</p>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> Published
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-sm text-slate-500">Subjects: <span className="font-semibold text-slate-800">{group.rows.length}</span></span>
                      <span className="text-sm text-slate-500">Average: <span className="font-semibold text-emerald-600">{group.avg}%</span></span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Subject</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">CA1</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">CA2</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">CA3</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Exam</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.rows.map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3.5 font-medium text-slate-800">
                              {(r.subjects as any)?.name || '—'}
                            </td>
                            <td className="px-3 py-3.5 text-center text-slate-600">{r.ca1_score ?? 0}</td>
                            <td className="px-3 py-3.5 text-center text-slate-600">{r.ca2_score ?? 0}</td>
                            <td className="px-3 py-3.5 text-center text-slate-600">{r.ca3_score ?? 0}</td>
                            <td className="px-3 py-3.5 text-center text-slate-600">{r.exam_score ?? 0}</td>
                            <td className="px-3 py-3.5 text-center font-semibold text-slate-800">{totalOf(r)}</td>
                            <td className="px-3 py-3.5 text-center">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${gradeColor(r.grade)}`}>{r.grade || '—'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
