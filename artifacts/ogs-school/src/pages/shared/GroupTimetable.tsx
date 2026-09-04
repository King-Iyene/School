import { useEffect, useState, useRef } from 'react';
import { Printer, Calendar, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface TimeSlot {
  id: string;
  period_name: string;
  time_type: 'class' | 'break';
  start_time: string;
  end_time: string;
  sort_order: number;
}

interface WeekDay {
  id: string;
  name: string;
  short_name?: string;
  sort_order: number;
  is_weekend: boolean;
}

interface ClassInfo {
  id: string;
  name: string;
  level: string;
  section: string | null;
}

interface RoutineEntry {
  class_id: string;
  time_slot_id: string;
  week_day_id: string;
  is_break: boolean;
  subject_name?: string;
  teacher_name?: string;
}

function fmtTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

export default function GroupTimetable() {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [activeYear, setActiveYear] = useState<any>(null);
  const [selectedDayId, setSelectedDayId] = useState<string>('');

  const [routineMap, setRoutineMap] = useState<Record<string, Record<string, RoutineEntry>>>({});
  const [loadingRoutines, setLoadingRoutines] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile?.school_id) loadInitialData();
  }, [profile?.school_id]);

  useEffect(() => {
    if (selectedDayId && activeYear && classes.length > 0) loadRoutines();
  }, [selectedDayId, activeYear]);

  async function loadInitialData() {
    setLoading(true);
    const [classRes, yearRes, slotsRes, daysRes] = await Promise.all([
      supabase.from('classes').select('id, name, level, section').eq('school_id', profile!.school_id).order('level').order('section'),
      supabase.from('academic_years').select('*').eq('school_id', profile!.school_id).eq('is_current', true).maybeSingle(),
      supabase.from('time_slots').select('*').eq('school_id', profile!.school_id).order('sort_order'),
      supabase.from('school_week_days').select('*').eq('school_id', profile!.school_id).order('sort_order'),
    ]);

    const cls = classRes.data ?? [];
    const year = yearRes.data;
    const slots = slotsRes.data ?? [];
    const days = (daysRes.data ?? []).filter((d: WeekDay) => !d.is_weekend);

    setClasses(cls);
    setActiveYear(year);
    setTimeSlots(slots);
    setWeekDays(days);

    if (days.length > 0) {
      const today = new Date().getDay();
      const dayMap: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };
      const todayName = dayMap[today];
      const todayDay = days.find((d: WeekDay) => d.name === todayName);
      setSelectedDayId(todayDay?.id ?? days[0].id);
    }

    setLoading(false);
  }

  async function loadRoutines() {
    if (!activeYear) return;
    setLoadingRoutines(true);

    const { data } = await supabase
      .from('class_routines')
      .select(`
        class_id,
        time_slot_id,
        week_day_id,
        is_break,
        subject_id,
        teacher_id,
        subjects ( name ),
        profiles ( first_name, last_name )
      `)
      .eq('school_id', profile!.school_id)
      .eq('academic_year_id', activeYear.id)
      .eq('week_day_id', selectedDayId);

    const map: Record<string, Record<string, RoutineEntry>> = {};
    for (const row of data ?? []) {
      const r = row as any;
      const classId = r.class_id;
      const slotId = r.time_slot_id;
      if (!map[classId]) map[classId] = {};
      const sub = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
      const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      map[classId][slotId] = {
        class_id: classId,
        time_slot_id: slotId,
        week_day_id: r.week_day_id,
        is_break: r.is_break,
        subject_name: sub?.name,
        teacher_name: prof ? `${prof.first_name} ${prof.last_name}` : undefined,
      };
    }

    setRoutineMap(map);
    setLoadingRoutines(false);
  }

  const selectedDay = weekDays.find(d => d.id === selectedDayId);
  const selectedDayIndex = weekDays.findIndex(d => d.id === selectedDayId);

  function prevDay() {
    if (selectedDayIndex > 0) setSelectedDayId(weekDays[selectedDayIndex - 1].id);
  }
  function nextDay() {
    if (selectedDayIndex < weekDays.length - 1) setSelectedDayId(weekDays[selectedDayIndex + 1].id);
  }

  const filledCount = Object.keys(routineMap).length > 0
    ? timeSlots.filter(s => s.time_type === 'class').length * classes.length
    : 0;
  const entryCount = Object.values(routineMap).reduce((s, v) => s + Object.keys(v).length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-app-text-muted">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Group Timetable</h1>
          <p className="text-app-text-muted text-sm mt-0.5">
            All classes — {activeYear?.name ?? 'Current Year'}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-app-surface border border-app-border hover:bg-app-surface-alt text-app-text px-4 py-2 rounded-xl text-sm font-medium transition-colors print:hidden"
        >
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:hidden">
        {[
          { label: 'Classes',       value: classes.length,      color: 'bg-blue-50 text-blue-700' },
          { label: 'Periods',       value: timeSlots.filter(s => s.time_type === 'class').length, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Entries Today', value: entryCount,          color: 'bg-amber-50 text-amber-700' },
          { label: 'Break Slots',   value: timeSlots.filter(s => s.time_type === 'break').length, color: 'bg-rose-50 text-rose-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color.split(' ')[0]} text-center`}>
            <p className={`text-3xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</p>
            <p className="text-xs text-app-text-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-4 print:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={prevDay}
              disabled={selectedDayIndex <= 0}
              className="p-2 rounded-lg border border-app-border text-app-text-muted hover:bg-app-surface-alt disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex gap-1 mx-1">
              {weekDays.map(day => (
                <button
                  key={day.id}
                  onClick={() => setSelectedDayId(day.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDayId === day.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-app-text-muted hover:bg-slate-200'
                  }`}
                >
                  {day.name}
                </button>
              ))}
            </div>

            <button
              onClick={nextDay}
              disabled={selectedDayIndex >= weekDays.length - 1}
              className="p-2 rounded-lg border border-app-border text-app-text-muted hover:bg-app-surface-alt disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-app-text-muted">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200 inline-block" /> Class</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200 inline-block" /> Break</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 border border-app-border inline-block" /> Empty</span>
          </div>
        </div>
      </div>

      {classes.length === 0 || timeSlots.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border flex flex-col items-center justify-center h-48 text-app-text-muted gap-3">
          <Calendar className="w-12 h-12 opacity-10" />
          <p className="font-medium">
            {classes.length === 0 ? 'No classes found' : 'No time slots defined'}
          </p>
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-app-border bg-app-surface-alt flex items-center gap-2 print:hidden">
            <LayoutGrid className="w-4 h-4 text-app-text-muted" />
            <span className="text-sm font-semibold text-app-text">{selectedDay?.name ?? ''} Schedule</span>
            {loadingRoutines && <span className="text-xs text-app-text-muted ml-2">Refreshing...</span>}
          </div>

          <div ref={tableRef} className="overflow-x-auto">
            <table className="text-xs border-collapse" style={{ minWidth: `${220 + classes.length * 130}px` }}>
              <thead>
                <tr className="bg-app-surface-alt border-b-2 border-app-border">
                  <th className="sticky left-0 z-10 bg-app-surface-alt text-left px-4 py-3 font-semibold text-app-text-muted border-r-2 border-app-border whitespace-nowrap w-[220px]">
                    Period / Time
                  </th>
                  {classes.map(cls => (
                    <th
                      key={cls.id}
                      className="text-center px-2 py-3 font-semibold text-app-text border-r border-app-border last:border-r-0 whitespace-nowrap min-w-[130px]"
                    >
                      <div className="text-[11px] font-bold text-app-text">
                        {cls.name || `${cls.level}${cls.section ?? ''}`}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {timeSlots.map((slot, rowIdx) => {
                  const isBreakRow = slot.time_type === 'break';
                  return (
                    <tr
                      key={slot.id}
                      className={`${isBreakRow ? 'bg-amber-50/60' : rowIdx % 2 === 0 ? 'bg-app-surface' : 'bg-app-surface-alt/30'}`}
                    >
                      <td className={`sticky left-0 z-10 px-4 py-2.5 border-r-2 border-app-border whitespace-nowrap ${isBreakRow ? 'bg-amber-50' : rowIdx % 2 === 0 ? 'bg-app-surface' : 'bg-app-surface-alt/60'}`}>
                        <div className="flex items-center gap-2">
                          {isBreakRow && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                          )}
                          <div>
                            <p className={`font-semibold ${isBreakRow ? 'text-amber-700' : 'text-app-text'}`}>
                              {slot.period_name}
                            </p>
                            <p className="text-[10px] text-app-text-muted">
                              {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {classes.map(cls => {
                        const entry = routineMap[cls.id]?.[slot.id];

                        if (isBreakRow) {
                          return (
                            <td key={cls.id} className="px-2 py-2 text-center border-r border-amber-100 last:border-r-0">
                              <div className="text-[10px] text-amber-500 font-semibold uppercase tracking-wider">
                                {slot.period_name}
                              </div>
                            </td>
                          );
                        }

                        if (!entry) {
                          return (
                            <td key={cls.id} className="px-2 py-2 text-center border-r border-app-border last:border-r-0">
                              <span className="text-slate-200 text-[10px]">—</span>
                            </td>
                          );
                        }

                        if (entry.is_break) {
                          return (
                            <td key={cls.id} className="px-2 py-2 text-center border-r border-app-border last:border-r-0">
                              <div className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-amber-100 text-amber-600 text-[10px] font-semibold uppercase tracking-wider">
                                Break
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={cls.id} className="px-1.5 py-1.5 border-r border-app-border last:border-r-0">
                            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1.5 text-center">
                              <p className="font-bold text-emerald-900 leading-tight text-[11px] mb-0.5 truncate max-w-[110px] mx-auto" title={entry.subject_name}>
                                {entry.subject_name ?? 'TBD'}
                              </p>
                              {entry.teacher_name && (
                                <p className="text-[9px] text-emerald-600 truncate max-w-[110px] mx-auto" title={entry.teacher_name}>
                                  {entry.teacher_name.split(' ').map((n, i) => i === 0 ? n[0] + '.' : n).join(' ')}
                                </p>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .space-y-5, .space-y-5 * { visibility: visible; }
          .space-y-5 { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
          table { font-size: 9px; }
          th, td { padding: 4px 6px !important; }
        }
      `}</style>
    </div>
  );
}
