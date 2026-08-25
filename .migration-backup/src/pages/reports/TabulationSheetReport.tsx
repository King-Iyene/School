import { useState, useEffect } from 'react';
import { Table2, Download, CheckCircle } from 'lucide-react';
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

interface StudentRow {
  student_id: string;
  roll_number: string;
  student_name: string;
  marks: Record<string, number>;
  total: number;
  average: number;
  grade: string;
  rank: number;
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

export default function TabulationSheetReport() {
  const { profile } = useAuth();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [subjectToppers, setSubjectToppers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const [filters, setFilters] = useState({
    academic_year_id: '',
    exam_id: '',
    class_id: '',
  });

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    if (filters.academic_year_id) {
      fetchExams(filters.academic_year_id);
    } else {
      setExams([]);
      setFilters(f => ({ ...f, exam_id: '', class_id: '' }));
    }
  }, [filters.academic_year_id]);

  useEffect(() => {
    if (filters.exam_id && filters.class_id) {
      fetchTabulation();
    } else {
      setRows([]);
      setSubjects([]);
    }
  }, [filters.exam_id, filters.class_id]);

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

  async function fetchTabulation() {
    setLoading(true);
    const cls = classes.find(c => c.id === filters.class_id);

    const { data: results } = await supabase
      .from('exam_results')
      .select('student_id, subject_name, obtained_marks, max_marks, subjects(name), students(first_name, last_name, admission_number)')
      .eq('exam_id', filters.exam_id);

    const filteredResults = (results || []).filter((r: any) => {
      if (!cls) return true;
      return true;
    });

    const studentMap = new Map<string, { name: string; roll: string; marks: Record<string, number>; maxMarks: Record<string, number> }>();
    const subjectSet = new Set<string>();

    filteredResults.forEach((r: any) => {
      const subjectName = r.subjects?.name || r.subject_name || 'Unknown';
      subjectSet.add(subjectName);

      if (!studentMap.has(r.student_id)) {
        const student = r.students as any;
        studentMap.set(r.student_id, {
          name: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
          roll: student?.admission_number || '-',
          marks: {},
          maxMarks: {},
        });
      }
      const entry = studentMap.get(r.student_id)!;
      entry.marks[subjectName] = (entry.marks[subjectName] || 0) + Number(r.obtained_marks);
      entry.maxMarks[subjectName] = (entry.maxMarks[subjectName] || 0) + Number(r.max_marks);
    });

    const subjectList = Array.from(subjectSet).sort();
    setSubjects(subjectList);

    const toppers: Record<string, number> = {};
    subjectList.forEach(sub => {
      let max = -1;
      studentMap.forEach(s => {
        if ((s.marks[sub] || 0) > max) max = s.marks[sub] || 0;
      });
      toppers[sub] = max;
    });
    setSubjectToppers(toppers);

    const tableRows: StudentRow[] = Array.from(studentMap.entries()).map(([id, s]) => {
      const total = subjectList.reduce((acc, sub) => acc + (s.marks[sub] || 0), 0);
      const maxTotal = subjectList.reduce((acc, sub) => acc + (s.maxMarks[sub] || 100), 0);
      const avg = subjectList.length > 0 ? Math.round(total / subjectList.length) : 0;
      const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
      return {
        student_id: id,
        roll_number: s.roll,
        student_name: s.name,
        marks: s.marks,
        total,
        average: avg,
        grade: getGrade(pct),
        rank: 0,
      };
    });

    tableRows.sort((a, b) => b.average - a.average);
    let rank = 1;
    tableRows.forEach((r, i) => {
      if (i > 0 && r.average < tableRows[i - 1].average) rank = i + 1;
      r.rank = rank;
    });

    setRows(tableRows);
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  return (
    <div className="space-y-6">
      {showToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <CheckCircle className="h-5 w-5" />
          <span>Report exported successfully!</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Tabulation Sheet</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={filters.academic_year_id}
            onChange={e => setFilters(f => ({ ...f, academic_year_id: e.target.value, exam_id: '', class_id: '' }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select Academic Year</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>

          <select
            value={filters.exam_id}
            onChange={e => setFilters(f => ({ ...f, exam_id: e.target.value }))}
            disabled={!filters.academic_year_id}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="">Select Exam</option>
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>

          <select
            value={filters.class_id}
            onChange={e => setFilters(f => ({ ...f, class_id: e.target.value }))}
            disabled={!filters.exam_id}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="">Select Class</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!filters.class_id ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center gap-3 text-slate-400">
          <Table2 className="h-12 w-12 text-slate-300" />
          <p className="text-lg font-medium">Select filters to view tabulation sheet</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
          Loading...
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
          No results found
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-center px-3 py-3 text-slate-600 font-medium sticky left-0 bg-slate-50">Roll</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium min-w-40 sticky left-12 bg-slate-50">Student Name</th>
                  {subjects.map(sub => (
                    <th key={sub} className="text-center px-3 py-3 text-slate-600 font-medium min-w-24">{sub}</th>
                  ))}
                  <th className="text-center px-3 py-3 text-slate-600 font-medium">Total</th>
                  <th className="text-center px-3 py-3 text-slate-600 font-medium">Average</th>
                  <th className="text-center px-3 py-3 text-slate-600 font-medium">Grade</th>
                  <th className="text-center px-3 py-3 text-slate-600 font-medium">Rank</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.student_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-3 text-center text-slate-500 sticky left-0 bg-white">{row.roll_number}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 sticky left-12 bg-white min-w-40">{row.student_name}</td>
                    {subjects.map(sub => {
                      const marks = row.marks[sub] ?? '-';
                      const isTopper = typeof marks === 'number' && marks === subjectToppers[sub] && marks > 0;
                      return (
                        <td key={sub} className={`px-3 py-3 text-center font-medium ${isTopper ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'}`}>
                          {marks}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center font-bold text-slate-800">{row.total}</td>
                    <td className="px-3 py-3 text-center text-slate-600">{row.average}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">{row.grade}</span>
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-slate-700">{row.rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-200 text-xs text-emerald-700">
            Cells highlighted in green indicate the top scorer for that subject.
          </div>
        </div>
      )}
    </div>
  );
}
