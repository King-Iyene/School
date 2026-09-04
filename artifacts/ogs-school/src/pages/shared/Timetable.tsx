import { useEffect, useState } from 'react';
import { Search, Printer, Calendar, Plus, Trash2, CreditCard as Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import { cache } from '../../utils/cache';

interface WeekDay {
  id: string;
  name: string;
  is_weekend: boolean;
  sort_order: number;
}

interface RoutineEntry {
  id: string;
  time_slot_id: string;
  week_day_id: string;
  is_break: boolean;
  subjects?: { name: string };
  profiles?: { first_name: string; last_name: string };
  subject_id?: string;
  teacher_id?: string;
}

export default function Timetable() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [routines, setRoutines] = useState<RoutineEntry[]>([]);
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeYear, setActiveYear] = useState<any>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCell, setActiveCell] = useState<{ timeSlotId: string; weekDayId: string } | null>(null);
  const [existingRoutine, setExistingRoutine] = useState<RoutineEntry | null>(null);
  
  const [isBreak, setIsBreak] = useState(false);
  const [applyAll, setApplyAll] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');

  const [availableSubjects, setAvailableSubjects] = useState<any[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.school_id) loadInitialData();
  }, [profile?.school_id]);

  async function loadInitialData() {
    if (!profile?.school_id) return;
    setLoading(true);
    try {
      const data = await cache.fetch(`timetable_init_v2_${profile.school_id}`, async () => {
        const [classesRes, yearRes, timeSlotsRes, weekDaysRes, teachersRes] = await Promise.all([
          supabase.from('classes').select('*').eq('school_id', profile.school_id).order('level').order('section'),
          supabase.from('academic_years').select('*').eq('school_id', profile.school_id).eq('is_current', true).maybeSingle(),
          supabase.from('time_slots').select('*').eq('school_id', profile.school_id).order('start_time'),
          supabase.from('school_week_days').select('*').eq('school_id', profile.school_id).order('sort_order'),
          supabase.from('profiles').select('id, first_name, last_name').eq('school_id', profile.school_id).in('role', ['teacher', 'head_teacher']).order('first_name')
        ]);
        return {
          classes: classesRes.data || [],
          activeYear: yearRes.data,
          timeSlots: timeSlotsRes.data || [],
          weekDays: weekDaysRes.data || [],
          availableTeachers: teachersRes.data || []
        };
      }, 86400000); // 24h

      setClasses(data.classes);
      setActiveYear(data.activeYear);
      setTimeSlots(data.timeSlots);
      setWeekDays(data.weekDays);
      setAvailableTeachers(data.availableTeachers);

      if (data.classes.length > 0 && !selectedClass) {
        setSelectedClass(data.classes[0].id);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedClass && activeYear) {
      fetchRoutines();
      fetchClassSubjects();
    }
  }, [selectedClass, activeYear]);

  async function fetchClassSubjects() {
    if (!selectedClass || !activeYear) return;
    
    const subs = await cache.fetch(`timetable_subs_${selectedClass}_${activeYear.id}`, async () => {
      // Fetch subjects assigned to the selected class from the official assignments table
      const { data } = await supabase
        .from('subject_teacher_assignments')
        .select(`
          subject_id,
          teacher_id,
          subjects ( id, name )
        `)
        .eq('class_id', selectedClass)
        .eq('academic_year_id', activeYear.id);
      
      // Fallback: If no class assignments configured, fetch all subjects.
      if (data && data.length > 0) {
        return data.map((r: any) => ({
          ...(r.subjects || {}),
          assigned_teacher_id: r.teacher_id
        })).filter(s => s.id);
      } else {
        const allSubjectsRes = await supabase.from('subjects').select('id, name').eq('school_id', profile!.school_id);
        return allSubjectsRes.data || [];
      }
    }, 3600000); // 1h

    setAvailableSubjects(subs);
  }

  async function fetchRoutines() {
    if (!selectedClass || !activeYear) return;

    const data = await cache.fetch(`timetable_routines_${selectedClass}_${activeYear.id}`, async () => {
      const { data: d, error } = await supabase
        .from('class_routines')
        .select(`
          id,
          time_slot_id,
          week_day_id,
          is_break,
          subject_id,
          teacher_id,
          subjects ( name ),
          profiles ( first_name, last_name )
        `)
        .eq('class_id', selectedClass)
        .eq('academic_year_id', activeYear.id);
      
      if (error) throw error;

      // Map the results to handle Supabase returning joins as arrays
      return (d || []).map((item: any) => ({
        ...item,
        subjects: Array.isArray(item.subjects) ? item.subjects[0] : item.subjects,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      }));
    }, 3600000); // 1h

    setRoutines(data);
  }

  function getRoutineForCell(timeSlotId: string, weekDayId: string) {
    return routines.find(r => r.time_slot_id === timeSlotId && r.week_day_id === weekDayId);
  }

  function formatTime(time: string) {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  }

  const printTimetable = () => {
    window.print();
  };

  function openCellModal(timeSlotId: string, weekDayId: string) {
    setActiveCell({ timeSlotId, weekDayId });
    const existing = getRoutineForCell(timeSlotId, weekDayId);
    setExistingRoutine(existing || null);
    
    if (existing) {
      setIsBreak(existing.is_break || false);
      setSelectedSubject(existing.subject_id || '');
      setSelectedTeacher(existing.teacher_id || '');
    } else {
      setIsBreak(false);
      setSelectedSubject('');
      setSelectedTeacher('');
    }
    setApplyAll(false);
    setModalOpen(true);
  }

  async function handleSaveCell() {
    if (!activeCell || !selectedClass || !activeYear) return;
    setSaving(true);
    
    const payload = {
      class_id: selectedClass,
      academic_year_id: activeYear.id,
      time_slot_id: activeCell.timeSlotId,
      is_break: isBreak,
      subject_id: isBreak ? null : (selectedSubject || null),
      teacher_id: isBreak ? null : (selectedTeacher || null),
      school_id: profile!.school_id,
    };

    if (applyAll) {
      // Upsert for all active weekdays
      const payloads = weekDays.map((day) => ({
        ...payload,
        week_day_id: day.id
      }));
      // On conflict implies we might overwrite existing ones for this slot+day
      await supabase.from('class_routines').upsert(payloads, {
        onConflict: 'class_id,time_slot_id,week_day_id,academic_year_id'
      });
    } else {
      if (existingRoutine) {
        await supabase
          .from('class_routines')
          .upsert({ ...payload, id: existingRoutine.id, week_day_id: activeCell.weekDayId });
      } else {
        await supabase.from('class_routines').upsert({
          ...payload,
          week_day_id: activeCell.weekDayId
        }, {
           onConflict: 'class_id,time_slot_id,week_day_id,academic_year_id'
        });
      }
    }

    setSaving(false);
    setModalOpen(false);
    cache.invalidate(`timetable_routines_${selectedClass}_${activeYear.id}`);
    fetchRoutines();
  }

  async function handleDeleteCell(routineId: string) {
    if (!window.confirm('Delete this routine entry?')) return;
    await supabase.from('class_routines').delete().eq('id', routineId);
    cache.invalidate(`timetable_routines_${selectedClass}_${activeYear.id}`);
    fetchRoutines();
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">School Timetable</h1>
          <p className="text-sm text-app-text-muted mt-1">
            {activeYear ? `Academic Year: ${activeYear.name}` : 'No active academic year found'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={printTimetable}
            className="flex items-center gap-2 bg-app-surface border border-app-border hover:bg-app-surface-alt text-app-text px-4 py-2 rounded-xl text-sm font-medium transition-colors print:hidden"
          >
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-4 mb-6 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-app-text mb-1">Select Class</label>
            <select
               value={selectedClass}
               onChange={(e) => setSelectedClass(e.target.value)}
               className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
               {classes.map((cls) => (
                 <option key={cls.id} value={cls.id}>
                   {cls.name || `${cls.level}${cls.section || ''}`}
                 </option>
               ))}
            </select>
          </div>
          <button
             onClick={fetchRoutines}
             disabled={!selectedClass}
             className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
             <Search size={16} />
             View Timetable
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-app-text-muted">Loading...</div>
      ) : selectedClass && weekDays.length > 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-app-surface-alt border-b border-app-border">
                  <th className="px-4 py-4 text-left font-semibold text-app-text-muted border-r border-app-border">
                    Period / Time
                  </th>
                  {weekDays.map((day) => (
                    <th key={day.id} className={`px-4 py-4 text-center font-semibold border-r border-app-border last:border-r-0 ${day.is_weekend ? 'bg-slate-100 text-app-text-muted' : 'text-app-text-muted'}`}>
                      {day.name}
                      {day.is_weekend && <div className="text-[10px] font-normal uppercase tracking-tighter opacity-60 mt-0.5">Weekend</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {timeSlots.length === 0 ? (
                  <tr>
                    <td colSpan={weekDays.length + 1} className="text-center py-12 text-app-text-muted">
                      <div className="flex flex-col items-center gap-2">
                        <Calendar size={32} className="opacity-20" />
                        <p>No periods defined for this school.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  timeSlots.map((slot) => (
                    <tr key={slot.id} className="hover:bg-app-surface-alt/50 transition-colors group">
                      <td className="px-4 py-3 font-medium text-app-text border-r border-app-border bg-app-surface-alt/30 whitespace-nowrap">
                        <div className="text-base text-app-text">{slot.period_name}</div>
                        <div className="text-xs text-app-text-muted">{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</div>
                      </td>
                      {weekDays.map((day) => {
                        const entry = getRoutineForCell(slot.id, day.id);
                        if (day.is_weekend) {
                          return (
                            <td key={day.id} className="px-2 py-3 text-center border-r border-app-border last:border-r-0 align-middle bg-app-surface-alt/50">
                               <div className="text-slate-300 font-bold text-xs uppercase tracking-widest rotate-[-12deg] select-none">
                                 Weekend
                               </div>
                            </td>
                          );
                        }
                        return (
                          <td key={day.id} className="px-2 py-3 text-center border-r border-app-border last:border-r-0 align-top relative min-w-[140px]">
                            {entry ? (
                              <div className={`rounded-xl p-2.5 h-full flex flex-col justify-center items-center border ${entry.is_break ? 'bg-amber-50/80 border-amber-100' : 'bg-emerald-50/80 border-emerald-100'}`}>
                                {entry.is_break ? (
                                   <div className="text-amber-600/80 font-medium text-xs uppercase tracking-widest">Break</div>
                                ) : (
                                  <>
                                    <div className="font-bold text-emerald-900 text-sm leading-tight mb-1 text-center">{entry.subjects?.name || 'No Subject'}</div>
                                    {entry.profiles && (
                                      <div className="text-emerald-700/80 text-[11px] font-medium truncate w-full text-center">
                                        {entry.profiles.first_name} {entry.profiles.last_name}
                                      </div>
                                    )}
                                  </>
                                )}
                                 {isSuperAdmin && (
                                   <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => openCellModal(slot.id, day.id)} className="p-1 bg-app-surface border border-app-border text-app-text-muted hover:text-emerald-500 rounded-md shadow-sm">
                                        <Edit2 size={12} />
                                      </button>
                                      <button onClick={() => handleDeleteCell(entry.id)} className="p-1 bg-app-surface border border-app-border text-app-text-muted hover:text-red-500 rounded-md shadow-sm">
                                        <Trash2 size={12} />
                                      </button>
                                   </div>
                                 )}
                              </div>
                            ) : (
                               <div className="flex items-center justify-center h-full w-full py-4">
                                 {isSuperAdmin ? (
                                   <button
                                     onClick={() => openCellModal(slot.id, day.id)}
                                     className="w-8 h-8 rounded-full border-2 border-dashed border-emerald-300 text-emerald-400 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-500 transition-all shadow-sm pulse-animation"
                                   >
                                     <Plus size={16} />
                                   </button>
                                 ) : (
                                   <span className="text-xs text-slate-300">—</span>
                                 )}
                               </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border flex flex-col items-center justify-center h-64 text-app-text-muted gap-3 shadow-sm">
          <Calendar size={48} className="opacity-10" />
          <p className="font-medium">
             {weekDays.length === 0 ? 'Add some Active Week Days in Academics first' : 'Pick a class to see the weekly schedule'}
          </p>
        </div>
      )}

      {/* Routine Assignment Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={existingRoutine ? 'Edit Time Slot Data' : 'Add Time Slot Data'}
      >
        <div className="space-y-5">
           <div className="flex items-center gap-3 pb-2 border-b border-app-border">
             <label className="relative flex items-center cursor-pointer">
               <input
                 type="checkbox"
                 className="sr-only peer"
                 checked={isBreak}
                 onChange={(e) => setIsBreak(e.target.checked)}
               />
               <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-app-surface after:border-app-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
             </label>
             <span className="text-sm font-semibold text-app-text">Is this a Break?</span>
           </div>

           <div className={`space-y-4 transition-all duration-300 ${isBreak ? 'blur-[2px] opacity-40 pointer-events-none' : ''}`}>
             <div>
               <label className="block text-sm font-medium text-app-text mb-1">Subject</label>
               <select
                 value={selectedSubject}
                 onChange={(e) => setSelectedSubject(e.target.value)}
                 className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
               >
                 <option value="">Select subject</option>
                 {availableSubjects.map((sub: any) => (
                   <option key={sub.id} value={sub.id}>{sub.name}</option>
                 ))}
               </select>
               <p className="text-xs text-app-text-muted mt-1">Subjects filtered by class level.</p>
             </div>
             
             <div>
               <label className="block text-sm font-medium text-app-text mb-1">Teacher</label>
               <select
                 value={selectedTeacher}
                 onChange={(e) => setSelectedTeacher(e.target.value)}
                 className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
               >
                 <option value="">Select teacher</option>
                 {availableTeachers.map((teacher: any) => (
                   <option key={teacher.id} value={teacher.id}>{teacher.first_name} {teacher.last_name}</option>
                 ))}
               </select>
             </div>
           </div>

           <div className="bg-app-surface-alt border border-app-border rounded-xl p-3 flex items-start gap-3 mt-2">
             <input 
                type="checkbox" 
                id="applyAll" 
                checked={applyAll}
                onChange={(e) => setApplyAll(e.target.checked)}
                className="mt-1 accent-emerald-500 w-4 h-4"
             />
             <label htmlFor="applyAll" className="text-sm text-app-text cursor-pointer">
               <span className="font-medium block mb-0.5">Apply for all weekdays</span>
               <span className="text-xs text-app-text-muted">This will copy the same data across {weekDays.map(d => d.name).join(', ')} for this period.</span>
             </label>
           </div>

           <div className="flex justify-end gap-2 pt-2 border-t border-app-border">
             <button
               onClick={() => setModalOpen(false)}
               className="px-4 py-2 text-sm rounded-lg border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors"
             >
               Cancel
             </button>
             <button
               onClick={handleSaveCell}
               disabled={saving || (!isBreak && (!selectedSubject || !selectedTeacher))}
               className="px-6 py-2 text-sm rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50"
             >
               {saving ? 'Saving...' : 'Save'}
             </button>
           </div>
        </div>
      </Modal>

      {/* Required style for pulsing outer circle */}
      <style>{`
         .pulse-animation {
           animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
         }
         @keyframes pulse-ring {
           0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
           70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
           100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
         }
      `}</style>
    </div>
  );
}
