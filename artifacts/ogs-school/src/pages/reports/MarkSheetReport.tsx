import { useState, useEffect } from 'react';
import { Printer, FileText, Download, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

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

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  roll_number: string;
  section_name: string;
}

interface SubjectResult {
  subject_name: string;
  max_marks: number;
  obtained_marks: number;
  grade: string;
}

function getGrade(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

export default function MarkSheetReport() {
  const { profile } = useAuth();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjectResults, setSubjectResults] = useState<SubjectResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const [filters, setFilters] = useState({
    academic_year_id: '',
    exam_id: '',
    class_id: '',
    student_id: '',
  });

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    if (filters.academic_year_id) {
      fetchExams(filters.academic_year_id);
    } else {
      setExams([]);
      setFilters(f => ({ ...f, exam_id: '', class_id: '', student_id: '' }));
    }
  }, [filters.academic_year_id]);

  useEffect(() => {
    if (filters.class_id) {
      fetchStudents(filters.class_id);
    } else {
      setStudents([]);
      setFilters(f => ({ ...f, student_id: '' }));
    }
  }, [filters.class_id]);

  useEffect(() => {
    if (filters.student_id && filters.exam_id) {
      fetchMarkSheet();
    } else {
      setSubjectResults([]);
      setSelectedStudent(null);
    }
  }, [filters.student_id, filters.exam_id]);

  async function fetchBaseData() {
    const [yearsRes, classesRes] = await Promise.all([
      supabase.from('academic_years').select('id, name').eq('school_id', profile?.school_id).order('name'),
      supabase.from('classes').select('id, name').eq('school_id', profile?.school_id).order('name'),
    ]);
    if (yearsRes.data) setAcademicYears(yearsRes.data);
    if (classesRes.data) setClasses(classesRes.data);
  }

  async function fetchExams(yearId: string) {
    const { data } = await supabase
      .from('exams')
      .select('id, name')
      .eq('academic_year_id', yearId)
      .order('name');
    if (data) setExams(data);
  }

  async function fetchStudents(classId: string) {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, admission_number, roll_number, section_name')
      .eq('role', 'student')
      .eq('school_id', profile?.school_id)
      .eq('class_name', cls.name)
      .order('full_name');
    if (data) setStudents(data);
  }

  async function fetchMarkSheet() {
    setLoading(true);
    const student = students.find(s => s.id === filters.student_id);
    setSelectedStudent(student || null);

    const { data } = await supabase
      .from('exam_results')
      .select('subject_name, max_marks, obtained_marks, subjects(name)')
      .eq('exam_id', filters.exam_id)
      .eq('student_id', filters.student_id);

    const results: SubjectResult[] = (data || []).map((d: any) => {
      const max = Number(d.max_marks) || 0;
      const obtained = Number(d.obtained_marks) || 0;
      const pct = max > 0 ? Math.round((obtained / max) * 100) : 0;
      return {
        subject_name: d.subjects?.name || d.subject_name || '-',
        max_marks: max,
        obtained_marks: obtained,
        grade: getGrade(pct),
      };
    });

    setSubjectResults(results);
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const totalMax = subjectResults.reduce((s, r) => s + r.max_marks, 0);
  const totalObtained = subjectResults.reduce((s, r) => s + r.obtained_marks, 0);
  const overallPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
  const overallGrade = getGrade(overallPct);
  const result = overallPct >= 40 ? 'PASS' : 'FAIL';

  const selectedClass = classes.find(c => c.id === filters.class_id);
  const selectedExam = exams.find(e => e.id === filters.exam_id);
  const selectedYear = academicYears.find(y => y.id === filters.academic_year_id);

  return (
    <div className="space-y-6">
      {showToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <CheckCircle className="h-5 w-5" />
          <span>Report exported successfully!</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-text">Mark Sheet Report</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          {subjectResults.length > 0 && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          )}
        </div>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <select
            value={filters.academic_year_id}
            onChange={e => setFilters(f => ({ ...f, academic_year_id: e.target.value, exam_id: '', class_id: '', student_id: '' }))}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select Academic Year *</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>

          <select
            value={filters.exam_id}
            onChange={e => setFilters(f => ({ ...f, exam_id: e.target.value }))}
            disabled={!filters.academic_year_id}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="">Select Exam *</option>
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>

          <select
            value={filters.class_id}
            onChange={e => setFilters(f => ({ ...f, class_id: e.target.value, student_id: '' }))}
            disabled={!filters.exam_id}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="">Select Class *</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={filters.student_id}
            onChange={e => setFilters(f => ({ ...f, student_id: e.target.value }))}
            disabled={!filters.class_id}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="">Select Student</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {!filters.student_id ? (
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-12 flex flex-col items-center gap-3 text-app-text-muted">
          <FileText className="h-12 w-12 text-slate-300" />
          <p className="text-lg font-medium">Select all filters to view mark sheet</p>
          <p className="text-sm">Academic Year, Exam, Class, and Student are required</p>
        </div>
      ) : loading ? (
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-12 text-center text-app-text-muted">
          Loading...
        </div>
      ) : subjectResults.length === 0 ? (
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-12 text-center text-app-text-muted">
          No results found for this student in the selected exam
        </div>
      ) : (
        <div className="bg-app-surface rounded-xl shadow-sm border-2 border-app-border overflow-hidden print:shadow-none">
          <div className="bg-emerald-700 text-white text-center py-6 px-4">
            <h2 className="text-2xl font-bold">MARK SHEET</h2>
            <p className="text-emerald-200 mt-1">{selectedYear?.name} - {selectedExam?.name}</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 bg-app-surface-alt rounded-xl p-4 border border-app-border mb-6">
              <div className="space-y-2">
                <div className="flex gap-2 text-sm">
                  <span className="font-semibold text-app-text-muted w-32">Student Name:</span>
                  <span className="text-app-text font-medium">{selectedStudent?.full_name}</span>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="font-semibold text-app-text-muted w-32">Admission No:</span>
                  <span className="text-app-text">{selectedStudent?.admission_number || '-'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2 text-sm">
                  <span className="font-semibold text-app-text-muted w-32">Class:</span>
                  <span className="text-app-text">{selectedClass?.name}</span>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="font-semibold text-app-text-muted w-32">Section:</span>
                  <span className="text-app-text">{selectedStudent?.section_name || '-'}</span>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="font-semibold text-app-text-muted w-32">Roll No:</span>
                  <span className="text-app-text">{selectedStudent?.roll_number || '-'}</span>
                </div>
              </div>
            </div>

            <table className="w-full text-sm border border-app-border rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-slate-100 border-b border-app-border">
                  <th className="text-left px-4 py-3 font-semibold text-app-text">Subject</th>
                  <th className="text-center px-4 py-3 font-semibold text-app-text">Max Marks</th>
                  <th className="text-center px-4 py-3 font-semibold text-app-text">Obtained Marks</th>
                  <th className="text-center px-4 py-3 font-semibold text-app-text">Grade</th>
                </tr>
              </thead>
              <tbody>
                {subjectResults.map((r, i) => (
                  <tr key={i} className="border-b border-app-border">
                    <td className="px-4 py-3 text-app-text font-medium">{r.subject_name}</td>
                    <td className="px-4 py-3 text-center text-app-text-muted">{r.max_marks}</td>
                    <td className="px-4 py-3 text-center font-semibold text-app-text">{r.obtained_marks}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">{r.grade}</span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-bold border-t-2 border-app-border">
                  <td className="px-4 py-3 text-app-text">Total</td>
                  <td className="px-4 py-3 text-center text-app-text">{totalMax}</td>
                  <td className="px-4 py-3 text-center text-app-text">{totalObtained}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">{overallGrade}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-app-surface-alt rounded-xl border border-app-border">
                <p className="text-sm text-app-text-muted">Percentage</p>
                <p className="text-2xl font-bold text-app-text mt-1">{overallPct}%</p>
              </div>
              <div className="text-center p-4 bg-app-surface-alt rounded-xl border border-app-border">
                <p className="text-sm text-app-text-muted">Overall Grade</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{overallGrade}</p>
              </div>
              <div className="text-center p-4 rounded-xl border-2">
                <p className="text-sm text-app-text-muted">Result</p>
                <p className={`text-2xl font-bold mt-1 ${result === 'PASS' ? 'text-emerald-600' : 'text-red-600'}`}>{result}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
