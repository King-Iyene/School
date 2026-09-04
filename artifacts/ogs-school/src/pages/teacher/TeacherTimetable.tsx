import { useEffect, useState } from 'react';
import { BookOpen, GraduationCap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../components/hooks/useLocation';

interface WeekDay {
  id: string;
  name: string;
  is_weekend: boolean;
  sort_order: number;
}

export default function TeacherTimetable() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) loadData();
  }, [profile?.id]);

  async function loadData() {
    setLoading(true);

    const { data: yearData } = await supabase
      .from('academic_years')
      .select('id')
      .eq('school_id', profile!.school_id)
      .eq('is_current', true)
      .maybeSingle();

    const { data: slotsData } = await supabase
      .from('time_slots')
      .select('*')
      .eq('school_id', profile!.school_id)
      .order('sort_order');
    setTimeSlots(slotsData || []);

    const { data: daysData } = await supabase
      .from('school_week_days')
      .select('*')
      .eq('school_id', profile!.school_id)
      .order('sort_order');
    setWeekDays(daysData || []);

    if (yearData) {
      const { data: tasksData } = await supabase
        .from('class_routines')
        .select(`
          id,
          week_day_id,
          time_slot_id,
          subject_id,
          is_break,
          subjects ( name ),
          class_id,
          classes ( name, level, section )
        `)
        .eq('teacher_id', profile!.id)
        .eq('academic_year_id', yearData.id);

      const mappedTasks = (tasksData || []).map((t: any) => ({
        ...t,
        subjects: Array.isArray(t.subjects) ? t.subjects[0] : t.subjects,
        classes: Array.isArray(t.classes) ? t.classes[0] : t.classes,
      }));
      setTasks(mappedTasks);
    }
    setLoading(false);
  }

  function formatTime(time: string) {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  }

  if (loading) return <div className="p-8 text-center text-app-text-muted">Loading your schedule...</div>;

  const activeDays = weekDays.filter(d => !d.is_weekend || tasks.some(t => t.week_day_id === d.id));

  function getTask(dayId: string, slotId: string) {
    return tasks.find(t => t.week_day_id === dayId && t.time_slot_id === slotId);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">My Weekly Schedule</h2>
          <p className="text-sm text-app-text-muted mt-0.5">Your assigned periods and subjects</p>
        </div>
        <button
          onClick={() => navigate('/timetable')}
          className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold px-4 py-2 border border-emerald-100 bg-emerald-50/50 rounded-xl transition-colors"
        >
          View Full School Timetable
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[560px]">
            <thead>
              <tr className="bg-app-surface-alt border-b border-app-border">
                <th className="px-3 py-3.5 text-left text-xs font-bold text-app-text-muted uppercase tracking-wider border-r border-app-border w-[90px] sm:w-[110px]">
                  Period
                </th>
                {activeDays.map(day => (
                  <th
                    key={day.id}
                    className="px-3 sm:px-5 py-3.5 text-center text-xs font-bold text-app-text-muted uppercase tracking-wider border-r border-app-border last:border-r-0"
                  >
                    <span className="hidden sm:inline">{day.name}</span>
                    <span className="sm:hidden">{day.name.slice(0, 3)}</span>
                    {day.is_weekend && (
                      <span className="ml-1 text-[8px] bg-slate-200 text-app-text-muted px-1 py-0.5 rounded hidden sm:inline">WKD</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {timeSlots.map((slot, idx) => (
                <tr key={slot.id} className={idx % 2 === 0 ? 'bg-app-surface' : 'bg-app-surface-alt/40'}>
                  <td className="px-3 py-3 border-r border-app-border align-top">
                    <div className="text-[10px] font-semibold text-app-text">{slot.period_name || `P${idx + 1}`}</div>
                    <div className="text-[9px] text-app-text-muted mt-0.5 whitespace-nowrap">{formatTime(slot.start_time)}</div>
                  </td>
                  {activeDays.map(day => {
                    const task = getTask(day.id, slot.id);
                    return (
                      <td
                        key={day.id}
                        className="px-2 sm:px-5 py-3.5 border-r border-app-border last:border-r-0 align-top"
                      >
                        {!task ? (
                          <span className="text-xs text-slate-300 italic">—</span>
                        ) : task.is_break ? (
                          <div className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 text-app-text-muted text-[10px] font-semibold uppercase tracking-widest">
                            Break
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <BookOpen size={10} className="text-emerald-500 shrink-0" />
                              <span className="text-xs font-semibold text-app-text truncate">
                                {task.subjects?.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <GraduationCap size={10} className="text-app-text-muted shrink-0" />
                              <span className="text-[10px] text-app-text-muted truncate">
                                {task.classes?.name || `${task.classes?.level}${task.classes?.section || ''}`}
                              </span>
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {timeSlots.length === 0 && (
                <tr>
                  <td colSpan={activeDays.length + 1} className="px-5 py-10 text-center text-sm text-app-text-muted italic">
                    No time slots configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
