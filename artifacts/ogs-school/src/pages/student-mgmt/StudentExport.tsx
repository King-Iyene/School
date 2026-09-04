import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Download, Filter, Table, RefreshCw, FileDown } from 'lucide-react';

interface ClassOption {
  id: string;
  name: string;
  section: string;
}

interface AcademicYear {
  id: string;
  name: string;
}

type ExportType = 'student_list' | 'attendance_summary' | 'exam_results';

interface PreviewRow {
  [key: string]: string | number;
}

const EXPORT_TYPES = [
  { value: 'student_list', label: 'Student List' },
  { value: 'attendance_summary', label: 'Attendance Summary' },
  { value: 'exam_results', label: 'Exam Results' },
] as const;

const StudentExport: React.FC = () => {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [exportType, setExportType] = useState<ExportType>('student_list');
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (profile?.school_id) {
      fetchClasses();
      fetchAcademicYears();
    }
  }, [profile?.school_id]);

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, section')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setClasses(data);
  };

  const fetchAcademicYears = async () => {
    const { data } = await supabase
      .from('academic_years')
      .select('id, name')
      .eq('school_id', profile?.school_id)
      .order('start_date', { ascending: false });
    if (data) setAcademicYears(data);
  };

  const fetchStudentList = async (): Promise<PreviewRow[]> => {
    let studentIds: string[] = [];
    const classInfo = classes.find((c) => c.id === selectedClass);

    if (selectedClass) {
      const enrQuery = supabase
        .from('student_enrollments')
        .select('student_id')
        .eq('class_id', selectedClass)
        .eq('status', 'active');
      if (selectedYear) enrQuery.eq('academic_year_id', selectedYear);
      const { data: enr } = await enrQuery;
      studentIds = (enr || []).map((e) => e.student_id);
    }

    const query = supabase
      .from('students')
      .select('id, first_name, last_name, admission_number, email, phone, gender, status')
      .eq('school_id', profile?.school_id);

    if (studentIds.length > 0) query.in('id', studentIds);

    const { data } = await query.order('first_name');
    return (data || []).map((p) => ({
      'First Name': p.first_name,
      'Last Name': p.last_name,
      'Student ID': p.admission_number || '',
      Email: p.email || '',
      Phone: p.phone || '',
      Gender: p.gender || '',
      Class: classInfo ? `${classInfo.name} ${classInfo.section || ''}`.trim() : '',
      Status: p.status === 'active' ? 'Active' : 'Inactive',
    }));
  };

  const fetchAttendanceSummary = async (): Promise<PreviewRow[]> => {
    if (!selectedClass) return [];

    const enrQuery = supabase
      .from('student_enrollments')
      .select('student_id')
      .eq('class_id', selectedClass)
      .eq('status', 'active');
    if (selectedYear) enrQuery.eq('academic_year_id', selectedYear);
    const { data: enr } = await enrQuery;
    const studentIds = (enr || []).map((e) => e.student_id);
    if (studentIds.length === 0) return [];

    const [{ data: attData }, { data: studentData }] = await Promise.all([
      supabase
        .from('student_attendance')
        .select('student_id, status')
        .in('student_id', studentIds)
        .eq('class_id', selectedClass),
      supabase
        .from('students')
        .select('id, first_name, last_name, admission_number')
        .in('id', studentIds)
        .eq('school_id', profile?.school_id),
    ]);

    const grouped: Record<string, { present: number; absent: number; late: number }> = {};
    for (const row of attData || []) {
      if (!grouped[row.student_id]) grouped[row.student_id] = { present: 0, absent: 0, late: 0 };
      if (row.status === 'present') grouped[row.student_id].present++;
      else if (row.status === 'absent') grouped[row.student_id].absent++;
      else if (row.status === 'late') grouped[row.student_id].late++;
    }

    return (studentData || []).map((p) => {
      const g = grouped[p.id] || { present: 0, absent: 0, late: 0 };
      const total = g.present + g.absent + g.late;
      return {
        'Student Name': `${p.first_name} ${p.last_name}`,
        'Student ID': p.admission_number || '',
        'Total Days': total,
        Present: g.present,
        Absent: g.absent,
        Late: g.late,
        'Attendance %': total > 0 ? `${Math.round((g.present / total) * 100)}%` : '0%',
      };
    });
  };

  const fetchExamResults = async (): Promise<PreviewRow[]> => {
    if (!selectedClass) return [];

    const { data: marks } = await supabase
      .from('exam_marks_records')
      .select('student_id, ca1, ca2, ca3, exam, total')
      .eq('class_id', selectedClass)
      .eq('school_id', profile?.school_id);

    if (!marks || marks.length === 0) return [];

    const studentIds = [...new Set(marks.map((m) => m.student_id))];
    const { data: studentData } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number')
      .in('id', studentIds)
      .eq('school_id', profile?.school_id);

    const studentMap: Record<string, { first_name: string; last_name: string; admission_number: string }> = {};
    (studentData || []).forEach((p: any) => (studentMap[p.id] = p));

    const grouped: Record<string, { ca1: number; ca2: number; ca3: number; exam: number; total: number; count: number }> = {};
    for (const m of marks) {
      if (!grouped[m.student_id]) grouped[m.student_id] = { ca1: 0, ca2: 0, ca3: 0, exam: 0, total: 0, count: 0 };
      grouped[m.student_id].ca1 += m.ca1 || 0;
      grouped[m.student_id].ca2 += m.ca2 || 0;
      grouped[m.student_id].ca3 += m.ca3 || 0;
      grouped[m.student_id].exam += m.exam || 0;
      grouped[m.student_id].total += m.total || 0;
      grouped[m.student_id].count++;
    }

    return Object.entries(grouped).map(([sid, g]) => {
      const p = studentMap[sid] || { first_name: 'Unknown', last_name: '', admission_number: '' };
      const avg = g.count > 0 ? Math.round(g.total / g.count) : 0;
      return {
        'Student Name': `${p.first_name} ${p.last_name}`,
        'Student ID': (p as any).admission_number || '',
        'Avg CA1': Math.round(g.ca1 / g.count),
        'Avg CA2': Math.round(g.ca2 / g.count),
        'Avg CA3': Math.round(g.ca3 / g.count),
        'Avg Exam': Math.round(g.exam / g.count),
        'Avg Total': avg,
        Subjects: g.count,
      };
    });
  };

  const handleFetchData = async () => {
    setLoading(true);
    setFetched(false);
    let rows: PreviewRow[] = [];

    if (exportType === 'student_list') rows = await fetchStudentList();
    else if (exportType === 'attendance_summary') rows = await fetchAttendanceSummary();
    else if (exportType === 'exam_results') rows = await fetchExamResults();

    setPreviewData(rows);
    setPreviewColumns(rows.length > 0 ? Object.keys(rows[0]) : []);
    setLoading(false);
    setFetched(true);
  };

  const handleDownloadCSV = () => {
    if (previewData.length === 0) return;
    const headers = previewColumns;
    const rows = previewData.map((row) => headers.map((h) => `"${row[h] ?? ''}"`));
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportType}_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-app-surface-alt p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <FileDown className="text-emerald-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-app-text">Student Data Export</h1>
              <p className="text-app-text-muted text-sm">Export student data to CSV format</p>
            </div>
          </div>
          {fetched && previewData.length > 0 && (
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-2 bg-app-primary text-white px-5 py-2.5 rounded-lg hover:opacity-90 transition-colors font-medium text-sm"
            >
              <Download size={16} />
              Download CSV ({previewData.length} rows)
            </button>
          )}
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={18} className="text-emerald-600" />
            <h2 className="font-semibold text-app-text">Export Options</h2>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-app-text-muted mb-2">Export Type</label>
            <div className="flex flex-wrap gap-3">
              {EXPORT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { setExportType(t.value); setFetched(false); setPreviewData([]); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    exportType === t.value
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-app-border text-app-text-muted hover:border-emerald-400 hover:text-emerald-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-app-text-muted mb-1">
                Class {exportType === 'attendance_summary' || exportType === 'exam_results' ? '(Required)' : '(Optional)'}
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-app-primary focus:border-emerald-500 outline-none"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.section}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-muted mb-1">Academic Year (Optional)</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-app-primary focus:border-emerald-500 outline-none"
              >
                <option value="">All Years</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleFetchData}
            disabled={
              loading ||
              ((exportType === 'attendance_summary' || exportType === 'exam_results') && !selectedClass)
            }
            className="flex items-center gap-2 bg-app-primary text-white px-5 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Table size={16} />}
            Generate Preview
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        )}

        {!loading && fetched && previewData.length === 0 && (
          <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-12 text-center">
            <Table size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-app-text-muted">No data found for the selected filters.</p>
          </div>
        )}

        {!loading && previewData.length > 0 && (
          <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
            <div className="px-5 py-4 border-b border-app-border flex items-center justify-between">
              <span className="font-semibold text-app-text">
                Preview: {previewData.length} records
              </span>
              <button
                onClick={handleDownloadCSV}
                className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-800 font-medium"
              >
                <Download size={15} />
                Download CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-app-surface-alt text-left">
                    {previewColumns.map((col) => (
                      <th key={col} className="px-4 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {previewData.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-app-surface-alt">
                      {previewColumns.map((col) => (
                        <td key={col} className="px-4 py-3 text-sm text-app-text whitespace-nowrap">
                          {row[col] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 50 && (
                <div className="px-5 py-3 bg-app-surface-alt border-t border-app-border text-center">
                  <p className="text-xs text-app-text-muted">
                    Showing first 50 of {previewData.length} records. Download CSV to see all.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentExport;
