import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Filter, Download, RefreshCw } from 'lucide-react';

interface ClassOption {
  id: string;
  name: string;
  section: string;
}

interface SubjectOption {
  id: string;
  name: string;
}

interface AttendanceRow {
  student_id: string;
  date: string;
  status: string;
}

interface StudentSummary {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

const SubjectWiseAttendance: React.FC = () => {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [summaries, setSummaries] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (profile?.school_id) {
      fetchClasses();
      fetchSubjects();
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

  const fetchSubjects = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setSubjects(data);
  };

  const fetchAttendance = async () => {
    if (!selectedClass) return;
    setLoading(true);
    setFetched(false);

    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('student_id')
      .eq('class_id', selectedClass)
      .eq('status', 'active');

    if (!enrollments || enrollments.length === 0) {
      setSummaries([]);
      setLoading(false);
      setFetched(true);
      return;
    }

    const studentIds = enrollments.map((e) => e.student_id);

    const attQuery = supabase
      .from('student_attendance')
      .select('student_id, date, status')
      .in('student_id', studentIds)
      .eq('class_id', selectedClass)
      .gte('date', dateFrom)
      .lte('date', dateTo);

    if (selectedSubject) (attQuery as any).eq('subject_id', selectedSubject);

    const [{ data: attData }, { data: studentData }] = await Promise.all([
      attQuery,
      supabase
        .from('students')
        .select('id, first_name, last_name, admission_number')
        .in('id', studentIds)
        .eq('school_id', profile?.school_id),
    ]);

    const attendanceRows: AttendanceRow[] = attData || [];

    const grouped: Record<string, AttendanceRow[]> = {};
    for (const row of attendanceRows) {
      if (!grouped[row.student_id]) grouped[row.student_id] = [];
      grouped[row.student_id].push(row);
    }

    const result: StudentSummary[] = (studentData || []).map((p) => {
      const rows = grouped[p.id] || [];
      const present = rows.filter((r) => r.status === 'present').length;
      const absent = rows.filter((r) => r.status === 'absent').length;
      const late = rows.filter((r) => r.status === 'late').length;
      const total = rows.length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      return {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        student_id: (p as any).admission_number || '',
        total,
        present,
        absent,
        late,
        percentage,
      };
    });

    result.sort((a, b) => b.percentage - a.percentage);
    setSummaries(result);
    setLoading(false);
    setFetched(true);
  };

  const exportCSV = () => {
    const headers = ['Student Name', 'Student ID', 'Total Days', 'Present', 'Absent', 'Late', 'Attendance %'];
    const rows = summaries.map((s) => [
      `${s.first_name} ${s.last_name}`,
      s.student_id,
      s.total,
      s.present,
      s.absent,
      s.late,
      `${s.percentage}%`,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedClass}_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPercentageColor = (pct: number) => {
    if (pct >= 75) return 'text-emerald-600 bg-emerald-50';
    if (pct >= 50) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="min-h-screen bg-app-surface-alt p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <BookOpen className="text-emerald-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-app-text">Subject-wise Attendance</h1>
              <p className="text-app-text-muted text-sm">View attendance grouped by student for a class and date range</p>
            </div>
          </div>
          {fetched && summaries.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 border border-emerald-600 text-emerald-600 px-4 py-2.5 rounded-lg hover:bg-emerald-50 transition-colors font-medium text-sm"
            >
              <Download size={16} />
              Export CSV
            </button>
          )}
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={18} className="text-emerald-600" />
            <h2 className="font-semibold text-app-text">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text-muted mb-1">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-app-primary focus:border-emerald-500 outline-none"
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.section}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-muted mb-1">Subject (Optional)</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-app-primary focus:border-emerald-500 outline-none"
              >
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-muted mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-app-primary focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-muted mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-app-primary focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={fetchAttendance}
              disabled={loading || !selectedClass}
              className="flex items-center gap-2 bg-app-primary text-white px-5 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Filter size={16} />}
              Generate Report
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        )}

        {!loading && fetched && summaries.length === 0 && (
          <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-12 text-center">
            <BookOpen size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-app-text-muted">No attendance records found for the selected filters.</p>
          </div>
        )}

        {!loading && summaries.length > 0 && (
          <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
            <div className="px-5 py-4 border-b border-app-border flex items-center justify-between">
              <span className="font-semibold text-app-text">{summaries.length} Students</span>
              <span className="text-xs text-app-text-muted">
                Period: {dateFrom} to {dateTo}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-app-surface-alt text-left">
                    <th className="px-5 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide">#</th>
                    <th className="px-5 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide">Student</th>
                    <th className="px-5 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide text-center">Total</th>
                    <th className="px-5 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide text-center">Present</th>
                    <th className="px-5 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide text-center">Absent</th>
                    <th className="px-5 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide text-center">Late</th>
                    <th className="px-5 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide text-center">Attendance %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {summaries.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-app-surface-alt">
                      <td className="px-5 py-3 text-sm text-app-text-muted">{idx + 1}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-app-text">{s.first_name} {s.last_name}</p>
                        <p className="text-xs text-app-text-muted">{s.student_id}</p>
                      </td>
                      <td className="px-5 py-3 text-sm text-center text-app-text-muted">{s.total}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-sm font-medium text-emerald-600">{s.present}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-sm font-medium text-red-500">{s.absent}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-sm font-medium text-amber-500">{s.late}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${getPercentageColor(s.percentage)}`}>
                          {s.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubjectWiseAttendance;
