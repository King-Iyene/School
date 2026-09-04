import { useEffect, useState, useMemo } from 'react';
import {
  UserCheck, Search, CheckCircle, XCircle, Clock, AlertCircle,
  WifiOff, RefreshCw, Lock, Ban, ChevronLeft, ChevronRight,
  CalendarDays, Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { offlineStore } from '../../lib/offlineStore';
import { syncQueue } from '../../lib/syncQueue';
import { useAuth } from '../../context/AuthContext';

type AttStatus = 'present' | 'absent' | 'late' | 'excused';
const statusConfig: Record<AttStatus, { label: string; color: string; icon: any }> = {
  present: { label: 'Present', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200', icon: CheckCircle },
  absent:  { label: 'Absent',  color: 'bg-red-100 text-red-700 hover:bg-red-200',             icon: XCircle },
  late:    { label: 'Late',    color: 'bg-amber-100 text-amber-700 hover:bg-amber-200',        icon: Clock },
  excused: { label: 'Excused', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200',           icon: AlertCircle },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dayLabel(dateStr: string) {
  return DAY_LABELS[new Date(dateStr + 'T00:00:00').getDay()];
}
function shortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
}
function isWeekend(dateStr: string) {
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  return dow === 0 || dow === 6;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Attendance() {
  const { profile } = useAuth();
  const isAdmin = ['super_admin', 'admin', 'principal', 'head_teacher'].includes(profile?.role ?? '');

  const [classes, setClasses]           = useState<any[]>([]);
  const [isFormMaster, setIsFormMaster] = useState(false);
  const [metaLoaded, setMetaLoaded]     = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents]         = useState<any[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(today());
  const [attendanceMap, setAttendanceMap]   = useState<Record<string, AttStatus>>({});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [search, setSearch]   = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [holidays, setHolidays] = useState<Array<{ name: string; holiday_date: string; end_date: string | null }>>([]);

  // New: date navigation + bulk fill
  const [recordedDates, setRecordedDates] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen]   = useState(false);
  const [bulkFrom, setBulkFrom]   = useState('');
  const [bulkTo, setBulkTo]       = useState('');
  const [bulkStatus, setBulkStatus] = useState<AttStatus>('present');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDone, setBulkDone]   = useState(false);

  // ── School-day helpers (close over holidays) ────────────────────────────────
  function isSchoolDay(dateStr: string): boolean {
    if (isWeekend(dateStr)) return false;
    for (const h of holidays) {
      const start = new Date(h.holiday_date + 'T00:00:00');
      const end   = h.end_date ? new Date(h.end_date + 'T00:00:00') : start;
      const d     = new Date(dateStr + 'T00:00:00');
      if (d >= start && d <= end) return false;
    }
    return true;
  }

  function getPrevSchoolDay(dateStr: string): string {
    let d = addDays(dateStr, -1);
    for (let i = 0; i < 20; i++) {
      if (isSchoolDay(d)) return d;
      d = addDays(d, -1);
    }
    return dateStr;
  }

  function getNextSchoolDay(dateStr: string): string {
    const t = today();
    let d = addDays(dateStr, 1);
    for (let i = 0; i < 20; i++) {
      if (d > t) return t;
      if (isSchoolDay(d)) return d;
      d = addDays(d, 1);
    }
    return dateStr;
  }

  // Last N school days including today
  const recentSchoolDays = useMemo(() => {
    const t = today();
    const days: string[] = [];
    let cur = t;
    let iters = 0;
    while (days.length < 14 && iters < 60) {
      if (isSchoolDay(cur)) days.push(cur);
      cur = addDays(cur, -1);
      iters++;
    }
    return days; // index 0 = most recent (today if school day)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holidays]);

  // School days in the bulk-fill range
  const bulkSchoolDays = useMemo(() => {
    if (!bulkFrom || !bulkTo || bulkFrom > bulkTo) return [];
    const t = today();
    const days: string[] = [];
    let d = bulkFrom;
    let iters = 0;
    while (d <= bulkTo && d <= t && iters < 200) {
      if (isSchoolDay(d)) days.push(d);
      d = addDays(d, 1);
      iters++;
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkFrom, bulkTo, holidays]);

  // ── Date warning ────────────────────────────────────────────────────────────
  const dateWarning = useMemo(() => {
    if (!attendanceDate) return null;
    const d = new Date(attendanceDate + 'T00:00:00');
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return `${dow === 0 ? 'Sunday' : 'Saturday'} — weekends are not eligible school days.`;
    for (const h of holidays) {
      const start = new Date(h.holiday_date + 'T00:00:00');
      const end   = h.end_date ? new Date(h.end_date + 'T00:00:00') : start;
      if (d >= start && d <= end) return `${h.name} — this is a public holiday.`;
    }
    return null;
  }, [attendanceDate, holidays]);

  // ── Online / offline ────────────────────────────────────────────────────────
  useEffect(() => {
    const handleOnline  = () => { setIsOnline(true); handleSync(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => { refreshPendingCount(); }, []);
  useEffect(() => { loadClasses(); }, [profile]);
  useEffect(() => { if (selectedClass) { loadStudents(); loadRecordedDates(); } }, [selectedClass, attendanceDate]);

  async function refreshPendingCount() {
    setPendingCount(await syncQueue.getPendingCount());
  }
  async function handleSync() {
    setSyncing(true);
    await syncQueue.sync();
    await refreshPendingCount();
    setSyncing(false);
  }

  // ── Load classes ────────────────────────────────────────────────────────────
  async function loadClasses() {
    if (!profile?.id) return;
    if (!navigator.onLine) {
      const cacheKey = isAdmin ? `admin_classes_${profile.school_id}` : `fm_classes_${profile.id}`;
      const cached = await offlineStore.getCache<any[]>(cacheKey);
      if (cached) { setClasses(cached); setIsFormMaster(isAdmin || cached.length > 0); if (cached.length > 0) setSelectedClass(cached[0]?.id); }
      setMetaLoaded(true);
      return;
    }
    const { data: yearData } = await supabase.from('academic_years').select('id').eq('school_id', profile.school_id ?? '').eq('is_current', true).maybeSingle();
    const yearId = yearData?.id;
    if (yearId) {
      const { data: holData } = await supabase.from('holiday_calendar').select('name, holiday_date, end_date').eq('school_id', profile.school_id ?? '').eq('academic_year_id', yearId);
      setHolidays(holData ?? []);
    }
    if (isAdmin) {
      const { data: allClasses } = await supabase.from('classes').select('id, name, level, section').eq('school_id', profile.school_id ?? '').order('name');
      const classList = allClasses ?? [];
      setClasses(classList); setIsFormMaster(true);
      if (classList.length > 0) setSelectedClass(classList[0].id);
      setMetaLoaded(true);
      await offlineStore.setCache(`admin_classes_${profile.school_id}`, classList);
      return;
    }
    const [classFmRes, tableFmRes] = await Promise.all([
      supabase.from('classes').select('id, name, level, section').eq('class_teacher_id', profile.id),
      supabase.from('class_teachers').select('class_id, classes(id, name, level, section)').eq('teacher_id', profile.id).eq('academic_year_id', yearId ?? ''),
    ]);
    const fmClasses1 = classFmRes.data ?? [];
    const fmClasses2 = (tableFmRes.data ?? []).map(d => d.classes).filter(Boolean);
    const allUnique = [...new Map([...fmClasses1, ...fmClasses2].map((c: any) => [c.id, c])).values()];
    setClasses(allUnique); setIsFormMaster(allUnique.length > 0);
    if (allUnique.length > 0) setSelectedClass((allUnique[0] as any)?.id);
    setMetaLoaded(true);
    await offlineStore.setCache(`fm_classes_${profile.id}`, allUnique);
  }

  // ── Load students + existing attendance for the selected date ───────────────
  async function loadStudents() {
    if (!selectedClass) return;
    if (!navigator.onLine) {
      const cachedStudents = await offlineStore.getCache<any[]>(`students_${selectedClass}`);
      const cachedAtt = await offlineStore.getCache<Record<string, AttStatus>>(`att_${selectedClass}_${attendanceDate}`);
      if (cachedStudents) setStudents(cachedStudents);
      if (cachedAtt) setAttendanceMap(cachedAtt);
      return;
    }
    const { data: yearData } = await supabase.from('academic_years').select('id').eq('school_id', profile?.school_id ?? '').eq('is_current', true).maybeSingle();
    const yearId = yearData?.id;
    const [enrollRes, attRes] = await Promise.all([
      supabase.from('student_enrollments').select('*, students(id, first_name, last_name, admission_number)').eq('class_id', selectedClass).eq('status', 'active').eq('academic_year_id', yearId ?? ''),
      supabase.from('student_attendance').select('*').eq('class_id', selectedClass).eq('date', attendanceDate),
    ]);
    const studentList = (enrollRes.data ?? []).map(e => (e as any).students).filter(Boolean);
    setStudents(studentList);
    const map: Record<string, AttStatus> = {};
    (attRes.data ?? []).forEach(a => { map[a.student_id] = a.status as AttStatus; });
    setAttendanceMap(map);
    await offlineStore.setCache(`students_${selectedClass}`, studentList);
    await offlineStore.setCache(`att_${selectedClass}_${attendanceDate}`, map);
  }

  // ── Load which dates already have records for this class (last 90 days) ─────
  async function loadRecordedDates() {
    if (!selectedClass || !navigator.onLine) return;
    const from = addDays(today(), -90);
    const { data } = await supabase.from('student_attendance').select('date').eq('class_id', selectedClass).gte('date', from);
    setRecordedDates(new Set((data ?? []).map((r: any) => r.date as string)));
  }

  // ── Single-day save ─────────────────────────────────────────────────────────
  function setStatus(studentId: string, status: AttStatus) {
    setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
  }

  async function saveAttendance() {
    setSaving(true);
    const records = students.map(s => ({
      student_id: s.id, school_id: profile?.school_id, class_id: selectedClass,
      date: attendanceDate, status: attendanceMap[s.id] || 'present', recorded_by: profile?.id,
    }));
    if (!navigator.onLine) {
      await offlineStore.addPending({ table: 'student_attendance', operation: 'upsert', data: records, conflictTarget: 'student_id,date' });
      await offlineStore.setCache(`att_${selectedClass}_${attendanceDate}`, attendanceMap);
      await refreshPendingCount();
      setSavedOffline(true); setTimeout(() => setSavedOffline(false), 3000);
      setSaving(false); return;
    }
    const { error } = await supabase.from('student_attendance').upsert(records, { onConflict: 'student_id,date' });
    if (error) { alert('Failed to save attendance. Please try again.'); setSaving(false); return; }
    await offlineStore.setCache(`att_${selectedClass}_${attendanceDate}`, attendanceMap);
    setRecordedDates(prev => new Set([...prev, attendanceDate]));
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  }

  function markAll(status: AttStatus) {
    const map: Record<string, AttStatus> = {};
    students.forEach(s => { map[s.id] = status; });
    setAttendanceMap(map);
  }

  // ── Bulk fill ───────────────────────────────────────────────────────────────
  async function doBulkFill() {
    if (bulkSchoolDays.length === 0 || students.length === 0) return;
    setBulkSaving(true);
    const records = students.flatMap(s =>
      bulkSchoolDays.map(day => ({
        student_id: s.id, school_id: profile?.school_id, class_id: selectedClass,
        date: day, status: bulkStatus, recorded_by: profile?.id,
      }))
    );
    const { error } = await supabase.from('student_attendance').upsert(records, { onConflict: 'student_id,date' });
    if (error) { alert('Bulk fill failed. Please try again.'); }
    else {
      setRecordedDates(prev => new Set([...prev, ...bulkSchoolDays]));
      setBulkDone(true); setTimeout(() => setBulkDone(false), 3000);
      setBulkFrom(''); setBulkTo('');
    }
    setBulkSaving(false);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filtered      = students.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()));
  const presentCount  = students.filter(s => (attendanceMap[s.id] || 'present') === 'present').length;
  const absentCount   = students.filter(s => attendanceMap[s.id] === 'absent').length;
  const t             = today();

  // Count recent school days (excluding today) with missing records
  const missingCount  = recentSchoolDays.filter(d => d !== t && !recordedDates.has(d)).length;

  const inputCls = 'border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 bg-app-surface';

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">Attendance</h2>
          <p className="text-app-text-muted text-sm">
            {!metaLoaded ? 'Loading…' : isAdmin ? 'Mark and review attendance for any class' : isFormMaster ? 'Record daily student attendance for your class' : 'Restricted to Form Masters only'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFormMaster && !isOnline && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-medium">
              <WifiOff className="w-3.5 h-3.5" /> Offline
            </div>
          )}
          {isFormMaster && pendingCount > 0 && (
            <button onClick={handleSync} disabled={!isOnline || syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl text-xs font-medium transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : `${pendingCount} pending`}
            </button>
          )}
        </div>
      </div>

      {!metaLoaded ? (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm py-16 text-center">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
          <p className="text-app-text-muted text-sm">Loading…</p>
        </div>
      ) : !isFormMaster ? (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm py-20 text-center px-6">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-app-text mb-2">No Access</h3>
          <p className="text-app-text-muted text-sm max-w-sm mx-auto">
            Attendance marking is restricted to Form Masters only. You must be assigned as the Form Master of a class to record attendance.
          </p>
        </div>
      ) : (
        <>
          {/* ── Controls panel ── */}
          <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5 space-y-4">

            {/* Row 1: class + search */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1">Class</label>
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className={inputCls + ' w-full'}>
                  {classes.map(c => <option key={c?.id} value={c?.id}>{c?.name || `${c?.level}${c?.section}`}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1">Search Student</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-text-muted" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                    className="bg-app-surface text-app-text w-full pl-8 pr-3 py-2 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30" />
                </div>
              </div>
            </div>

            {/* Row 2: Date navigator */}
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1.5">Date</label>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Prev / next arrows */}
                <button
                  onClick={() => setAttendanceDate(getPrevSchoolDay(attendanceDate))}
                  title="Previous school day"
                  className="p-2 rounded-xl border border-app-border hover:bg-slate-100 transition-colors text-app-text-muted">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input type="date" value={attendanceDate} max={t}
                  onChange={e => setAttendanceDate(e.target.value)}
                  className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30" />
                <button
                  onClick={() => setAttendanceDate(getNextSchoolDay(attendanceDate))}
                  disabled={attendanceDate >= t}
                  title="Next school day"
                  className="p-2 rounded-xl border border-app-border hover:bg-slate-100 transition-colors text-app-text-muted disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />
                </button>
                {/* Today shortcut */}
                {attendanceDate !== t && (
                  <button onClick={() => setAttendanceDate(t)}
                    className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors">
                    Today
                  </button>
                )}
                {/* Missing count badge */}
                {missingCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
                    <CalendarDays className="w-3 h-3" /> {missingCount} day{missingCount !== 1 ? 's' : ''} unfilled
                  </span>
                )}
              </div>

              {/* Recent school days chip strip */}
              <div className="mt-2.5 flex gap-1.5 flex-wrap">
                {recentSchoolDays.map(d => {
                  const isSelected  = d === attendanceDate;
                  const isRecorded  = recordedDates.has(d);
                  const isToday     = d === t;
                  return (
                    <button key={d} onClick={() => setAttendanceDate(d)}
                      title={d}
                      className={`flex flex-col items-center px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors leading-tight
                        ${isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : isRecorded
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                            : isToday
                              ? 'bg-slate-100 border-app-border text-app-text hover:bg-slate-200'
                              : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                        }`}>
                      <span className="font-semibold">{dayLabel(d)}</span>
                      <span className="opacity-75">{shortDate(d)}</span>
                      {isRecorded && !isSelected && <span className="text-emerald-500 text-[9px]">✓</span>}
                      {!isRecorded && !isToday && !isSelected && <span className="text-red-400 text-[9px]">–</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date warning */}
            {dateWarning && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-700">
                <Ban className="w-4 h-4 shrink-0 text-amber-500" />
                <span><span className="font-semibold">Ineligible date:</span> {dateWarning} Attendance cannot be saved for this day.</span>
              </div>
            )}

            {/* Summary + bulk-fill toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-app-border gap-3">
              {students.length > 0 ? (
                <div className="flex items-center gap-3 sm:gap-4 text-sm">
                  <span className="text-emerald-600 font-medium">{presentCount} Present</span>
                  <span className="text-red-500 font-medium">{absentCount} Absent</span>
                  <span className="text-app-text-muted">{students.length} Total</span>
                </div>
              ) : <div />}
              <div className="flex items-center gap-2">
                {students.length > 0 && <>
                  <button onClick={() => markAll('present')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors">All Present</button>
                  <button onClick={() => markAll('absent')}  className="text-xs text-red-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">All Absent</button>
                </>}
                <button onClick={() => setBulkOpen(o => !o)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${bulkOpen ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-app-text-muted hover:bg-slate-200'}`}>
                  <Zap className="w-3 h-3" /> Bulk Fill
                </button>
              </div>
            </div>

            {/* Bulk fill panel */}
            {bulkOpen && (
              <div className="border border-violet-200 bg-violet-50 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-violet-800">Bulk Fill Attendance</p>
                  <p className="text-xs text-violet-600 mt-0.5">
                    Fill all students with one status for every school day in a date range. Weekends and holidays are skipped automatically.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-app-text-muted mb-1">From</label>
                    <input type="date" value={bulkFrom} max={t} onChange={e => setBulkFrom(e.target.value)} className={inputCls + ' w-full'} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-app-text-muted mb-1">To</label>
                    <input type="date" value={bulkTo} min={bulkFrom || undefined} max={t} onChange={e => setBulkTo(e.target.value)} className={inputCls + ' w-full'} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-app-text-muted mb-1">Status for all</label>
                    <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as AttStatus)} className={inputCls + ' w-full'}>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="excused">Excused</option>
                    </select>
                  </div>
                </div>

                {bulkSchoolDays.length > 0 && (
                  <p className="text-xs text-violet-700 bg-violet-100 rounded-lg px-3 py-2">
                    <span className="font-semibold">{bulkSchoolDays.length} school day{bulkSchoolDays.length !== 1 ? 's' : ''}</span> will be filled:{' '}
                    {bulkSchoolDays.slice(0, 5).map(d => `${dayLabel(d)} ${shortDate(d)}`).join(', ')}
                    {bulkSchoolDays.length > 5 ? ` … +${bulkSchoolDays.length - 5} more` : ''}
                  </p>
                )}
                {bulkFrom && bulkTo && bulkSchoolDays.length === 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">No school days in this range (all weekends / holidays).</p>
                )}

                {bulkDone && (
                  <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" /> Bulk fill complete!
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={doBulkFill}
                    disabled={bulkSaving || bulkSchoolDays.length === 0 || students.length === 0}
                    className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                    <Zap className="w-4 h-4" />
                    {bulkSaving ? 'Filling…' : `Fill ${bulkSchoolDays.length > 0 ? bulkSchoolDays.length : ''} Day${bulkSchoolDays.length !== 1 ? 's' : ''}`}
                  </button>
                  <button onClick={() => setBulkOpen(false)} className="text-sm text-app-text-muted hover:text-app-text px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Student list ── */}
          {students.length === 0 ? (
            <div className="text-center py-12 text-app-text-muted">
              <UserCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>{isOnline ? 'No students enrolled in this class' : 'No cached data available offline'}</p>
            </div>
          ) : (
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
              <div className="divide-y divide-app-border">
                {filtered.map(s => {
                  const status = attendanceMap[s.id] || 'present';
                  return (
                    <div key={s.id} className="flex items-center justify-between px-3 sm:px-5 py-3 gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-app-text-muted shrink-0">
                          {s.first_name?.[0]}{s.last_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-app-text truncate">{s.first_name} {s.last_name}</p>
                          {s.admission_number && <p className="text-xs text-app-text-muted truncate">{s.admission_number}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                        {(Object.keys(statusConfig) as AttStatus[]).map(st => {
                          const Icon = statusConfig[st].icon;
                          return (
                            <button key={st} onClick={() => setStatus(s.id, st)} title={statusConfig[st].label}
                              className={`flex items-center gap-1 p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition-colors ${status === st ? statusConfig[st].color : 'text-app-text-muted hover:bg-slate-100'}`}>
                              <Icon size={13} className="shrink-0" />
                              <span className="hidden sm:inline">{statusConfig[st].label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 border-t border-app-border flex items-center justify-between">
                {savedOffline
                  ? <div className="flex items-center gap-1.5 text-amber-600 text-sm"><WifiOff className="w-4 h-4" /> Saved offline — will sync when connected</div>
                  : <div />}
                <button onClick={saveAttendance} disabled={saving || !!dateWarning}
                  className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : saving ? 'Saving…' : isOnline ? 'Save Attendance' : 'Save Offline'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
