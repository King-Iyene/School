import { useState, useEffect } from 'react';
import { CalendarCheck, Save, Lock, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Class { id: string; name: string; }
interface Section { id: string; name: string; class_id: string; }
interface AcademicYear { id: string; name: string; is_current?: boolean; }

interface StudentAttendanceRecord {
  student_id: string;
  full_name: string;
  roll_number: string | null;
  status: 'present' | 'absent' | 'late';
  attendance_id: string | null;
}

const ADMIN_ROLES = ['super_admin', 'admin', 'principal'];

export default function StudentAttendance() {
  const { profile } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(profile?.role ?? '');

  const [metaLoaded, setMetaLoaded] = useState(false);
  const [isFormMaster, setIsFormMaster] = useState(false);

  const [classes, setClasses] = useState<Class[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [filteredSections, setFilteredSections] = useState<Section[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedYear, setSelectedYear] = useState('');

  const [records, setRecords] = useState<StudentAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const isPastDate = selectedDate < today;
  const canEdit = !isPastDate || isAdmin;

  useEffect(() => { fetchFilters(); }, [profile?.id, profile?.school_id]);

  useEffect(() => {
    if (selectedClass) {
      setFilteredSections(sections.filter(s => s.class_id === selectedClass));
      setSelectedSection('');
    } else {
      setFilteredSections([]);
    }
  }, [selectedClass, sections]);

  async function fetchFilters() {
    if (!profile?.id || !profile?.school_id) return;

    // Always load sections and academic years
    const [sectionRes, yearRes] = await Promise.all([
      supabase.from('sections').select('id, name, class_id').order('name'),
      supabase.from('academic_years').select('id, name, is_current').eq('school_id', profile.school_id).order('name'),
    ]);

    if (sectionRes.data) setSections(sectionRes.data);
    if (yearRes.data) {
      setAcademicYears(yearRes.data);
      const current = (yearRes.data as AcademicYear[]).find(y => y.is_current);
      if (current) setSelectedYear(current.id);
    }

    const currentYearId = (yearRes.data as AcademicYear[] ?? []).find(y => y.is_current)?.id ?? '';

    if (isAdmin) {
      // Super admin, admin, principal — see all school classes
      const { data: allClasses } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', profile.school_id)
        .order('name');
      const classList = allClasses ?? [];
      setClasses(classList);
      setIsFormMaster(true);
      setMetaLoaded(true);
      return;
    }

    // Teachers — only Form Master classes
    const [classFmRes, tableFmRes] = await Promise.all([
      supabase.from('classes').select('id, name').eq('class_teacher_id', profile.id),
      supabase.from('class_teachers')
        .select('class_id, classes(id, name)')
        .eq('teacher_id', profile.id)
        .eq('academic_year_id', currentYearId),
    ]);

    const fmClasses1 = classFmRes.data ?? [];
    const fmClasses2 = (tableFmRes.data ?? []).map(d => d.classes).filter(Boolean) as Class[];
    const allUnique = [...new Map([...fmClasses1, ...fmClasses2].map(c => [c.id, c])).values()];

    setClasses(allUnique);
    setIsFormMaster(allUnique.length > 0);
    setMetaLoaded(true);
  }

  async function loadStudents() {
    if (!selectedClass || !selectedDate) return;
    setLoading(true);

    const studentsQuery = supabase
      .from('students')
      .select('id, first_name, last_name, admission_number')
      .eq('school_id', profile?.school_id ?? '')
      .eq('class_id', selectedClass)
      .eq('status', 'active')
      .order('first_name', { ascending: true });

    if (selectedSection) studentsQuery.eq('section_id', selectedSection);

    const { data: studentsData } = await studentsQuery;

    if (!studentsData || studentsData.length === 0) {
      setRecords([]);
      setLoading(false);
      return;
    }

    const studentIds = studentsData.map(s => s.id);

    const { data: attendanceData } = await supabase
      .from('student_attendance')
      .select('id, student_id, status')
      .eq('date', selectedDate)
      .in('student_id', studentIds);

    const attendanceMap = new Map<string, { id: string; status: string }>();
    (attendanceData ?? []).forEach((a: { id: string; student_id: string; status: string }) => {
      attendanceMap.set(a.student_id, { id: a.id, status: a.status });
    });

    const mapped: StudentAttendanceRecord[] = studentsData.map(s => {
      const existing = attendanceMap.get(s.id);
      return {
        student_id: s.id,
        full_name: `${s.first_name} ${s.last_name}`,
        roll_number: (s as any).admission_number || null,
        status: (existing?.status as 'present' | 'absent' | 'late') ?? 'present',
        attendance_id: existing?.id ?? null,
      };
    });

    setRecords(mapped);
    setLoading(false);
  }

  function setStatus(studentId: string, status: 'present' | 'absent' | 'late') {
    setRecords(prev => prev.map(r => r.student_id === studentId ? { ...r, status } : r));
  }

  async function saveAll() {
    if (records.length === 0) return;
    setSaving(true);

    const upsertData = records.map(r => ({
      student_id: r.student_id,
      date: selectedDate,
      status: r.status,
      class_id: selectedClass,
      school_id: profile?.school_id,
      recorded_by: profile?.id,
      academic_year_id: selectedYear || null,
    }));

    const { error } = await supabase.from('student_attendance').upsert(upsertData, { onConflict: 'student_id,date' });
    if (error) {
      console.error('Attendance error:', error);
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    await loadStudents();
  }

  function markAllPresent() {
    setRecords(prev => prev.map(r => ({ ...r, status: 'present' })));
  }

  const presentCount = records.filter(r => r.status === 'present').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const lateCount = records.filter(r => r.status === 'late').length;

  const inputClass = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-white';

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (!metaLoaded) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <CalendarCheck size={24} className="text-emerald-600" />
          <h1 className="text-2xl font-bold text-slate-800">Student Attendance</h1>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // ── No Access — non-form-master teacher ───────────────────────────────────────
  if (!isAdmin && !isFormMaster) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <CalendarCheck size={24} className="text-emerald-600" />
          <h1 className="text-2xl font-bold text-slate-800">Student Attendance</h1>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center px-6">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">No Access</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            Attendance marking is restricted to Form Masters only. You must be assigned as the Form Master of a class to record attendance.
          </p>
        </div>
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <CalendarCheck size={22} className="text-emerald-600 shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Student Attendance</h1>
            <p className="text-slate-500 text-sm hidden sm:block">
              {isAdmin ? 'Mark and review attendance for any class' : 'Record daily attendance for your class'}
            </p>
          </div>
        </div>
        {records.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                onClick={markAllPresent}
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium px-3 py-2 rounded-xl hover:bg-emerald-50 transition-colors"
              >
                All Present
              </button>
            )}
            <button
              onClick={saveAll}
              disabled={saving || !canEdit}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? 'Saving...' : 'Save All'}
            </button>
          </div>
        )}
      </div>

      {isPastDate && !isAdmin && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <CalendarCheck size={16} />
          Attendance records for past dates are locked and cannot be edited.
        </div>
      )}

      {saveSuccess && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-medium">
          Attendance saved successfully!
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
            <select className={inputClass} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              <option value="">Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
            <select className={inputClass} value={selectedSection} onChange={e => setSelectedSection(e.target.value)} disabled={!selectedClass}>
              <option value="">All sections</option>
              {filteredSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input type="date" className={inputClass} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year</label>
            <select className={inputClass} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              <option value="">Select year</option>
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadStudents}
              disabled={!selectedClass || !selectedDate || loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load'}
            </button>
          </div>
        </div>
      </div>

      {records.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-800">{records.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Total Students</p>
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

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Student Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Roll No.</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map(r => (
                  <tr key={r.student_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{r.roll_number ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {(['present', 'absent', 'late'] as const).map(st => (
                          <button
                            key={st}
                            onClick={() => setStatus(r.student_id, st)}
                            disabled={!canEdit}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              r.status === st
                                ? st === 'present' ? 'bg-emerald-500 text-white'
                                  : st === 'absent' ? 'bg-red-500 text-white'
                                  : 'bg-amber-500 text-white'
                                : st === 'present' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                  : st === 'absent' ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                  : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                            }`}
                          >
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
        <div className="text-center py-16 text-slate-400">
          <CalendarCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No students loaded</p>
          <p className="text-sm mt-1">Select a class and date, then click "Load".</p>
        </div>
      )}
    </div>
  );
}
