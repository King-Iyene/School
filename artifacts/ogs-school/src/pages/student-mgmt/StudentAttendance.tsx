import { useState, useEffect, useMemo } from 'react';
import { CalendarCheck, Save, RefreshCw, ChevronLeft, ChevronRight, Zap, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Class { id: string; name: string; }
interface AcademicYear { id: string; name: string; is_current?: boolean; }

interface StudentAttendanceRecord {
  student_id: string;
  full_name: string;
  roll_number: string | null;
  status: 'present' | 'absent' | 'late' | 'excused';
  attendance_id: string | null;
}

const ADMIN_ROLES = ['super_admin', 'admin', 'principal', 'head_teacher'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dayLabel(dateStr: string) { return DAY_LABELS[new Date(dateStr + 'T00:00:00').getDay()]; }
function shortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
}
function isWeekend(dateStr: string) {
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  return dow === 0 || dow === 6;
}
function prevWeekday(dateStr: string): string {
  let d = addDays(dateStr, -1);
  for (let i = 0; i < 7; i++) { if (!isWeekend(d)) return d; d = addDays(d, -1); }
  return dateStr;
}
function nextWeekday(dateStr: string): string {
  const t = todayStr();
  let d = addDays(dateStr, 1);
  for (let i = 0; i < 7; i++) { if (d > t) return t; if (!isWeekend(d)) return d; d = addDays(d, 1); }
  return dateStr;
}
function recentWeekdays(n: number): string[] {
  const days: string[] = [];
  let cur = todayStr();
  let iters = 0;
  while (days.length < n && iters < 40) { if (!isWeekend(cur)) days.push(cur); cur = addDays(cur, -1); iters++; }
  return days;
}

export default function StudentAttendance() {
  const { profile } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(profile?.role ?? '');

  const [metaLoaded, setMetaLoaded]     = useState(false);
  const [isFormMaster, setIsFormMaster] = useState(false);
  const [classes, setClasses]           = useState<Class[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate]   = useState(todayStr());
  const [selectedYear, setSelectedYear]   = useState('');

  const [records, setRecords]     = useState<StudentAttendanceRecord[]>([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // recorded dates for the chip strip
  const [recordedDates, setRecordedDates] = useState<Set<string>>(new Set());

  // Bulk fill
  const [bulkOpen, setBulkOpen]     = useState(false);
  const [bulkFrom, setBulkFrom]     = useState('');
  const [bulkTo, setBulkTo]         = useState('');
  const [bulkStatus, setBulkStatus] = useState<'present' | 'absent' | 'late' | 'excused'>('present');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDone, setBulkDone]     = useState(false);

  const today = todayStr();
  const recentDays = useMemo(() => recentWeekdays(12), []);

  const bulkSchoolDays = useMemo(() => {
    if (!bulkFrom || !bulkTo || bulkFrom > bulkTo) return [];
    const days: string[] = [];
    let d = bulkFrom;
    let iters = 0;
    while (d <= bulkTo && d <= today && iters < 200) {
      if (!isWeekend(d)) days.push(d);
      d = addDays(d, 1); iters++;
    }
    return days;
  }, [bulkFrom, bulkTo, today]);

  useEffect(() => { fetchFilters(); }, [profile?.id, profile?.school_id]);
  useEffect(() => { if (selectedClass) loadRecordedDates(); }, [selectedClass]);

  async function fetchFilters() {
    if (!profile?.id || !profile?.school_id) return;

    const [yearRes] = await Promise.all([
      supabase.from('academic_years').select('id, name, is_current').eq('school_id', profile.school_id).order('name'),
    ]);

    if (yearRes.data) {
      setAcademicYears(yearRes.data);
      const current = (yearRes.data as AcademicYear[]).find(y => y.is_current);
      if (current) setSelectedYear(current.id);
    }

    const currentYearId = (yearRes.data as AcademicYear[] ?? []).find(y => y.is_current)?.id ?? '';

    if (isAdmin) {
      const { data: allClasses } = await supabase.from('classes').select('id, name').eq('school_id', profile.school_id).order('name');
      const classList = allClasses ?? [];
      setClasses(classList);
      setIsFormMaster(true);
      setMetaLoaded(true);
      return;
    }

    // Teachers — only Form Master classes
    const [classFmRes, tableFmRes] = await Promise.all([
      supabase.from('classes').select('id, name').eq('class_teacher_id', profile.id),
      supabase.from('class_teachers').select('class_id, classes(id, name)').eq('teacher_id', profile.id).eq('academic_year_id', currentYearId),
    ]);

    const fmClasses1 = classFmRes.data ?? [];
    const fmClasses2 = (tableFmRes.data ?? []).map(d => d.classes).filter(Boolean) as Class[];
    const allUnique = [...new Map([...fmClasses1, ...fmClasses2].map(c => [c.id, c])).values()];

    setClasses(allUnique);
    setIsFormMaster(allUnique.length > 0);
    setMetaLoaded(true);
  }

  async function loadRecordedDates() {
    if (!selectedClass) return;
    const from = addDays(today, -90);
    const { data } = await supabase.from('student_attendance').select('date').eq('class_id', selectedClass).gte('date', from);
    setRecordedDates(new Set((data ?? []).map((r: any) => r.date as string)));
  }

  async function loadStudents() {
    if (!selectedClass || !selectedDate) return;
    setLoading(true);

    const { data: studentsData } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number')
      .eq('school_id', profile?.school_id ?? '')
      .eq('class_id', selectedClass)
      .eq('status', 'active')
      .order('first_name', { ascending: true });

    if (!studentsData || studentsData.length === 0) { setRecords([]); setLoading(false); return; }

    const studentIds = studentsData.map(s => s.id);
    const { data: attendanceData } = await supabase
      .from('student_attendance').select('id, student_id, status')
      .eq('date', selectedDate).in('student_id', studentIds);

    const attendanceMap = new Map<string, { id: string; status: string }>();
    (attendanceData ?? []).forEach((a: any) => attendanceMap.set(a.student_id, { id: a.id, status: a.status }));

    setRecords(studentsData.map(s => {
      const existing = attendanceMap.get(s.id);
      return {
        student_id: s.id,
        full_name: `${s.first_name} ${s.last_name}`,
        roll_number: (s as any).admission_number || null,
        status: (existing?.status as any) ?? 'present',
        attendance_id: existing?.id ?? null,
      };
    }));
    setLoading(false);
  }

  function setStatus(studentId: string, status: 'present' | 'absent' | 'late' | 'excused') {
    setRecords(prev => prev.map(r => r.student_id === studentId ? { ...r, status } : r));
  }

  async function saveAll() {
    if (records.length === 0) return;
    setSaving(true);
    const upsertData = records.map(r => ({
      student_id: r.student_id, date: selectedDate, status: r.status,
      class_id: selectedClass, school_id: profile?.school_id,
      recorded_by: profile?.id, academic_year_id: selectedYear || null,
    }));
    const { error } = await supabase.from('student_attendance').upsert(upsertData, { onConflict: 'student_id,date' });
    if (!error) {
      setRecordedDates(prev => new Set([...prev, selectedDate]));
      setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000);
      await loadStudents();
    }
    setSaving(false);
  }

  async function doBulkFill() {
    if (bulkSchoolDays.length === 0 || records.length === 0) return;
    setBulkSaving(true);
    const upsertData = records.flatMap(r =>
      bulkSchoolDays.map(day => ({
        student_id: r.student_id, date: day, status: bulkStatus,
        class_id: selectedClass, school_id: profile?.school_id,
        recorded_by: profile?.id, academic_year_id: selectedYear || null,
      }))
    );
    const { error } = await supabase.from('student_attendance').upsert(upsertData, { onConflict: 'student_id,date' });
    if (!error) {
      setRecordedDates(prev => new Set([...prev, ...bulkSchoolDays]));
      setBulkDone(true); setTimeout(() => setBulkDone(false), 3000);
      setBulkFrom(''); setBulkTo('');
    } else {
      alert('Bulk fill failed. Please try again.');
    }
    setBulkSaving(false);
  }

  function markAllPresent() { setRecords(prev => prev.map(r => ({ ...r, status: 'present' }))); }

  const presentCount = records.filter(r => r.status === 'present').length;
  const absentCount  = records.filter(r => r.status === 'absent').length;
  const lateCount    = records.filter(r => r.status === 'late').length;
  const missingCount = recentDays.filter(d => d !== today && !recordedDates.has(d)).length;

  const inputClass = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full bg-app-surface';

  if (!metaLoaded) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <CalendarCheck size={24} className="text-emerald-600" />
          <h1 className="text-2xl font-bold text-app-text">Student Attendance</h1>
        </div>
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm py-16 text-center">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
          <p className="text-app-text-muted text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <CalendarCheck size={22} className="text-emerald-600 shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-app-text">Student Attendance</h1>
            <p className="text-app-text-muted text-sm hidden sm:block">
              {isAdmin ? 'Mark and review attendance for any class' : 'Record daily attendance for your class'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {records.length > 0 && <>
            <button onClick={markAllPresent} className="text-emerald-600 hover:text-emerald-700 text-sm font-medium px-3 py-2 rounded-xl hover:bg-emerald-50 transition-colors">
              All Present
            </button>
            <button onClick={saveAll} disabled={saving}
              className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              <Save size={15} /> {saving ? 'Saving…' : 'Save All'}
            </button>
          </>}
          <button onClick={() => setBulkOpen(o => !o)}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors ${bulkOpen ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-app-text-muted hover:bg-slate-200'}`}>
            <Zap size={14} /> Bulk Fill
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-medium">
          Attendance saved successfully!
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Class</label>
            <select className={inputClass} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              <option value="">Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Academic Year</label>
            <select className={inputClass} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              <option value="">Select year</option>
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={loadStudents} disabled={!selectedClass || !selectedDate || loading}
              className="w-full bg-app-primary hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              {loading ? 'Loading…' : 'Load Students'}
            </button>
          </div>
        </div>

        {/* Date navigator */}
        <div>
          <label className="block text-sm font-medium text-app-text mb-1.5">Date</label>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setSelectedDate(prevWeekday(selectedDate))} title="Previous weekday"
              className="p-2 rounded-xl border border-app-border hover:bg-slate-100 transition-colors text-app-text-muted">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input type="date" className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
              value={selectedDate} max={today} onChange={e => setSelectedDate(e.target.value)} />
            <button onClick={() => setSelectedDate(nextWeekday(selectedDate))} disabled={selectedDate >= today} title="Next weekday"
              className="p-2 rounded-xl border border-app-border hover:bg-slate-100 transition-colors text-app-text-muted disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
            {selectedDate !== today && (
              <button onClick={() => setSelectedDate(today)}
                className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors">
                Today
              </button>
            )}
            {missingCount > 0 && selectedClass && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
                <CalendarCheck className="w-3 h-3" /> {missingCount} day{missingCount !== 1 ? 's' : ''} unfilled
              </span>
            )}
          </div>

          {/* Recent days chip strip */}
          <div className="mt-2.5 flex gap-1.5 flex-wrap">
            {recentDays.map(d => {
              const isSelected = d === selectedDate;
              const isRecorded = recordedDates.has(d);
              const isTdy      = d === today;
              return (
                <button key={d} onClick={() => setSelectedDate(d)} title={d}
                  className={`flex flex-col items-center px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors leading-tight
                    ${isSelected
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : isRecorded
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : isTdy
                          ? 'bg-slate-100 border-app-border text-app-text hover:bg-slate-200'
                          : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                    }`}>
                  <span className="font-semibold">{dayLabel(d)}</span>
                  <span className="opacity-75">{shortDate(d)}</span>
                  {isRecorded && !isSelected && <span className="text-emerald-500 text-[9px]">✓</span>}
                  {!isRecorded && !isTdy && !isSelected && <span className="text-red-400 text-[9px]">–</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bulk fill panel */}
        {bulkOpen && (
          <div className="border border-violet-200 bg-violet-50 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-violet-800">Bulk Fill Attendance</p>
              <p className="text-xs text-violet-600 mt-0.5">
                Fill all loaded students with one status across a date range. Weekends are skipped automatically.
                {records.length === 0 && <span className="font-semibold"> Load students first.</span>}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1">From</label>
                <input type="date" value={bulkFrom} max={today} onChange={e => setBulkFrom(e.target.value)}
                  className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full bg-app-surface" />
              </div>
              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1">To</label>
                <input type="date" value={bulkTo} min={bulkFrom || undefined} max={today} onChange={e => setBulkTo(e.target.value)}
                  className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full bg-app-surface" />
              </div>
              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1">Status for all</label>
                <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as any)}
                  className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full bg-app-surface">
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
                </select>
              </div>
            </div>
            {bulkSchoolDays.length > 0 && (
              <p className="text-xs text-violet-700 bg-violet-100 rounded-lg px-3 py-2">
                <span className="font-semibold">{bulkSchoolDays.length} weekday{bulkSchoolDays.length !== 1 ? 's' : ''}</span> will be filled:{' '}
                {bulkSchoolDays.slice(0, 5).map(d => `${dayLabel(d)} ${shortDate(d)}`).join(', ')}
                {bulkSchoolDays.length > 5 ? ` … +${bulkSchoolDays.length - 5} more` : ''}
              </p>
            )}
            {bulkDone && (
              <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Bulk fill complete!
              </p>
            )}
            <div className="flex items-center gap-2">
              <button onClick={doBulkFill} disabled={bulkSaving || bulkSchoolDays.length === 0 || records.length === 0}
                className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                <Zap size={14} />
                {bulkSaving ? 'Filling…' : `Fill ${bulkSchoolDays.length > 0 ? bulkSchoolDays.length : ''} Day${bulkSchoolDays.length !== 1 ? 's' : ''}`}
              </button>
              <button onClick={() => setBulkOpen(false)} className="text-sm text-app-text-muted hover:text-app-text px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Student table ── */}
      {records.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <div className="bg-app-surface-alt border border-app-border rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-app-text">{records.length}</p>
              <p className="text-xs text-app-text-muted mt-0.5">Total Students</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{presentCount}</p>
              <p className="text-xs text-emerald-600 mt-0.5">Present</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-red-600">{absentCount}</p>
              <p className="text-xs text-red-500 mt-0.5">Absent</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{lateCount}</p>
              <p className="text-xs text-amber-500 mt-0.5">Late</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-app-border">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Student Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Admission No.</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {records.map(r => (
                  <tr key={r.student_id} className="hover:bg-app-surface-alt transition-colors">
                    <td className="px-4 py-3 font-medium text-app-text">{r.full_name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{r.roll_number ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {(['present', 'absent', 'late', 'excused'] as const).map(st => (
                          <button key={st} onClick={() => setStatus(r.student_id, st)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                              r.status === st
                                ? st === 'present' ? 'bg-emerald-500 text-white'
                                  : st === 'absent' ? 'bg-red-500 text-white'
                                  : st === 'late' ? 'bg-amber-500 text-white'
                                  : 'bg-blue-500 text-white'
                                : st === 'present' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                  : st === 'absent' ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                  : st === 'late' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                            }`}>
                            {st.charAt(0).toUpperCase() + st.slice(1)}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {records.length === 0 && !loading && (
        <div className="text-center py-16 text-app-text-muted">
          <CalendarCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No students loaded</p>
          <p className="text-sm mt-1">Select a class and date, then click "Load Students".</p>
        </div>
      )}
    </div>
  );
}
