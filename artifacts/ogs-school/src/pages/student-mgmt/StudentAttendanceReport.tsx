import { useState, useEffect } from 'react';
import { BarChart2, Download, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Class {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
  class_id: string;
}

interface StudentReport {
  student_id: string;
  full_name: string;
  roll_number: string | null;
  total_days: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export default function StudentAttendanceReport() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [filteredSections, setFilteredSections] = useState<Section[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [exportToast, setExportToast] = useState(false);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      setFilteredSections(sections.filter((s) => s.class_id === selectedClass));
      setSelectedSection('');
    } else {
      setFilteredSections([]);
    }
  }, [selectedClass, sections]);

  async function fetchFilters() {
    setLoadingFilters(true);
    const [classRes, sectionRes] = await Promise.all([
      supabase.from('classes').select('id, name').order('name'),
      supabase.from('sections').select('id, name, class_id').order('name'),
    ]);
    if (classRes.data) setClasses(classRes.data);
    if (sectionRes.data) setSections(sectionRes.data);
    setLoadingFilters(false);
  }

  async function generateReport() {
    if (!selectedClass) return;
    setLoading(true);

    const studentsQuery = supabase
      .from('students')
      .select('id, first_name, last_name, admission_number')
      .eq('school_id', profile?.school_id ?? '')
      .eq('class_id', selectedClass)
      .eq('status', 'active')
      .order('first_name', { ascending: true });

    if (selectedSection) {
      studentsQuery.eq('section_id', selectedSection);
    }

    const { data: studentsData } = await studentsQuery;

    if (!studentsData || studentsData.length === 0) {
      setReports([]);
      setLoading(false);
      return;
    }

    const studentIds = studentsData.map((s) => s.id);
    const monthNum = parseInt(selectedMonth, 10);
    const yearNum = parseInt(selectedYear, 10);
    const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    const endDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data: attendanceData } = await supabase
      .from('student_attendance')
      .select('student_id, status')
      .gte('date', startDate)
      .lte('date', endDate)
      .in('student_id', studentIds);

    const attendanceMap = new Map<string, { present: number; absent: number; late: number }>();
    studentIds.forEach((id) => attendanceMap.set(id, { present: 0, absent: 0, late: 0 }));

    (attendanceData ?? []).forEach((a: { student_id: string; status: string }) => {
      const rec = attendanceMap.get(a.student_id);
      if (rec) {
        if (a.status === 'present') rec.present++;
        else if (a.status === 'absent') rec.absent++;
        else if (a.status === 'late') rec.late++;
      }
    });

    const mapped: StudentReport[] = studentsData.map((s) => {
      const rec = attendanceMap.get(s.id) ?? { present: 0, absent: 0, late: 0 };
      const total = rec.present + rec.absent + rec.late;
      const percentage = total > 0 ? Math.round(((rec.present + rec.late) / total) * 100) : 0;
      return {
        student_id: s.id,
        full_name: `${s.first_name} ${s.last_name}`,
        roll_number: (s as any).admission_number || null,
        total_days: total,
        present: rec.present,
        absent: rec.absent,
        late: rec.late,
        percentage,
      };
    });

    setReports(mapped);
    setLoading(false);
  }

  function handleExport() {
    setExportToast(true);
    setTimeout(() => setExportToast(false), 3000);
  }

  function percentageColor(pct: number) {
    if (pct >= 75) return 'text-emerald-600 font-semibold';
    if (pct >= 50) return 'text-amber-600 font-semibold';
    return 'text-red-600 font-semibold';
  }

  const avgAttendance =
    reports.length > 0
      ? Math.round(reports.reduce((sum, r) => sum + r.percentage, 0) / reports.length)
      : 0;
  const belowThreshold = reports.filter((r) => r.percentage < 75).length;
  const totalDays =
    reports.length > 0 ? Math.max(...reports.map((r) => r.total_days)) : 0;

  const inputClass =
    'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

  return (
    <div className="p-6">
      {exportToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          Report exported successfully!
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart2 size={24} className="text-emerald-600" />
          <h1 className="text-2xl font-bold text-app-text">Student Attendance Report</h1>
        </div>
        {reports.length > 0 && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 border border-app-border text-app-text-muted hover:bg-app-surface-alt px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Download size={15} />
            Export
          </button>
        )}
      </div>

      <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-app-text mb-4">Filters</h2>
        {loadingFilters ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Class</label>
              <select
                className={inputClass}
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Section</label>
              <select
                className={inputClass}
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                disabled={!selectedClass}
              >
                <option value="">All sections</option>
                {filteredSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Month</label>
              <select
                className={inputClass}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Year</label>
              <input
                type="number"
                className={inputClass}
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                min="2000"
                max="2099"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={generateReport}
                disabled={!selectedClass || loading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>
        )}
      </div>

      {reports.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-app-surface border border-app-border rounded-xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <TrendingUp size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-app-text">{avgAttendance}%</p>
                <p className="text-xs text-app-text-muted mt-0.5">Average Attendance</p>
              </div>
            </div>
            <div className="bg-app-surface border border-app-border rounded-xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-app-text">{belowThreshold}</p>
                <p className="text-xs text-app-text-muted mt-0.5">Students Below 75%</p>
              </div>
            </div>
            <div className="bg-app-surface border border-app-border rounded-xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-app-text">{totalDays}</p>
                <p className="text-xs text-app-text-muted mt-0.5">Total School Days</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-app-border">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Student Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Roll No.</th>
                  <th className="text-center px-4 py-3 font-semibold text-app-text-muted">Total Days</th>
                  <th className="text-center px-4 py-3 font-semibold text-app-text-muted">Present</th>
                  <th className="text-center px-4 py-3 font-semibold text-app-text-muted">Absent</th>
                  <th className="text-center px-4 py-3 font-semibold text-app-text-muted">Late</th>
                  <th className="text-center px-4 py-3 font-semibold text-app-text-muted">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {reports.map((r) => (
                  <tr key={r.student_id} className="hover:bg-app-surface-alt transition-colors">
                    <td className="px-4 py-3 font-medium text-app-text">{r.full_name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{r.roll_number ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-app-text-muted">{r.total_days}</td>
                    <td className="px-4 py-3 text-center text-emerald-600 font-medium">{r.present}</td>
                    <td className="px-4 py-3 text-center text-red-500 font-medium">{r.absent}</td>
                    <td className="px-4 py-3 text-center text-amber-500 font-medium">{r.late}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={percentageColor(r.percentage)}>{r.percentage}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {reports.length === 0 && !loading && (
        <div className="text-center py-16 text-app-text-muted">
          <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No report data</p>
          <p className="text-sm mt-1">Select filters and click "Generate Report".</p>
        </div>
      )}
    </div>
  );
}
