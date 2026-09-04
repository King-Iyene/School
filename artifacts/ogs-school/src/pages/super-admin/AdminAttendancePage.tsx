import { useEffect, useState } from 'react';
import { UserCheck, BarChart2, Save, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface ClassOption { id: string; name: string; level: string; section: string; }
interface Student { id: string; first_name: string; last_name: string; admission_number: string; }
type AttendanceStatus = 'present' | 'absent' | 'late';
interface AttendanceMap { [studentId: string]: AttendanceStatus; }

interface ReportRow {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

const today = new Date().toISOString().split('T')[0];

export default function AdminAttendancePage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'mark' | 'report'>('mark');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const [reportClass, setReportClass] = useState('');
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => { loadClasses(); }, [profile?.school_id]);
  useEffect(() => { if (selectedClass) loadStudents(); }, [selectedClass, selectedDate]);
  useEffect(() => { if (reportClass) loadReport(); }, [reportClass]);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3000);
  }

  async function loadClasses() {
    if (!profile?.school_id) return;
    const { data } = await supabase
      .from('classes')
      .select('id, name, level, section')
      .eq('school_id', profile.school_id)
      .order('level').order('section');
    setClasses(data ?? []);
  }

  async function loadStudents() {
    if (!profile?.school_id || !selectedClass) return;
    setLoadingStudents(true);
    const [sRes, aRes] = await Promise.all([
      supabase.from('students').select('id, first_name, last_name, admission_number').eq('school_id', profile.school_id).eq('class_id', selectedClass).eq('status', 'active').order('first_name'),
      supabase.from('student_attendance').select('student_id, status').eq('class_id', selectedClass).eq('date', selectedDate).eq('school_id', profile.school_id),
    ]);
    const studs = sRes.data ?? [];
    const existingMap: AttendanceMap = {};
    (aRes.data ?? []).forEach((r: { student_id: string; status: string }) => {
      existingMap[r.student_id] = r.status as AttendanceStatus;
    });
    const defaultMap: AttendanceMap = {};
    studs.forEach((s: Student) => {
      defaultMap[s.id] = existingMap[s.id] ?? 'present';
    });
    setStudents(studs);
    setAttendance(defaultMap);
    setLoadingStudents(false);
  }

  function toggleStatus(studentId: string, status: AttendanceStatus) {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  }

  async function saveAttendance() {
    if (!profile?.school_id || !selectedClass || students.length === 0) return;
    setSaving(true);
    const rows = students.map(s => ({
      school_id: profile.school_id,
      student_id: s.id,
      class_id: selectedClass,
      date: selectedDate,
      status: attendance[s.id] ?? 'present',
    }));
    const { error } = await supabase.from('student_attendance').upsert(rows, { onConflict: 'student_id,date' });
    setSaving(false);
    if (error) { 
      showToast(error.message, 'error'); 
    } else { 
      showToast('Attendance saved successfully.');
      loadStudents(); // Reload to refresh counts from the database
    }
  }

  async function loadReport() {
    if (!profile?.school_id || !reportClass) return;
    setLoadingReport(true);
    const [sRes, aRes] = await Promise.all([
      supabase.from('students').select('id, first_name, last_name, admission_number').eq('school_id', profile.school_id).eq('class_id', reportClass).eq('status', 'active').order('first_name'),
      supabase.from('student_attendance').select('student_id, status').eq('school_id', profile.school_id).eq('class_id', reportClass),
    ]);
    const studs: Student[] = sRes.data ?? [];
    const records: { student_id: string; status: string }[] = aRes.data ?? [];

    const rows: ReportRow[] = studs.map(s => {
      const recs = records.filter(r => r.student_id === s.id);
      const present = recs.filter(r => r.status === 'present').length;
      const absent = recs.filter(r => r.status === 'absent').length;
      const late = recs.filter(r => r.status === 'late').length;
      const total = recs.length;
      const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
      return { id: s.id, first_name: s.first_name, last_name: s.last_name, admission_number: s.admission_number, present, absent, late, total, percentage };
    });
    setReportRows(rows);
    setLoadingReport(false);
  }

  const presentCount = students.filter(s => attendance[s.id] === 'present').length;
  const absentCount = students.filter(s => attendance[s.id] === 'absent').length;
  const lateCount = students.filter(s => attendance[s.id] === 'late').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <UserCheck className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-app-text">Attendance</h2>
          <p className="text-app-text-muted text-sm">Mark and track student attendance</p>
        </div>
      </div>

      {toast && (
        <div className={`text-sm px-4 py-3 rounded-xl border ${toastType === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {toast}
        </div>
      )}

      <div className="flex gap-2 border-b border-app-border">
        {(['mark', 'report'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-app-text-muted hover:text-app-text'}`}
          >
            {t === 'mark' ? 'Mark Attendance' : 'Attendance Report'}
          </button>
        ))}
      </div>

      {tab === 'mark' && (
        <div className="space-y-4">
          <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-app-text-muted mb-1">Class</label>
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm bg-app-surface focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="">Select class...</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name || `${c.level}${c.section}`}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-app-text-muted mb-1">Date</label>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            {students.length > 0 && (
              <button onClick={saveAttendance} disabled={saving} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Attendance'}
              </button>
            )}
          </div>

          {!selectedClass ? (
            <div className="bg-app-surface rounded-2xl border border-app-border p-12 text-center">
              <UserCheck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-app-text-muted text-sm">Select a class to mark attendance</p>
            </div>
          ) : loadingStudents ? (
            <div className="bg-app-surface rounded-2xl border border-app-border p-12 text-center text-app-text-muted text-sm">Loading students...</div>
          ) : students.length === 0 ? (
            <div className="bg-app-surface rounded-2xl border border-app-border p-12 text-center">
              <p className="text-app-text-muted text-sm">No active students in this class.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Present', count: presentCount, color: 'emerald' },
                  { label: 'Absent', count: absentCount, color: 'red' },
                  { label: 'Late', count: lateCount, color: 'amber' },
                ].map(({ label, count, color }) => (
                  <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-2xl p-4 text-center`}>
                    <p className={`text-2xl font-bold text-${color}-600`}>{count}</p>
                    <p className={`text-xs text-${color}-500 mt-1`}>{label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-app-border bg-app-surface-alt flex items-center justify-between">
                  <span className="text-sm font-semibold text-app-text">{students.length} student{students.length !== 1 ? 's' : ''}</span>
                  <div className="flex gap-2">
                    <button onClick={() => { const m: AttendanceMap = {}; students.forEach(s => { m[s.id] = 'present'; }); setAttendance(m); }} className="text-xs px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors">All Present</button>
                    <button onClick={() => { const m: AttendanceMap = {}; students.forEach(s => { m[s.id] = 'absent'; }); setAttendance(m); }} className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">All Absent</button>
                  </div>
                </div>
                <div className="divide-y divide-app-border">
                  {students.map((s, idx) => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-app-surface-alt transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-xs text-app-text-muted text-right">{idx + 1}</span>
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-app-text-muted">
                          {s.first_name[0]}{s.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-app-text">{s.first_name} {s.last_name}</p>
                          <p className="text-xs text-app-text-muted font-mono">{s.admission_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleStatus(s.id, 'present')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${attendance[s.id] === 'present' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 text-app-text-muted hover:bg-emerald-50 hover:text-emerald-600'}`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Present
                        </button>
                        <button
                          onClick={() => toggleStatus(s.id, 'absent')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${attendance[s.id] === 'absent' ? 'bg-red-500 text-white shadow-sm' : 'bg-slate-100 text-app-text-muted hover:bg-red-50 hover:text-red-600'}`}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Absent
                        </button>
                        <button
                          onClick={() => toggleStatus(s.id, 'late')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${attendance[s.id] === 'late' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-app-text-muted hover:bg-amber-50 hover:text-amber-600'}`}
                        >
                          <Clock className="w-3.5 h-3.5" /> Late
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {students.length > 0 && (
                  <div className="px-4 py-3 border-t border-app-border flex justify-end">
                    <button onClick={saveAttendance} disabled={saving} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Attendance'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'report' && (
        <div className="space-y-4">
          <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-app-text-muted mb-1">Class</label>
              <select value={reportClass} onChange={e => setReportClass(e.target.value)} className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm bg-app-surface focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="">Select class...</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name || `${c.level}${c.section}`}</option>)}
              </select>
            </div>
          </div>

          {!reportClass ? (
            <div className="bg-app-surface rounded-2xl border border-app-border p-12 text-center">
              <BarChart2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-app-text-muted text-sm">Select a class to view the attendance report</p>
            </div>
          ) : loadingReport ? (
            <div className="bg-app-surface rounded-2xl border border-app-border p-12 text-center text-app-text-muted text-sm">Loading report...</div>
          ) : reportRows.length === 0 ? (
            <div className="bg-app-surface rounded-2xl border border-app-border p-12 text-center">
              <p className="text-app-text-muted text-sm">No students or attendance records found for this class.</p>
            </div>
          ) : (
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-app-border bg-app-surface-alt">
                    {['SL', 'Student', 'Admission No.', 'Present', 'Absent', 'Late', 'Total Days', 'Attendance %'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-app-text-muted uppercase px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {reportRows.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-app-surface-alt transition-colors">
                      <td className="px-4 py-3 text-sm text-app-text-muted">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-app-text">{r.first_name} {r.last_name}</td>
                      <td className="px-4 py-3 text-sm font-mono text-app-text-muted">{r.admission_number}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600 font-medium">{r.present}</td>
                      <td className="px-4 py-3 text-sm text-red-500 font-medium">{r.absent}</td>
                      <td className="px-4 py-3 text-sm text-amber-500 font-medium">{r.late}</td>
                      <td className="px-4 py-3 text-sm text-app-text-muted">{r.total}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                            <div
                              className={`h-full rounded-full ${r.percentage >= 75 ? 'bg-emerald-500' : r.percentage >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${r.percentage}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${r.percentage >= 75 ? 'text-emerald-600' : r.percentage >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                            {r.percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
