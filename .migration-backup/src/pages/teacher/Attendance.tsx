import { useEffect, useState } from 'react';
import { UserCheck, Search, CheckCircle, XCircle, Clock, AlertCircle, WifiOff, RefreshCw, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { offlineStore } from '../../lib/offlineStore';
import { syncQueue } from '../../lib/syncQueue';
import { useAuth } from '../../context/AuthContext';


type AttStatus = 'present' | 'absent' | 'late' | 'excused';
const statusConfig = {
  present: { label: 'Present', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200', icon: CheckCircle, variant: 'success' as const },
  absent: { label: 'Absent', color: 'bg-red-100 text-red-700 hover:bg-red-200', icon: XCircle, variant: 'error' as const },
  late: { label: 'Late', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200', icon: Clock, variant: 'warning' as const },
  excused: { label: 'Excused', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200', icon: AlertCircle, variant: 'info' as const },
};

export default function Attendance() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'principal' || profile?.role === 'head_teacher';
  const [classes, setClasses] = useState<any[]>([]);
  const [isFormMaster, setIsFormMaster] = useState(false);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttStatus>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [search, setSearch] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => { refreshPendingCount(); }, []);
  useEffect(() => { loadClasses(); }, [profile]);
  useEffect(() => { if (selectedClass) loadStudents(); }, [selectedClass, attendanceDate]);

  async function refreshPendingCount() {
    const count = await syncQueue.getPendingCount();
    setPendingCount(count);
  }

  async function handleSync() {
    setSyncing(true);
    await syncQueue.sync();
    await refreshPendingCount();
    setSyncing(false);
  }

  async function loadClasses() {
    if (!profile?.id) return;

    if (!navigator.onLine) {
      const cacheKey = isAdmin ? `admin_classes_${profile.school_id}` : `fm_classes_${profile.id}`;
      const cached = await offlineStore.getCache<any[]>(cacheKey);
      if (cached) {
        setClasses(cached);
        setIsFormMaster(isAdmin || cached.length > 0);
        if (cached.length > 0) setSelectedClass((cached[0] as any)?.id);
      }
      setMetaLoaded(true);
      return;
    }

    // Fetch current academic year
    const { data: yearData } = await supabase.from('academic_years')
      .select('id')
      .eq('school_id', profile.school_id ?? '')
      .eq('is_current', true)
      .maybeSingle();
    const yearId = yearData?.id;

    if (isAdmin) {
      // Admins and super admins see every class in the school
      const { data: allClasses } = await supabase
        .from('classes')
        .select('id, name, level, section')
        .eq('school_id', profile.school_id ?? '')
        .order('name');
      const classList = allClasses ?? [];
      setClasses(classList);
      setIsFormMaster(true);
      if (classList.length > 0) setSelectedClass(classList[0].id);
      setMetaLoaded(true);
      await offlineStore.setCache(`admin_classes_${profile.school_id}`, classList);
      return;
    }

    // Teachers: only Form Master classes
    const [classFmRes, tableFmRes] = await Promise.all([
      supabase
        .from('classes')
        .select('id, name, level, section')
        .eq('class_teacher_id', profile.id),
      supabase
        .from('class_teachers')
        .select('class_id, classes(id, name, level, section)')
        .eq('teacher_id', profile.id)
        .eq('academic_year_id', yearId ?? ''),
    ]);

    const fmClasses1 = classFmRes.data ?? [];
    const fmClasses2 = (tableFmRes.data ?? []).map(d => d.classes).filter(Boolean);

    const allUnique = [
      ...new Map([...fmClasses1, ...fmClasses2].map((c: any) => [c.id, c])).values(),
    ];

    setClasses(allUnique);
    setIsFormMaster(allUnique.length > 0);
    if (allUnique.length > 0) setSelectedClass((allUnique[0] as any)?.id);
    setMetaLoaded(true);
    await offlineStore.setCache(`fm_classes_${profile.id}`, allUnique);
  }

  async function loadStudents() {
    if (!selectedClass) return;

    if (!navigator.onLine) {
      const cachedStudents = await offlineStore.getCache<any[]>(`students_${selectedClass}`);
      const cachedAtt = await offlineStore.getCache<Record<string, AttStatus>>(`att_${selectedClass}_${attendanceDate}`);
      if (cachedStudents) setStudents(cachedStudents);
      if (cachedAtt) setAttendanceMap(cachedAtt);
      return;
    }

    const { data: yearData } = await supabase.from('academic_years')
      .select('id')
      .eq('school_id', profile?.school_id ?? '')
      .eq('is_current', true)
      .maybeSingle();
    const yearId = yearData?.id;

    const [enrollRes, attRes] = await Promise.all([
      supabase.from('student_enrollments')
        .select('*, students(id, first_name, last_name, admission_number)')
        .eq('class_id', selectedClass)
        .eq('status', 'active')
        .eq('academic_year_id', yearId ?? ''),
      supabase.from('student_attendance')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('date', attendanceDate),
    ]);

    const studentList = (enrollRes.data ?? []).map(e => (e as any).students).filter(Boolean);
    setStudents(studentList);

    const map: Record<string, AttStatus> = {};
    (attRes.data ?? []).forEach(a => { map[a.student_id] = a.status as AttStatus; });
    setAttendanceMap(map);

    await offlineStore.setCache(`students_${selectedClass}`, studentList);
    await offlineStore.setCache(`att_${selectedClass}_${attendanceDate}`, map);
  }

  function setStatus(studentId: string, status: AttStatus) {
    setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
  }

  async function saveAttendance() {
    setSaving(true);
    const records = students.map(s => ({
      student_id: s.id,
      school_id: profile?.school_id,
      class_id: selectedClass,
      date: attendanceDate,
      status: attendanceMap[s.id] || 'present',
      recorded_by: profile?.id,
    }));

    if (!navigator.onLine) {
      await offlineStore.addPending({
        table: 'student_attendance',
        operation: 'upsert',
        data: records,
        conflictTarget: 'student_id,date',
      });
      await offlineStore.setCache(`att_${selectedClass}_${attendanceDate}`, attendanceMap);
      await refreshPendingCount();
      setSavedOffline(true);
      setTimeout(() => setSavedOffline(false), 3000);
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('student_attendance').upsert(records, { onConflict: 'student_id,date' });
    if (error) {
      console.error('Error saving attendance:', error);
      alert('Failed to save attendance. Please try again.');
      setSaving(false);
      return;
    }
    await offlineStore.setCache(`att_${selectedClass}_${attendanceDate}`, attendanceMap);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  }

  function markAll(status: AttStatus) {
    const map: Record<string, AttStatus> = {};
    students.forEach(s => { map[s.id] = status; });
    setAttendanceMap(map);
  }

  const filtered = students.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()));
  const presentCount = students.filter(s => (attendanceMap[s.id] || 'present') === 'present').length;
  const absentCount = students.filter(s => attendanceMap[s.id] === 'absent').length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Attendance</h2>
          <p className="text-slate-500 text-sm">
            {!metaLoaded ? 'Loading...' : isAdmin ? 'Mark and review attendance for any class' : isFormMaster ? 'Record daily student attendance for your class' : 'Restricted to Form Masters only'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFormMaster && !isOnline && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-medium">
              <WifiOff className="w-3.5 h-3.5" />
              Offline
            </div>
          )}
          {isFormMaster && pendingCount > 0 && (
            <button
              onClick={handleSync}
              disabled={!isOnline || syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : `${pendingCount} pending`}
            </button>
          )}
        </div>
      </div>

      {!metaLoaded ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      ) : !isFormMaster ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center px-6">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">No Access</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            Attendance marking is restricted to Form Masters only. You must be assigned as the Form Master of a class to record attendance.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
                  {classes.map(c => <option key={(c as any)?.id} value={(c as any)?.id}>{(c as any)?.name || `${(c as any)?.level}${(c as any)?.section}`}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Search Student</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                </div>
              </div>
            </div>

            {students.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 pt-4 border-t border-slate-100 gap-3">
                <div className="flex items-center gap-3 sm:gap-4 text-sm">
                  <span className="text-emerald-600 font-medium">{presentCount} Present</span>
                  <span className="text-red-500 font-medium">{absentCount} Absent</span>
                  <span className="text-slate-400">{students.length} Total</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => markAll('present')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors">All Present</button>
                  <button onClick={() => markAll('absent')} className="text-xs text-red-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">All Absent</button>
                </div>
              </div>
            )}
          </div>

          {students.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <UserCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>{isOnline ? 'No students enrolled in this class' : 'No cached data available offline'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {filtered.map(s => {
                  const status = attendanceMap[s.id] || 'present';
                  return (
                    <div key={s.id} className="flex items-center justify-between px-3 sm:px-5 py-3 gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600 shrink-0">
                          {s.first_name?.[0]}{s.last_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{s.first_name} {s.last_name}</p>
                          {s.student_id ? <p className="text-xs text-slate-400 truncate">{s.student_id}</p> : s.admission_number ? <p className="text-xs text-slate-400 truncate">{s.admission_number}</p> : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                        {(Object.keys(statusConfig) as AttStatus[]).map(st => {
                          const Icon = statusConfig[st].icon;
                          return (
                            <button
                              key={st}
                              onClick={() => setStatus(s.id, st)}
                              title={statusConfig[st].label}
                              className={`flex items-center gap-1 p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition-colors ${status === st ? statusConfig[st].color : 'text-slate-400 hover:bg-slate-100'}`}
                            >
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
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                {savedOffline && (
                  <div className="flex items-center gap-1.5 text-amber-600 text-sm">
                    <WifiOff className="w-4 h-4" />
                    Saved offline — will sync when connected
                  </div>
                )}
                {!savedOffline && <div />}
                <button onClick={saveAttendance} disabled={saving} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : saving ? 'Saving...' : isOnline ? 'Save Attendance' : 'Save Offline'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
