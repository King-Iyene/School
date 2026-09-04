import { useState, useEffect } from 'react';
import { ClipboardList, Calendar, Clock, MapPin, Award, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getWAECGrade } from '../../lib/grading';
import { useAuth } from '../../context/AuthContext';

interface ExamRecord {
  exam_id: string;
  exam_name: string;
  subject_name: string;
  ca: number;
  test: number;
  exam: number;
  total: number;
  grade: string;
  remark: string;
  is_absent: boolean;
}

interface ExamGroup {
  exam_id: string;
  exam_name: string;
  subjects: ExamRecord[];
  aggregate: number;
  average: number;
}


function gradeColor(grade: string) {
  if (grade.startsWith('A')) return 'text-emerald-700 bg-emerald-50';
  if (grade.startsWith('B')) return 'text-blue-700 bg-blue-50';
  if (grade.startsWith('C')) return 'text-amber-700 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

export default function Examinations() {
  const { profile } = useAuth();
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [examGroups, setExamGroups] = useState<ExamGroup[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile?.id) return;
      const { data: enroll } = await supabase
        .from('student_enrollments')
        .select('class_id')
        .eq('student_id', profile.id)
        .eq('status', 'active')
        .maybeSingle();
      const cid = enroll?.class_id || null;

      const today = new Date().toISOString().split('T')[0];

      const [scheduleRes, marksRes] = await Promise.all([
        cid
          ? supabase
              .from('exam_schedule')
              .select('*, exams(id, name, start_date, end_date), subjects(name)')
              .eq('class_id', cid)
              .gte('exam_date', today)
              .order('exam_date', { ascending: true })
          : Promise.resolve({ data: [] }),
        supabase
          .from('exam_marks_records')
          .select('exam_name_id, ca1, ca3, exam, is_absent, subjects(id, name), exams(id, name)')
          .eq('student_id', profile.id),
      ]);

      setUpcoming(scheduleRes.data ?? []);

      const records = marksRes.data ?? [];
      const groupMap: Record<string, ExamGroup> = {};
      for (const r of records as any[]) {
        const examId = r.exam_name_id;
        const examName = r.exams?.name ?? 'Unknown Exam';
        const ca = r.ca1 ?? 0;
        const test = r.ca3 ?? 0;
        const examVal = r.exam ?? 0;
        const total = r.is_absent ? 0 : ca + test + examVal;
        const { grade, remark } = getWAECGrade(total);
        // Skip subjects with zero total and not absent — no meaningful result recorded
        if (!r.is_absent && total === 0) continue;
        const subject: ExamRecord = {
          exam_id: examId,
          exam_name: examName,
          subject_name: r.subjects?.name ?? 'Unknown',
          ca,
          test,
          exam: examVal,
          total,
          grade: r.is_absent ? 'ABS' : grade,
          remark: r.is_absent ? 'Absent' : remark,
          is_absent: r.is_absent ?? false,
        };
        if (!groupMap[examId]) {
          groupMap[examId] = { exam_id: examId, exam_name: examName, subjects: [], aggregate: 0, average: 0 };
        }
        groupMap[examId].subjects.push(subject);
      }
      const groups = Object.values(groupMap).map(g => {
        const presented = g.subjects.filter(s => !s.is_absent);
        const agg = presented.reduce((sum, s) => sum + s.total, 0);
        return { ...g, aggregate: agg, average: presented.length > 0 ? agg / presented.length : 0 };
      });
      groups.sort((a, b) => a.exam_name.localeCompare(b.exam_name));
      setExamGroups(groups);
      if (groups.length > 0) setSelectedExam(groups[0].exam_id);
      setLoading(false);
    }
    load();
  }, [profile]);

  const selectedGroup = examGroups.find(g => g.exam_id === selectedExam);
  const examsTaken = examGroups.length;
  const overallAvg = examGroups.length > 0
    ? Math.round(examGroups.reduce((sum, g) => sum + g.average, 0) / examGroups.length)
    : 0;
  const allSubjects = examGroups.flatMap(g => g.subjects.filter(s => !s.is_absent));
  const subjectAvg: Record<string, { name: string; total: number; count: number }> = {};
  for (const s of allSubjects) {
    if (!subjectAvg[s.subject_name]) subjectAvg[s.subject_name] = { name: s.subject_name, total: 0, count: 0 };
    subjectAvg[s.subject_name].total += s.total;
    subjectAvg[s.subject_name].count += 1;
  }
  const subjectList = Object.values(subjectAvg).map(s => ({ name: s.name, avg: s.total / s.count }));
  const bestSubject = subjectList.length > 0 ? subjectList.reduce((a, b) => a.avg > b.avg ? a : b) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-app-text">Examinations</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 text-center">
          <ClipboardList className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-app-text">{examsTaken}</p>
          <p className="text-xs text-app-text-muted mt-0.5">Exams Taken</p>
        </div>
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 text-center">
          <Award className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-app-text">{overallAvg}</p>
          <p className="text-xs text-app-text-muted mt-0.5">Overall Average</p>
        </div>
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 text-center">
          <BookOpen className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-app-text truncate">{bestSubject?.name || '—'}</p>
          <p className="text-xs text-emerald-600 mt-0.5">{bestSubject ? `${Math.round(bestSubject.avg)}/100` : ''}</p>
          <p className="text-xs text-app-text-muted">Best Subject</p>
        </div>
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 text-center">
          <Calendar className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-app-text">{upcoming.length}</p>
          <p className="text-xs text-app-text-muted mt-0.5">Upcoming Exams</p>
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-app-border flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-app-text">Upcoming Exams</h2>
            <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-1 rounded-full">{upcoming.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-app-surface-alt">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-app-text-muted uppercase">Subject</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-app-text-muted uppercase">Exam</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-app-text-muted uppercase">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-app-text-muted uppercase">Time</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-app-text-muted uppercase">Duration</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-app-text-muted uppercase">Room</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {upcoming.map(item => (
                  <tr key={item.id} className="hover:bg-app-surface-alt transition-colors">
                    <td className="px-5 py-3.5 font-medium text-app-text">{(item.subjects as any)?.name || '—'}</td>
                    <td className="px-5 py-3.5 text-app-text-muted">{(item.exams as any)?.name || '—'}</td>
                    <td className="px-5 py-3.5 text-app-text-muted">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-app-text-muted" />
                        {item.exam_date ? new Date(item.exam_date).toLocaleDateString() : '—'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-app-text-muted">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-app-text-muted" />
                        {item.start_time || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-app-text-muted">{item.duration ? `${item.duration} min` : '—'}</td>
                    <td className="px-5 py-3.5 text-app-text-muted">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-app-text-muted" />
                        {item.room || '—'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-app-border flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-600" />
          <h2 className="font-semibold text-app-text">My Results</h2>
          <span className="ml-auto text-xs bg-slate-100 text-app-text-muted font-semibold px-2.5 py-1 rounded-full">{examsTaken} exam{examsTaken !== 1 ? 's' : ''}</span>
        </div>

        {examGroups.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-app-text-muted">No exam results available yet</p>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4 flex gap-2 flex-wrap border-b border-app-border pb-4">
              {examGroups.map(g => (
                <button
                  key={g.exam_id}
                  onClick={() => setSelectedExam(g.exam_id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                    selectedExam === g.exam_id
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                      : 'bg-app-surface text-app-text-muted border-app-border hover:border-emerald-300'
                  }`}
                >
                  {g.exam_name}
                </button>
              ))}
            </div>

            {selectedGroup && (
              <>
                <div className="grid grid-cols-3 divide-x divide-app-border border-b border-app-border">
                  <div className="p-4 text-center">
                    <p className="text-lg font-black text-app-text">{selectedGroup.aggregate}</p>
                    <p className="text-xs text-app-text-muted">Aggregate</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-lg font-black text-emerald-600">{selectedGroup.average.toFixed(1)}</p>
                    <p className="text-xs text-app-text-muted">Average (out of 100)</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className={`text-lg font-black ${selectedGroup.average >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {getWAECGrade(selectedGroup.average).grade}
                    </p>
                    <p className="text-xs text-app-text-muted">Overall Grade</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-app-surface-alt">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-app-text-muted uppercase">Subject</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-app-text-muted uppercase">CA (10)</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-app-text-muted uppercase">Test (30)</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-app-text-muted uppercase">Exam (60)</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-app-text-muted uppercase">Total (100)</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-app-text-muted uppercase">Grade</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-app-text-muted uppercase">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border">
                      {selectedGroup.subjects.map((s, idx) => (
                        <tr key={idx} className={`hover:bg-app-surface-alt transition-colors ${s.is_absent ? 'bg-red-50/30' : ''}`}>
                          <td className="px-5 py-3.5 font-medium text-app-text">{s.subject_name}</td>
                          <td className="px-4 py-3.5 text-center text-app-text-muted">{s.is_absent ? '—' : s.ca}</td>
                          <td className="px-4 py-3.5 text-center text-app-text-muted">{s.is_absent ? '—' : s.test}</td>
                          <td className="px-4 py-3.5 text-center text-app-text-muted">{s.is_absent ? '—' : s.exam}</td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`font-black ${s.is_absent ? 'text-slate-300' : 'text-app-text'}`}>
                              {s.is_absent ? 'ABS' : s.total}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {!s.is_absent && (
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${gradeColor(s.grade)}`}>
                                {s.grade}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-app-text-muted text-sm">{s.remark}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
