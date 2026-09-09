import { useState, useEffect } from 'react';
import { Monitor, CheckCircle, XCircle, BarChart2, Download, AlertCircle, ClipboardEdit } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface TheoryAnswer {
  id: string;
  question_text: string;
  marks: number;
  marks_awarded: number | null;
  student_answer: string;
}

interface AttemptRecord {
  id: string;
  student_name: string;
  class_name: string;
  attempt_date: string;
  score: number;
  total: number;
  percentage: number;
  time_taken: number;
  status: 'in_progress' | 'pending' | 'passed' | 'failed';
}

interface AcademicYear {
  id: string;
  name: string;
}

interface Exam {
  id: string;
  name: string;
}

interface Class {
  id: string;
  name: string;
}

export default function OnlineExamReport() {
  const { profile } = useAuth();
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableExists, setTableExists] = useState<boolean | null>(null);
  const [showToast, setShowToast] = useState(false);

  const [filters, setFilters] = useState({
    academic_year_id: '',
    exam_id: '',
    class_id: '',
  });

  const [gradingAttemptId, setGradingAttemptId] = useState<string | null>(null);
  const [gradingQuestions, setGradingQuestions] = useState<TheoryAnswer[]>([]);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingSaving, setGradingSaving] = useState(false);

  async function openGrading(attemptId: string) {
    setGradingAttemptId(attemptId);
    setGradingLoading(true);
    const { data } = await supabase
      .from('online_exam_attempt_questions')
      .select('id, marks, marks_awarded, student_answer, question_bank(question_text)')
      .eq('attempt_id', attemptId)
      .eq('question_type', 'theory')
      .order('sort_order', { ascending: true });
    setGradingQuestions(
      (data || []).map((r: any) => ({
        id: r.id,
        question_text: r.question_bank?.question_text ?? 'Question',
        marks: Number(r.marks),
        marks_awarded: r.marks_awarded === null ? null : Number(r.marks_awarded),
        student_answer: r.student_answer ?? '',
      })),
    );
    setGradingLoading(false);
  }

  async function saveGrading() {
    setGradingSaving(true);
    await Promise.all(
      gradingQuestions.map((q) =>
        supabase
          .from('online_exam_attempt_questions')
          .update({ marks_awarded: q.marks_awarded ?? 0 })
          .eq('id', q.id),
      ),
    );
    setGradingSaving(false);
    setGradingAttemptId(null);
    fetchAttempts();
  }

  useEffect(() => {
    checkTableAndFetchBase();
  }, []);

  useEffect(() => {
    if (tableExists) fetchAttempts();
  }, [filters, tableExists]);

  async function checkTableAndFetchBase() {
    const { error } = await supabase.from('online_exam_attempts').select('id').limit(1);
    const exists = !error || error.code !== '42P01';
    setTableExists(exists);

    const [yearsRes, classesRes, examsRes] = await Promise.all([
      supabase.from('academic_years').select('id, name').eq('school_id', profile?.school_id).order('name'),
      supabase.from('classes').select('id, name').eq('school_id', profile?.school_id).order('name'),
      supabase.from('exams').select('id, name').eq('school_id', profile?.school_id).eq('type', 'online').order('name'),
    ]);
    if (yearsRes.data) setAcademicYears(yearsRes.data);
    if (classesRes.data) setClasses(classesRes.data);
    if (examsRes.data) setExams(examsRes.data);
  }

  async function fetchAttempts() {
    if (!tableExists) return;
    setLoading(true);
    let query = supabase
      .from('online_exam_attempts')
      .select(
        'id, status, started_at, submitted_at, score, total_marks, time_taken_seconds, exams(name), students!student_id(first_name, last_name, classes(name))',
      )
      .eq('school_id', profile?.school_id)
      .order('started_at', { ascending: false });

    if (filters.exam_id) query = query.eq('exam_id', filters.exam_id);
    if (filters.class_id) {
      const cls = classes.find(c => c.id === filters.class_id);
      if (cls) query = query.eq('students.class_id', filters.class_id);
    }

    const { data } = await query;
    const mapped: AttemptRecord[] = (data || []).map((d: any) => {
      const total = Number(d.total_marks) || 0;
      const score = d.score === null ? 0 : Number(d.score);
      const pct = total > 0 ? Math.round((score / total) * 100) : 0;
      const status: AttemptRecord['status'] =
        d.status === 'in_progress' ? 'in_progress' : d.score === null ? 'pending' : pct >= 40 ? 'passed' : 'failed';
      return {
        id: d.id,
        student_name: d.students ? `${d.students.first_name} ${d.students.last_name}` : 'Unknown',
        class_name: d.students?.classes?.name || '-',
        attempt_date: d.submitted_at || d.started_at,
        score,
        total,
        percentage: pct,
        time_taken: Math.round((Number(d.time_taken_seconds) || 0) / 60),
        status,
      };
    });
    setAttempts(mapped);
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const gradedAttempts = attempts.filter(a => a.status === 'passed' || a.status === 'failed');
  const avgScore = gradedAttempts.length > 0
    ? Math.round(gradedAttempts.reduce((s, a) => s + a.percentage, 0) / gradedAttempts.length)
    : 0;
  const passRate = gradedAttempts.length > 0
    ? Math.round((gradedAttempts.filter(a => a.status === 'passed').length / gradedAttempts.length) * 100)
    : 0;

  if (tableExists === false) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-app-text">Online Exam Report</h1>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-16 flex flex-col items-center gap-4 text-center">
          <div className="bg-slate-100 p-6 rounded-full">
            <Monitor className="h-16 w-16 text-app-text-muted" />
          </div>
          <h2 className="text-xl font-semibold text-app-text">No Online Exam Data Available</h2>
          <p className="text-app-text-muted max-w-md">
            The online exam attempts table has not been set up yet. Once students begin taking online exams, their attempts and results will appear here.
          </p>
          <div className="flex items-center gap-2 mt-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">Online exam functionality needs to be configured in the system settings.</p>
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
        <h1 className="text-2xl font-bold text-app-text">Online Exam Report</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <select
            value={filters.exam_id}
            onChange={e => setFilters(f => ({ ...f, exam_id: e.target.value }))}
            className="bg-app-surface text-app-text border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
          >
            <option value="">All Online Exams</option>
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>

          <select
            value={filters.class_id}
            onChange={e => setFilters(f => ({ ...f, class_id: e.target.value }))}
            className="bg-app-surface text-app-text border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
          >
            <option value="">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Total Attempts</p>
              <p className="text-2xl font-bold text-app-text mt-1">{attempts.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Monitor className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Average Score</p>
              <p className="text-2xl font-bold text-app-text mt-1">{avgScore}%</p>
            </div>
            <div className="bg-amber-100 p-3 rounded-lg">
              <BarChart2 className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Pass Rate</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{passRate}%</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-lg">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
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
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Class</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Attempt Date</th>
                <th className="text-center px-4 py-3 text-app-text-muted font-medium">Score</th>
                <th className="text-center px-4 py-3 text-app-text-muted font-medium">Total</th>
                <th className="text-center px-4 py-3 text-app-text-muted font-medium">Percentage</th>
                <th className="text-center px-4 py-3 text-app-text-muted font-medium">Time (mins)</th>
                <th className="text-center px-4 py-3 text-app-text-muted font-medium">Status</th>
                <th className="text-center px-4 py-3 text-app-text-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-app-text-muted">Loading...</td>
                </tr>
              ) : attempts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-app-text-muted">No attempts found</td>
                </tr>
              ) : (
                attempts.map((attempt, index) => (
                  <tr key={attempt.id} className="border-b border-app-border hover:bg-app-surface-alt">
                    <td className="px-4 py-3 text-app-text-muted">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-app-text">{attempt.student_name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{attempt.class_name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{new Date(attempt.attempt_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-center font-medium text-app-text">{attempt.score}</td>
                    <td className="px-4 py-3 text-center text-app-text-muted">{attempt.total}</td>
                    <td className="px-4 py-3 text-center font-medium text-app-text">{attempt.percentage}%</td>
                    <td className="px-4 py-3 text-center text-app-text-muted">{attempt.time_taken}</td>
                    <td className="px-4 py-3 text-center">
                      {attempt.status === 'in_progress' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          In Progress
                        </span>
                      )}
                      {attempt.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-app-text-muted">
                          Pending Grading
                        </span>
                      )}
                      {attempt.status === 'passed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <CheckCircle className="h-3 w-3" />
                          Passed
                        </span>
                      )}
                      {attempt.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <XCircle className="h-3 w-3" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {attempt.status === 'pending' && (
                        <button
                          onClick={() => openGrading(attempt.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium transition-colors"
                        >
                          <ClipboardEdit className="h-3 w-3" /> Grade
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!gradingAttemptId} onClose={() => setGradingAttemptId(null)} title="Grade Theory Answers" size="lg">
        {gradingLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            {gradingQuestions.map((q, idx) => (
              <div key={q.id} className="border border-app-border rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium text-app-text">{idx + 1}. {q.question_text}</p>
                <p className="text-sm text-app-text-muted bg-app-surface-alt rounded-lg p-3 whitespace-pre-wrap">{q.student_answer || '(no answer)'}</p>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-app-text-muted">Marks (max {q.marks})</label>
                  <input
                    type="number"
                    min={0}
                    max={q.marks}
                    className="w-20 bg-app-surface text-app-text border border-app-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
                    value={q.marks_awarded ?? ''}
                    onChange={(e) => {
                      const val = Math.min(q.marks, Math.max(0, parseFloat(e.target.value) || 0));
                      setGradingQuestions(prev => prev.map((item, i) => (i === idx ? { ...item, marks_awarded: val } : item)));
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setGradingAttemptId(null)} className="px-4 py-2 text-sm rounded-xl border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors">
                Cancel
              </button>
              <button
                onClick={saveGrading}
                disabled={gradingSaving}
                className="px-4 py-2 text-sm rounded-xl bg-app-primary hover:opacity-90 text-white font-medium transition-colors disabled:opacity-50"
              >
                {gradingSaving ? 'Saving...' : 'Save Grades'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
