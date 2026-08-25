import { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, UserCheck, UserX, TrendingDown, CalendarDays, ChevronDown, AlertTriangle, Star, ClipboardX, ChevronUp, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface ClassInfo { id: string; name: string; level: string; section: string; class_teacher_id: string | null; }
interface AttendanceRec { student_id: string; class_id: string; status: string; date: string; }

interface ClassStat {
  classId: string;
  className: string;
  enrolled: number;
  daysMarked: number;
  present: number;
  absent: number;
  late: number;
  total: number;
  rate: number;
}

interface TopAbsentee {
  student_id: string;
  name: string;
  className: string;
  absent: number;
  total: number;
}

interface UnmarkedGap {
  date: string;
  classId: string;
  className: string;
  formMaster: string;
}

interface FormMasterStat {
  teacherId: string;
  name: string;
  classes: string[];
  totalPossible: number;
  marked: number;
  efficiency: number;
}

const TODAY = new Date().toISOString().split('T')[0];

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

function getMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getWeekdaysInRange(from: string, to: string): string[] {
  const days: string[] = [];
  const end = new Date(to + 'T00:00:00');
  const cur = new Date(from + 'T00:00:00');
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(localDateStr(cur)); // use local date components — avoids UTC offset shifting the date
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

type Period = 'today' | 'week' | 'month' | 'term' | 'custom';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today',  label: 'Today' },
  { value: 'week',   label: 'This Week' },
  { value: 'month',  label: 'This Month' },
  { value: 'term',   label: 'This Term' },
  { value: 'custom', label: 'Custom' },
];

function rateColor(rate: number) {
  if (rate >= 90) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (rate >= 75) return { bar: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50' };
  return                 { bar: 'bg-red-400',      text: 'text-red-700',     bg: 'bg-red-50' };
}

export default function AttendanceOverview() {
  const { profile } = useAuth();
  const [period, setPeriod]         = useState<Period>('today');
  const [customFrom, setCustomFrom] = useState(getMonthStart());
  const [customTo,   setCustomTo]   = useState(TODAY);
  const [loading, setLoading]       = useState(false);
  const [termRange,  setTermRange]  = useState<{ from: string; to: string } | null>(null);
  const [termName,   setTermName]   = useState<string>('');

  const [classes,       setClasses]       = useState<ClassInfo[]>([]);
  const [enrollCounts,  setEnrollCounts]  = useState<Record<string, number>>({});
  const [records,       setRecords]       = useState<AttendanceRec[]>([]);
  const [studentNames,  setStudentNames]  = useState<Record<string, string>>({});
  const [teacherNames,  setTeacherNames]  = useState<Record<string, string>>({});
  const [holidayDates,  setHolidayDates]  = useState<Set<string>>(new Set());

  const [sortBy,      setSortBy]      = useState<'name' | 'rate' | 'absent'>('rate');
  const [sortAsc,     setSortAsc]     = useState(true);
  const [filterClass, setFilterClass] = useState('');
  const [gapsExpanded, setGapsExpanded] = useState(true);

  // ── Date range ───────────────────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    if (period === 'today')  return { from: TODAY,           to: TODAY };
    if (period === 'week')   return { from: getWeekStart(),  to: TODAY };
    if (period === 'month')  return { from: getMonthStart(), to: TODAY };
    if (period === 'term')   return termRange ?? { from: getMonthStart(), to: TODAY };
    return { from: customFrom, to: customTo };
  }, [period, customFrom, customTo, termRange]);

  const periodLabel = useMemo(() => {
    if (period === 'today') return 'Today';
    if (period === 'week')  return 'This Week';
    if (period === 'month') return 'This Month';
    if (period === 'term')  return termName || 'This Term';
    return `${customFrom} → ${customTo}`;
  }, [period, customFrom, customTo, termName]);

  useEffect(() => { loadMeta(); }, [profile?.school_id]);
  useEffect(() => { if (classes.length > 0) loadAttendance(); }, [dateRange, classes]);

  // ── Load classes + students + teacher names ──────────────────────────────────
  async function loadMeta() {
    if (!profile?.school_id) return;

    // Load current term dates alongside other meta
    const [classRes, studRes, yearRes] = await Promise.all([
      supabase.from('classes')
        .select('id, name, level, section, class_teacher_id')
        .eq('school_id', profile.school_id)
        .order('level').order('section'),
      supabase.from('students')
        .select('id, class_id, first_name, last_name')
        .eq('school_id', profile.school_id)
        .eq('status', 'active'),
      supabase.from('academic_years')
        .select('id')
        .eq('school_id', profile.school_id)
        .eq('is_current', true)
        .maybeSingle(),
    ]);

    // Resolve current term → start/end dates
    if (yearRes.data?.id) {
      const { data: ayt } = await supabase
        .from('academic_year_terms')
        .select('term_id, start_date, end_date')
        .eq('academic_year_id', yearRes.data.id)
        .eq('is_current', true)
        .maybeSingle();

      if (ayt) {
        // Prefer dates on academic_year_terms row; fall back to terms table
        if (ayt.start_date && ayt.end_date) {
          setTermRange({ from: ayt.start_date, to: ayt.end_date > TODAY ? TODAY : ayt.end_date });
        } else if (ayt.term_id) {
          const { data: term } = await supabase
            .from('terms')
            .select('name, start_date, end_date')
            .eq('id', ayt.term_id)
            .maybeSingle();
          if (term?.start_date && term?.end_date) {
            setTermRange({ from: term.start_date, to: term.end_date > TODAY ? TODAY : term.end_date });
            setTermName(term.name ?? '');
          }
        }
        // Fetch term name if we only had the academic_year_terms row
        if (ayt.term_id && !termName) {
          const { data: tRow } = await supabase.from('terms').select('name').eq('id', ayt.term_id).maybeSingle();
          if (tRow?.name) setTermName(tRow.name);
        }
      }
    }

    const cls: ClassInfo[] = classRes.data ?? [];
    setClasses(cls);

    const counts: Record<string, number> = {};
    const sNames: Record<string, string> = {};
    const classIds = new Set(cls.map(c => c.id));
    (studRes.data ?? []).forEach((s: any) => {
      if (classIds.has(s.class_id)) {
        counts[s.class_id] = (counts[s.class_id] ?? 0) + 1;
        sNames[s.id] = `${s.first_name} ${s.last_name}`;
      }
    });
    setEnrollCounts(counts);
    setStudentNames(sNames);

    // Fetch form master names
    const teacherIds = [...new Set(cls.map(c => c.class_teacher_id).filter(Boolean))] as string[];
    if (teacherIds.length > 0) {
      const { data: tData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', teacherIds);
      const tNames: Record<string, string> = {};
      (tData ?? []).forEach((t: any) => { tNames[t.id] = `${t.first_name} ${t.last_name}`; });
      setTeacherNames(tNames);
    }
  }

  const loadAttendance = useCallback(async () => {
    if (!profile?.school_id) return;
    setLoading(true);
    const [attRes, holRes] = await Promise.all([
      supabase
        .from('student_attendance')
        .select('student_id, class_id, status, date')
        .eq('school_id', profile.school_id)
        .gte('date', dateRange.from)
        .lte('date', dateRange.to),
      supabase
        .from('holiday_calendar')
        .select('holiday_date, end_date')
        .eq('school_id', profile.school_id)
        .gte('holiday_date', dateRange.from)
        .lte('holiday_date', dateRange.to),
    ]);
    setRecords(attRes.data ?? []);

    // Expand each holiday (possibly multi-day) into individual date strings
    const hdSet = new Set<string>();
    (holRes.data ?? []).forEach((h: any) => {
      const start = new Date(h.holiday_date + 'T00:00:00');
      const end   = h.end_date ? new Date(h.end_date + 'T00:00:00') : start;
      const cur   = new Date(start);
      while (cur <= end) {
        hdSet.add(localDateStr(cur)); // local date — avoids UTC offset shifting the date
        cur.setDate(cur.getDate() + 1);
      }
    });
    setHolidayDates(hdSet);
    setLoading(false);
  }, [profile?.school_id, dateRange]);

  // ── School-wide stats ────────────────────────────────────────────────────────
  const schoolStats = useMemo(() => {
    let present = 0, absent = 0, late = 0;
    records.forEach(r => {
      if (r.status === 'present') present++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'late') late++;
    });
    const total = present + absent + late;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    const uniqueDates = new Set(records.map(r => r.date)).size;
    const uniqueStudents = new Set(records.map(r => r.student_id)).size;
    return { present, absent, late, total, rate, uniqueDates, uniqueStudents };
  }, [records]);

  // ── Per-class stats ──────────────────────────────────────────────────────────
  const classStats: ClassStat[] = useMemo(() => {
    const map: Record<string, { present: number; absent: number; late: number; dates: Set<string> }> = {};
    classes.forEach(c => { map[c.id] = { present: 0, absent: 0, late: 0, dates: new Set() }; });
    records.forEach(r => {
      if (!map[r.class_id]) return;
      if (r.status === 'present') map[r.class_id].present++;
      else if (r.status === 'absent') map[r.class_id].absent++;
      else if (r.status === 'late') map[r.class_id].late++;
      map[r.class_id].dates.add(r.date);
    });
    return classes
      .filter(c => !filterClass || c.id === filterClass)
      .map(c => {
        const { present, absent, late, dates } = map[c.id];
        const total = present + absent + late;
        const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
        const className = c.name || `${c.level}${c.section}`;
        return { classId: c.id, className, enrolled: enrollCounts[c.id] ?? 0, daysMarked: dates.size, present, absent, late, total, rate };
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'name')   diff = a.className.localeCompare(b.className);
        if (sortBy === 'rate')   diff = a.rate - b.rate;
        if (sortBy === 'absent') diff = b.absent - a.absent;
        return sortAsc ? diff : -diff;
      });
  }, [records, classes, enrollCounts, filterClass, sortBy, sortAsc]);

  // ── Top absentees ────────────────────────────────────────────────────────────
  const topAbsentees: TopAbsentee[] = useMemo(() => {
    const map: Record<string, { absent: number; total: number; class_id: string }> = {};
    records.forEach(r => {
      if (!map[r.student_id]) map[r.student_id] = { absent: 0, total: 0, class_id: r.class_id };
      map[r.student_id].total++;
      if (r.status === 'absent') map[r.student_id].absent++;
    });
    return Object.entries(map)
      .filter(([, v]) => v.absent > 0)
      .sort((a, b) => b[1].absent - a[1].absent)
      .slice(0, 8)
      .map(([sid, v]) => {
        const cls = classes.find(c => c.id === v.class_id);
        return { student_id: sid, name: studentNames[sid] ?? 'Unknown', className: cls?.name ?? cls?.level ?? '—', absent: v.absent, total: v.total };
      });
  }, [records, classes, studentNames]);

  // ── Weekdays in selected range (Mon–Fri) — raw calendar ─────────────────────
  const weekdays = useMemo(
    () => getWeekdaysInRange(dateRange.from, dateRange.to),
    [dateRange]
  );

  // ── School weekdays = weekdays minus public holidays ─────────────────────────
  const schoolWeekdays = useMemo(
    () => weekdays.filter(d => !holidayDates.has(d)),
    [weekdays, holidayDates]
  );

  // ── Unmarked gaps: every school weekday × every class that has no records ────
  const { unmaredGaps, schoolDays, emptyDays } = useMemo(() => {
    const datesWithRecords = new Set(records.map(r => r.date));
    const schoolDays = [...datesWithRecords].sort().reverse();

    // School weekdays with ZERO records at all
    const emptyDays = schoolWeekdays.filter(d => !datesWithRecords.has(d));

    const marked = new Set(records.map(r => `${r.class_id}::${r.date}`));
    const gaps: UnmarkedGap[] = [];
    schoolDays.forEach(date => {
      classes.forEach(c => {
        if (!marked.has(`${c.id}::${date}`)) {
          const className = c.name || `${c.level}${c.section}`;
          const tid = c.class_teacher_id;
          const formMaster = tid ? (teacherNames[tid] ?? 'Unassigned') : 'Unassigned';
          gaps.push({ date, classId: c.id, className, formMaster });
        }
      });
    });
    return { unmaredGaps: gaps, schoolDays, emptyDays };
  }, [records, classes, teacherNames, schoolWeekdays]);

  // ── Form master efficiency — denominator = school weekdays (excl. holidays) ──
  const formMasterStats: FormMasterStat[] = useMemo(() => {
    if (schoolWeekdays.length === 0) return [];

    const byTeacher: Record<string, { classIds: string[]; classNames: string[] }> = {};
    classes.forEach(c => {
      const key = c.class_teacher_id ?? '__unassigned__';
      if (!byTeacher[key]) byTeacher[key] = { classIds: [], classNames: [] };
      byTeacher[key].classIds.push(c.id);
      byTeacher[key].classNames.push(c.name || `${c.level}${c.section}`);
    });

    const markedSet = new Set(records.map(r => `${r.class_id}::${r.date}`));

    return Object.entries(byTeacher)
      .filter(([tid]) => tid !== '__unassigned__')
      .map(([tid, { classIds, classNames }]) => {
        const totalPossible = classIds.length * schoolWeekdays.length;
        let marked = 0;
        classIds.forEach(cid => {
          schoolWeekdays.forEach(date => {
            if (markedSet.has(`${cid}::${date}`)) marked++;
          });
        });
        const efficiency = totalPossible > 0 ? Math.round((marked / totalPossible) * 100) : 0;
        return { teacherId: tid, name: teacherNames[tid] ?? 'Unknown', classes: classNames, totalPossible, marked, efficiency };
      })
      .sort((a, b) => b.efficiency - a.efficiency);
  }, [records, classes, teacherNames, schoolWeekdays]);

  function toggleSort(col: 'name' | 'rate' | 'absent') {
    if (sortBy === col) setSortAsc(p => !p);
    else { setSortBy(col); setSortAsc(col === 'name'); }
  }

  const SortIcon = ({ col }: { col: 'name' | 'rate' | 'absent' }) => (
    <ChevronDown className={`w-3 h-3 inline ml-0.5 transition-transform ${sortBy === col ? (sortAsc ? 'rotate-180' : '') : 'opacity-30'}`} />
  );

  const classesWithNoData = classStats.filter(c => c.total === 0);

  // Group gaps by date for display
  const gapsByDate = useMemo(() => {
    const map: Record<string, UnmarkedGap[]> = {};
    unmaredGaps.forEach(g => {
      if (!map[g.date]) map[g.date] = [];
      map[g.date].push(g);
    });
    return map;
  }, [unmaredGaps]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Attendance Overview</h2>
          <p className="text-slate-500 text-sm">School-wide attendance summary — {periodLabel}</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${period === p.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom range */}
      {period === 'term' && (
        <div className="bg-indigo-50 rounded-2xl border border-indigo-100 px-5 py-3 flex items-center gap-3">
          <BookOpen className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          {termRange ? (
            <span className="text-sm text-indigo-700">
              <span className="font-semibold">{termName || 'Current Term'}</span>
              {' '}— {fmtDate(termRange.from)} to {fmtDate(termRange.to)}
            </span>
          ) : (
            <span className="text-sm text-indigo-500">No current term found — set term dates in Academic Years to use this filter.</span>
          )}
        </div>
      )}

      {period === 'custom' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 flex-wrap">
          <label className="text-xs font-medium text-slate-500">From</label>
          <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          <label className="text-xs font-medium text-slate-500">To</label>
          <input type="date" value={customTo} min={customFrom} max={TODAY} onChange={e => setCustomTo(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          <button onClick={loadAttendance}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors">
            Apply
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">Loading attendance data…</div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Attendance Rate', value: `${schoolStats.rate}%`,                    sub: `${schoolStats.uniqueStudents} students marked`,     icon: TrendingDown,  bg: schoolStats.rate >= 90 ? 'bg-emerald-50' : schoolStats.rate >= 75 ? 'bg-amber-50' : 'bg-red-50', iconBg: schoolStats.rate >= 90 ? 'bg-emerald-200' : schoolStats.rate >= 75 ? 'bg-amber-200' : 'bg-red-200', textColor: schoolStats.rate >= 90 ? 'text-emerald-700' : schoolStats.rate >= 75 ? 'text-amber-700' : 'text-red-700' },
              { label: 'Present',         value: schoolStats.present.toLocaleString(),       sub: `+ ${schoolStats.late} late`,                        icon: UserCheck,     bg: 'bg-emerald-50', iconBg: 'bg-emerald-200', textColor: 'text-emerald-700' },
              { label: 'Absent',          value: schoolStats.absent.toLocaleString(),        sub: `across ${schoolStats.uniqueDates} day${schoolStats.uniqueDates !== 1 ? 's' : ''}`, icon: UserX, bg: 'bg-red-50', iconBg: 'bg-red-200', textColor: 'text-red-700' },
              { label: 'Days Recorded',   value: schoolStats.uniqueDates.toString(),         sub: `${period === 'today' ? 'today' : periodLabel.toLowerCase()}`, icon: CalendarDays, bg: 'bg-blue-50', iconBg: 'bg-blue-200', textColor: 'text-blue-700' },
            ].map(card => (
              <div key={card.label} className={`${card.bg} rounded-2xl p-4`}>
                <div className="flex items-center gap-3">
                  <div className={`${card.iconBg} w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <card.icon className={`w-4 h-4 ${card.textColor}`} />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-2xl font-black ${card.textColor}`}>{card.value}</div>
                    <div className="text-xs text-slate-500 font-medium">{card.label}</div>
                    <div className="text-xs text-slate-400">{card.sub}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {schoolStats.total === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-20 text-center">
              <CalendarDays className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="font-medium text-slate-500">No attendance data for this period</p>
              <p className="text-sm text-slate-400 mt-1">Attendance records will appear here once they are marked</p>
            </div>
          ) : (
            <>
              {/* Row 1: By-class table + top absentees */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* Per-class table */}
                <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <h3 className="font-semibold text-slate-800">By Class</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{classStats.filter(c => c.total > 0).length} classes</span>
                    </div>
                    <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
                      className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none bg-white text-slate-600">
                      <option value="">All Classes</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name || `${c.level}${c.section}`}</option>)}
                    </select>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700" onClick={() => toggleSort('name')}>
                            Class <SortIcon col="name" />
                          </th>
                          <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Form Master</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Present</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700" onClick={() => toggleSort('absent')}>
                            Absent <SortIcon col="absent" />
                          </th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Late</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700" onClick={() => toggleSort('rate')}>
                            Rate <SortIcon col="rate" />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {classStats.filter(c => c.total > 0).map(c => {
                          const col = rateColor(c.rate);
                          const cls = classes.find(cl => cl.id === c.classId);
                          const fmName = cls?.class_teacher_id ? (teacherNames[cls.class_teacher_id] ?? '—') : '—';
                          return (
                            <tr key={c.classId} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-5 py-3">
                                <div className="font-medium text-slate-800">{c.className}</div>
                                <div className="text-xs text-slate-400">{c.daysMarked} day{c.daysMarked !== 1 ? 's' : ''} · {c.enrolled} enrolled</div>
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-500 hidden md:table-cell">{fmName}</td>
                              <td className="px-3 py-3 text-center font-medium text-emerald-700">{c.present}</td>
                              <td className="px-3 py-3 text-center font-medium text-red-600">{c.absent}</td>
                              <td className="px-3 py-3 text-center text-amber-600">{c.late}</td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2 justify-end">
                                  <div className="w-16 bg-slate-100 rounded-full h-2 flex-shrink-0">
                                    <div className={`h-2 rounded-full transition-all ${col.bar}`} style={{ width: `${c.rate}%` }} />
                                  </div>
                                  <span className={`text-sm font-bold w-10 text-right ${col.text}`}>{c.rate}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {classesWithNoData.length > 0 && !filterClass && (
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
                      <p className="text-xs text-slate-400">
                        <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-400" />
                        {classesWithNoData.length} class{classesWithNoData.length !== 1 ? 'es' : ''} not recorded: {classesWithNoData.map(c => c.className).join(', ')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Top Absentees */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <UserX className="w-4 h-4 text-red-400" />
                    <h3 className="font-semibold text-slate-800">Most Absent Students</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">Top {topAbsentees.length}</span>
                  </div>
                  {topAbsentees.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-sm">No absences recorded</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {topAbsentees.map((s, i) => {
                        const absPct = s.total > 0 ? Math.round((s.absent / s.total) * 100) : 0;
                        return (
                          <div key={s.student_id} className="flex items-center gap-3 px-5 py-3">
                            <span className={`text-xs font-black w-5 flex-shrink-0 ${i < 3 ? 'text-red-500' : 'text-slate-400'}`}>#{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-800 truncate">{s.name}</div>
                              <div className="text-xs text-slate-400">{s.className}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-sm font-bold text-red-600">{s.absent} day{s.absent !== 1 ? 's' : ''}</div>
                              <div className="text-xs text-slate-400">{absPct}% absent</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Unmarked Gaps + Form Master Efficiency */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

                {/* Unmarked Days */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <button className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    onClick={() => setGapsExpanded(p => !p)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <ClipboardX className="w-4 h-4 text-amber-500" />
                      <h3 className="font-semibold text-slate-800">Unmarked Classes</h3>
                      {unmaredGaps.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-semibold">
                          {unmaredGaps.length} partial gap{unmaredGaps.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {emptyDays.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">
                          {emptyDays.length} day{emptyDays.length !== 1 ? 's' : ''} with zero records
                        </span>
                      )}
                    </div>
                    {gapsExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  {gapsExpanded && (
                    (unmaredGaps.length === 0 && emptyDays.length === 0) ? (
                      <div className="py-10 text-center">
                        <div className="text-2xl mb-1">✓</div>
                        <p className="text-sm font-medium text-emerald-700">All classes marked for every weekday</p>
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {/* Days where NO class recorded anything */}
                        {emptyDays.length > 0 && (
                          <div className="px-5 py-3 bg-red-50 border-b border-red-100">
                            <p className="text-xs font-bold text-red-700 mb-1">
                              {emptyDays.length} weekday{emptyDays.length !== 1 ? 's' : ''} with no attendance recorded at all
                            </p>
                            <p className="text-xs text-red-500 leading-relaxed">
                              {emptyDays.map(d => fmtDate(d)).join(' · ')}
                            </p>
                          </div>
                        )}
                        {/* Partial gaps: some classes unmarked on days others were marked */}
                        {schoolDays.map(date => {
                          const dayGaps = gapsByDate[date];
                          if (!dayGaps?.length) return null;
                          return (
                            <div key={date}>
                              <div className="sticky top-0 px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                                <span className="text-xs font-bold text-amber-700">{fmtDate(date)}</span>
                                <span className="text-xs text-amber-500">{dayGaps.length} class{dayGaps.length !== 1 ? 'es' : ''} unmarked</span>
                              </div>
                              {dayGaps.map(g => (
                                <div key={`${g.date}-${g.classId}`} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50">
                                  <span className="text-sm font-medium text-slate-800">{g.className}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${g.formMaster === 'Unassigned' ? 'bg-slate-100 text-slate-500' : 'bg-red-50 text-red-600'}`}>
                                    {g.formMaster}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>

                {/* Form Master Efficiency */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Star className="w-4 h-4 text-indigo-400" />
                    <h3 className="font-semibold text-slate-800">Form Master Efficiency</h3>
                    <span className="text-xs text-slate-400 ml-auto">days marked / expected</span>
                  </div>

                  {formMasterStats.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-sm">No form masters assigned to classes</div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {formMasterStats.map((fm, i) => {
                        const col = rateColor(fm.efficiency);
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                        return (
                          <div key={fm.teacherId} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                            <div className="w-6 text-center flex-shrink-0">
                              {medal
                                ? <span className="text-base">{medal}</span>
                                : <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-800 truncate">{fm.name}</div>
                              <div className="text-xs text-slate-400 truncate">{fm.classes.join(' · ')}</div>
                              <div className="text-xs text-slate-400">{fm.marked} of {fm.totalPossible} class-days marked</div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="w-16 bg-slate-100 rounded-full h-2">
                                <div className={`h-2 rounded-full transition-all ${col.bar}`} style={{ width: `${fm.efficiency}%` }} />
                              </div>
                              <span className={`text-sm font-black w-10 text-right ${col.text}`}>{fm.efficiency}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {formMasterStats.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
                      <p className="text-xs text-slate-400">
                        Efficiency = days marked ÷ (classes × {schoolWeekdays.length} school day{schoolWeekdays.length !== 1 ? 's' : ''}). Weekdays in period minus public holidays.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
