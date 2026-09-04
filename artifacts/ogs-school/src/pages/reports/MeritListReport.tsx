import { useState, useEffect } from 'react';
import { Trophy, Target, CheckCircle, Download, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface MeritRecord {
  rank: number;
  student_id: string;
  student_name: string;
  class_name: string;
  total_marks: number;
  obtained_marks: number;
  percentage: number;
  grade: string;
}

interface AcademicYear {
  id: string;
  name: string;
}

interface Exam {
  id: string;
  name: string;
  academic_year_id: string;
}

interface Class {
  id: string;
  name: string;
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

function getGradeBadgeClass(grade: string): string {
  switch (grade) {
    case 'A+': return 'bg-emerald-100 text-emerald-800';
    case 'A': return 'bg-green-100 text-green-800';
    case 'B+': return 'bg-blue-100 text-blue-800';
    case 'B': return 'bg-sky-100 text-sky-800';
    case 'C': return 'bg-amber-100 text-amber-800';
    case 'D': return 'bg-orange-100 text-orange-800';
    default: return 'bg-red-100 text-red-800';
  }
}

export default function MeritListReport() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<MeritRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
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
      setFilters(f => ({ ...f, exam_id: '' }));
    }
  }, [filters.academic_year_id]);

  useEffect(() => {
    if (filters.exam_id) {
      fetchResults();
    } else {
      setRecords([]);
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
      .select('id, name, academic_year_id')
      .eq('academic_year_id', yearId)
      .order('name');
    if (data) setExams(data);
  }

  async function fetchResults() {
    setLoading(true);
    let query = supabase
      .from('exam_results')
      .select('id, student_id, total_marks, obtained_marks, students!student_id(first_name, last_name, class_name)')
      .eq('exam_id', filters.exam_id);

    if (filters.class_id) {
      const cls = classes.find(c => c.id === filters.class_id);
      if (cls) {
        query = query.eq('class_name', cls.name);
      }
    }

    const { data } = await query;

    const studentMap = new Map<string, { total: number; obtained: number; class_name: string; name: string }>();

    (data || []).forEach((r: any) => {
      const existing = studentMap.get(r.student_id);
      if (existing) {
        existing.total += Number(r.total_marks);
        existing.obtained += Number(r.obtained_marks);
      } else {
        studentMap.set(r.student_id, {
          total: Number(r.total_marks),
          obtained: Number(r.obtained_marks),
          class_name: r.students?.class_name || '-',
          name: r.students?.first_name ? `${r.students.first_name} ${r.students.last_name}` : 'Unknown',
        });
      }
    });

    const result: MeritRecord[] = Array.from(studentMap.entries())
      .map(([id, s]) => {
        const pct = s.total > 0 ? Math.round((s.obtained / s.total) * 100) : 0;
        return {
          rank: 0,
          student_id: id,
          student_name: s.name,
          class_name: s.class_name,
          total_marks: s.total,
          obtained_marks: s.obtained,
          percentage: pct,
          grade: getGrade(pct),
        };
      })
      .sort((a, b) => b.percentage - a.percentage)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));

    setRecords(result);
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const classTopper = records[0];
  const avgScore = records.length > 0
    ? Math.round(records.reduce((s, r) => s + r.percentage, 0) / records.length)
    : 0;
  const passRate = records.length > 0
    ? Math.round((records.filter(r => r.percentage >= 40).length / records.length) * 100)
    : 0;

  function getRankRowClass(rank: number) {
    if (rank === 1) return 'bg-amber-50 border-amber-200';
    if (rank === 2) return 'bg-app-surface-alt border-app-border';
    if (rank === 3) return 'bg-orange-50 border-orange-200';
    return '';
  }

  function getRankBadge(rank: number) {
    if (rank === 1) return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800"><Star className="h-3 w-3" />1st</span>;
    if (rank === 2) return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-slate-200 text-app-text">2nd</span>;
    if (rank === 3) return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">3rd</span>;
    return <span className="text-app-text-muted font-medium">{rank}</span>;
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
        <h1 className="text-2xl font-bold text-app-text">Merit List Report</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={filters.academic_year_id}
            onChange={e => setFilters(f => ({ ...f, academic_year_id: e.target.value, exam_id: '' }))}
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
            onChange={e => setFilters(f => ({ ...f, class_id: e.target.value }))}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              <p className="text-sm text-app-text-muted">Class Topper</p>
              <p className="text-base font-bold text-app-text mt-1 truncate">{classTopper?.student_name || '-'}</p>
              {classTopper && <p className="text-sm text-emerald-600">{classTopper.percentage}%</p>}
            </div>
            <div className="bg-amber-100 p-3 rounded-lg">
              <Trophy className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Average Score</p>
              <p className="text-2xl font-bold text-app-text mt-1">{avgScore}%</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Target className="h-6 w-6 text-blue-600" />
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
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Rank</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Student Name</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Class</th>
                <th className="text-right px-4 py-3 text-app-text-muted font-medium">Total Marks</th>
                <th className="text-right px-4 py-3 text-app-text-muted font-medium">Obtained</th>
                <th className="text-right px-4 py-3 text-app-text-muted font-medium">Percentage</th>
                <th className="text-center px-4 py-3 text-app-text-muted font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {!filters.exam_id ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-app-text-muted">Select an academic year and exam to view the merit list</td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-app-text-muted">Loading...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-app-text-muted">No results found</td>
                </tr>
              ) : (
                records.map(record => (
                  <tr key={record.student_id} className={`border-b ${getRankRowClass(record.rank)} hover:bg-opacity-80`}>
                    <td className="px-4 py-3">{getRankBadge(record.rank)}</td>
                    <td className="px-4 py-3 font-medium text-app-text">{record.student_name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{record.class_name}</td>
                    <td className="px-4 py-3 text-right text-app-text-muted">{record.total_marks}</td>
                    <td className="px-4 py-3 text-right font-medium text-app-text">{record.obtained_marks}</td>
                    <td className="px-4 py-3 text-right font-medium text-app-text">{record.percentage}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${getGradeBadgeClass(record.grade)}`}>
                        {record.grade}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
