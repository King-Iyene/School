import { useEffect, useState } from 'react';
import { Award, Calendar, FileText, GraduationCap, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getOverallRemark } from '../../lib/grading';
import { useAuth } from '../../context/AuthContext';
import StudentReportPrint from '../../components/print/StudentReportPrint';

interface TermResult {
  term_id: string;
  term_name: string;
  academic_year_id: string;
  academic_year_name: string;
  class_id: string | null;
  class_name: string;
  subject_count: number;
  total: number;
  average: number;
  position: number | null;
  class_size: number | null;
  remark: string;
  published: boolean;
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}


function remarkColor(remark: string): string {
  switch (remark) {
    case 'Excellent': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'Very Good': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Good': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Pass': return 'bg-orange-100 text-orange-700 border-orange-200';
    default: return 'bg-red-100 text-red-700 border-red-200';
  }
}

export default function StudentGrades() {
  const { profile } = useAuth();
  const [termResults, setTermResults] = useState<TermResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<{ termId: string; yearId: string } | null>(null);

  useEffect(() => { load(); }, [profile?.id]);

  async function load() {
    if (!profile?.id) return;
    setLoading(true);

    const { data: myGrades } = await supabase
      .from('grades')
      .select('term_id, academic_year_id, class_id, subject_id, total_score, ca1_score, ca3_score, exam_score, terms(name), academic_years(name), classes(name, level, section)')
      .eq('student_id', profile.id);

    // Exclusions for this student (term-aware). If the fetch errors/returns nothing, scores count as today.
    const { data: myExclusions } = await supabase
      .from('student_subject_exclusions')
      .select('subject_id, academic_year_id, term_id')
      .eq('student_id', profile.id);
    const isExcluded = (subjectId: string, yearId: string, termId: string) =>
      (myExclusions ?? []).some((e: any) =>
        e.subject_id === subjectId && e.academic_year_id === yearId && (e.term_id == null || e.term_id === termId));

    const termsMap = new Map<string, {
      term_id: string; term_name: string;
      academic_year_id: string; academic_year_name: string;
      class_id: string | null; class_name: string;
      myTotals: number[];
    }>();

    for (const g of myGrades ?? []) {
      const total = (g as any).total_score ?? (((g as any).ca1_score || 0) + ((g as any).ca3_score || 0) + ((g as any).exam_score || 0));
      if (total == null) continue; // zero counts (missed exam); only skip rows with no total
      if (isExcluded(g.subject_id, g.academic_year_id, g.term_id)) continue;
      const key = `${g.term_id}::${g.academic_year_id}`;
      const cls = (g as any).classes;
      const className = cls?.name || `${cls?.level ?? ''}${cls?.section ? '-' + cls.section : ''}` || '—';
      if (!termsMap.has(key)) {
        termsMap.set(key, {
          term_id: g.term_id,
          term_name: ((g as any).terms?.name) ?? '—',
          academic_year_id: g.academic_year_id,
          academic_year_name: ((g as any).academic_years?.name) ?? '—',
          class_id: g.class_id,
          class_name: className,
          myTotals: [],
        });
      }
      termsMap.get(key)!.myTotals.push(total);
    }

    const compilationKeys = Array.from(termsMap.values());
    const publishedSet = new Set<string>();
    if (compilationKeys.length > 0) {
      const { data: comps } = await supabase
        .from('result_compilations')
        .select('class_id, term_id, academic_year_id, status')
        .in('term_id', compilationKeys.map(c => c.term_id));
      for (const c of comps ?? []) {
        if (c.status === 'published') {
          publishedSet.add(`${c.class_id}::${c.term_id}::${c.academic_year_id}`);
        }
      }
    }

    const results: TermResult[] = [];
    for (const t of termsMap.values()) {
      const total = t.myTotals.reduce((s, n) => s + n, 0);
      const avg = t.myTotals.length > 0 ? total / t.myTotals.length : 0;

      let position: number | null = null;
      let classSize: number | null = null;
      if (t.class_id) {
        const [{ data: classGrades }, { data: classExclusions }] = await Promise.all([
          supabase
            .from('grades')
            .select('student_id, subject_id, total_score, ca1_score, ca3_score, exam_score')
            .eq('class_id', t.class_id)
            .eq('term_id', t.term_id)
            .eq('academic_year_id', t.academic_year_id),
          supabase
            .from('student_subject_exclusions')
            .select('student_id, subject_id, term_id')
            .eq('class_id', t.class_id)
            .eq('academic_year_id', t.academic_year_id),
        ]);
        // Term-aware: term_id null = whole year, else must match this term.
        const classExclSet = new Set<string>(
          (classExclusions ?? [])
            .filter((e: any) => e.term_id == null || e.term_id === t.term_id)
            .map((e: any) => `${e.student_id}:${e.subject_id}`)
        );

        const sums: Record<string, { sum: number; count: number }> = {};
        for (const cg of classGrades ?? []) {
          const ct = (cg as any).total_score ?? (((cg as any).ca1_score || 0) + ((cg as any).ca3_score || 0) + ((cg as any).exam_score || 0));
          if (ct == null) continue; // zero counts; only skip rows with no total
          if (classExclSet.has(`${cg.student_id}:${(cg as any).subject_id}`)) continue;
          if (!sums[cg.student_id]) sums[cg.student_id] = { sum: 0, count: 0 };
          sums[cg.student_id].sum += ct;
          sums[cg.student_id].count += 1;
        }
        const avgs = Object.entries(sums).map(([sid, v]) => ({ sid, avg: v.count > 0 ? v.sum / v.count : 0 }));
        if (avgs.length > 0) {
          const me = avgs.find(x => x.sid === profile.id);
          if (me) {
            const higher = new Set(avgs.filter(x => x.avg > me.avg).map(x => x.avg.toFixed(4))).size;
            position = higher + 1;
          }
          classSize = avgs.length;
        }
      }

      const published = t.class_id ? publishedSet.has(`${t.class_id}::${t.term_id}::${t.academic_year_id}`) : false;

      results.push({
        term_id: t.term_id,
        term_name: t.term_name,
        academic_year_id: t.academic_year_id,
        academic_year_name: t.academic_year_name,
        class_id: t.class_id,
        class_name: t.class_name,
        subject_count: t.myTotals.length,
        total,
        average: avg,
        position,
        class_size: classSize,
        remark: getOverallRemark(avg),
        published,
      });
    }

    results.sort((a, b) => {
      if (a.academic_year_name !== b.academic_year_name) {
        return b.academic_year_name.localeCompare(a.academic_year_name);
      }
      return b.term_name.localeCompare(a.term_name);
    });

    setTermResults(results);
    setLoading(false);
  }

  if (viewing) {
    return (
      <StudentReportPrint
        studentId={profile!.id}
        termId={viewing.termId}
        academicYearId={viewing.yearId}
        onClose={() => setViewing(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">My Results</h2>
          <p className="text-app-text-muted text-sm">Your term-by-term academic performance history</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm py-16 text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-app-text-muted text-sm">Loading your results...</p>
        </div>
      ) : termResults.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm py-16 text-center">
          <Award className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-app-text-muted font-medium">No results recorded yet</p>
          <p className="text-app-text-muted text-sm mt-1">Your term results will appear here once published</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {termResults.map(r => {
            const locked = !r.published;
            return (
              <div
                key={`${r.term_id}-${r.academic_year_id}`}
                className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="px-5 py-4 border-b border-app-border bg-gradient-to-r from-emerald-50 to-blue-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-app-text flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        {r.term_name} — {r.academic_year_name}
                      </h3>
                      <p className="text-xs text-app-text-muted mt-1 flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5" />
                        Class: {r.class_name}
                      </p>
                    </div>
                    {locked ? (
                      <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-200 text-app-text-muted px-2 py-1 rounded">
                        Pending
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold tracking-wider bg-app-primary text-white px-2 py-1 rounded">
                        Published
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x divide-app-border">
                  <div className="p-4 text-center">
                    <p className="text-[10px] uppercase font-semibold text-app-text-muted tracking-wide">Average</p>
                    <p className="text-2xl font-black text-emerald-600 mt-1">{r.average.toFixed(2)}%</p>
                    <p className="text-[10px] text-app-text-muted mt-0.5">{r.subject_count} subjects</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-[10px] uppercase font-semibold text-app-text-muted tracking-wide">Position</p>
                    <p className="text-2xl font-black text-blue-600 mt-1">
                      {r.position ? getOrdinal(r.position) : '—'}
                    </p>
                    {r.class_size && <p className="text-[10px] text-app-text-muted mt-0.5">of {r.class_size}</p>}
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-[10px] uppercase font-semibold text-app-text-muted tracking-wide">Remark</p>
                    <span className={`inline-block mt-1 text-sm font-bold px-3 py-1 rounded-lg border ${remarkColor(r.remark)}`}>
                      {r.remark}
                    </span>
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-app-border bg-app-surface-alt">
                  {locked ? (
                    <p className="text-xs text-app-text-muted text-center italic">
                      Results not yet published. Full report will be available once your class teacher publishes.
                    </p>
                  ) : (
                    <button
                      onClick={() => setViewing({ termId: r.term_id, yearId: r.academic_year_id })}
                      className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      View Full Report
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
