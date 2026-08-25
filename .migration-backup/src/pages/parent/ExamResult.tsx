import { useState, useEffect } from 'react';
import { Award, ChevronDown, Users, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function ExamResult() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    async function loadChildren() {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('parent_student_links')
        .select('*, students!student_id(id, first_name, last_name)')
        .eq('parent_id', profile.id);
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
      const { data } = await supabase
        .from('exam_results')
        .select('*, exams(id, name, start_date, end_date), subjects(name)')
        .eq('student_id', selectedChild)
        .order('created_at', { ascending: false });
      setResults(data ?? []);
      setResultsLoading(false);
    }
    loadResults();
  }, [selectedChild]);

  const gradeFor = (pct: number) => {
    if (pct >= 90) return { label: 'A+', color: 'bg-emerald-100 text-emerald-700' };
    if (pct >= 80) return { label: 'A', color: 'bg-emerald-100 text-emerald-700' };
    if (pct >= 70) return { label: 'B', color: 'bg-blue-100 text-blue-700' };
    if (pct >= 60) return { label: 'C', color: 'bg-amber-100 text-amber-700' };
    if (pct >= 50) return { label: 'D', color: 'bg-orange-100 text-orange-700' };
    return { label: 'F', color: 'bg-red-100 text-red-700' };
  };

  const groupedByExam: Record<string, any[]> = {};
  for (const r of results) {
    const examId = r.exam_id || (r.exams as any)?.id || 'unknown';
    if (!groupedByExam[examId]) groupedByExam[examId] = [];
    groupedByExam[examId].push(r);
  }

  const examGroups = Object.entries(groupedByExam).map(([examId, rows]) => {
    const exam = rows[0]?.exams as any;
    const total = rows.reduce((s, r) => s + (r.marks_obtained || 0), 0);
    const maxTotal = rows.reduce((s, r) => s + (r.max_marks || 0), 0);
    const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
    const passed = pct >= 50;
    return { examId, exam, rows, total, maxTotal, pct, passed };
  });

  const allScores = results.filter(r => r.max_marks > 0).map(r => (r.marks_obtained / r.max_marks) * 100);
  const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
  const passedExams = examGroups.filter(g => g.passed).length;
  const passRate = examGroups.length > 0 ? Math.round((passedExams / examGroups.length) * 100) : 0;
  const bestExam = examGroups.length > 0 ? examGroups.reduce((a, b) => a.pct > b.pct ? a : b) : null;

  const selectedChildObj = children.find(c => c.id === selectedChild);

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

      {children.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No children linked to your account</p>
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

          {!resultsLoading && results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <TrendingUp className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-800">{avgScore}%</p>
                <p className="text-xs text-slate-500 mt-0.5">Average Score</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <Award className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-800 truncate">{bestExam?.exam?.name || '—'}</p>
                <p className="text-xs text-emerald-600">{bestExam ? `${bestExam.pct}%` : ''}</p>
                <p className="text-xs text-slate-500">Best Performance</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <CheckCircle2 className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-800">{passRate}%</p>
                <p className="text-xs text-slate-500 mt-0.5">Pass Rate</p>
              </div>
            </div>
          )}

          {resultsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : examGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
              <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No exam results available</p>
              <p className="text-sm text-slate-400 mt-1">
                {selectedChildObj ? `${(selectedChildObj as any).first_name} has no recorded results yet` : ''}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {examGroups.map(group => {
                const g = gradeFor(group.pct);
                return (
                  <div key={group.examId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-800 text-lg">{group.exam?.name || 'Exam'}</h3>
                          {(group.exam?.start_date || group.exam?.end_date) && (
                            <p className="text-sm text-slate-500 mt-0.5">
                              {group.exam.start_date ? new Date(group.exam.start_date).toLocaleDateString() : ''}
                              {group.exam.start_date && group.exam.end_date ? ' – ' : ''}
                              {group.exam.end_date ? new Date(group.exam.end_date).toLocaleDateString() : ''}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${g.color}`}>{g.label}</span>
                          {group.passed ? (
                            <span className="flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> Pass
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-semibold bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
                              <XCircle className="w-3 h-3" /> Fail
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="text-sm text-slate-500">Total: <span className="font-semibold text-slate-800">{group.total}/{group.maxTotal}</span></span>
                        <span className="text-sm text-slate-500">Percentage: <span className="font-semibold text-emerald-600">{group.pct}%</span></span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Subject</th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Max Marks</th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Obtained</th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Grade</th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.rows.map((r: any) => {
                            const pct = r.max_marks > 0 ? Math.round((r.marks_obtained / r.max_marks) * 100) : 0;
                            const grade = gradeFor(pct);
                            return (
                              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-5 py-3.5 font-medium text-slate-800">{(r.subjects as any)?.name || '—'}</td>
                                <td className="px-5 py-3.5 text-slate-600">{r.max_marks ?? '—'}</td>
                                <td className="px-5 py-3.5 text-slate-800 font-semibold">{r.marks_obtained ?? '—'}</td>
                                <td className="px-5 py-3.5">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${grade.color}`}>{r.grade || grade.label}</span>
                                </td>
                                <td className="px-5 py-3.5 text-slate-600">{pct}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
